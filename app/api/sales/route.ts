// app/api/sales/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function safeDate(s: string | null): string | null {
  return s && ISO_DATE.test(s) ? s : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = safeDate(searchParams.get("from"));
  const to   = safeDate(searchParams.get("to"));

  const empFilter  = from && to ? `AND e.enquiry_date   BETWEEN '${from}' AND '${to}'` : "";
  const dealFilter = from && to ? `AND d.date           BETWEEN '${from}' AND '${to}'` : "";
  const intFilter  = from && to ? `AND i.scheduled_date BETWEEN '${from}' AND '${to}'` : "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async function sql(query: string) {
    const { data, error } = await supabase.rpc("execute_sql", { query: query.trim() });
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown>[]) ?? [];
  }

  try {
    const [funnel, missed, stale, interview_outcomes] = await Promise.all([

      // ── 1. Funnel by relationship owner ───────────────────────────────────
      sql(`
        WITH employer_leads AS (
          -- All employers for this RO in the date range (active flag not relevant for history)
          SELECT e.employer_id, e.contact_name, TRIM(e.relationship_owner) AS salesperson
          FROM employers e
          WHERE TRIM(e.relationship_owner) IS NOT NULL
            AND TRIM(e.relationship_owner) NOT IN ('', 'Not Potential', 'test')
            ${empFilter}
        ),
        lead_counts AS (
          SELECT salesperson, COUNT(DISTINCT employer_id) AS total_leads
          FROM employer_leads GROUP BY salesperson
        ),
        profile_counts AS (
          SELECT el.salesperson, COUNT(DISTINCT el.employer_id) AS profiles_sent
          FROM employer_leads el
          WHERE EXISTS (SELECT 1 FROM profiles_sent ps WHERE ps.employer_id = el.employer_id)
          GROUP BY el.salesperson
        ),
        interview_counts AS (
          SELECT el.salesperson, COUNT(DISTINCT i.interview_id) AS interviews_done
          FROM employer_leads el
          JOIN interview i ON i.employer_contact_name = el.contact_name
          WHERE i.status IN ('Completed', 'Deal')
          GROUP BY el.salesperson
        ),
        deal_counts AS (
          SELECT
            TRIM(e.relationship_owner) AS salesperson,
            COUNT(DISTINCT d.deal_id) FILTER (WHERE d.milestone_status IS NOT NULL AND d.milestone_status <> 'missed') AS deals_won,
            COUNT(DISTINCT d.deal_id) FILTER (WHERE d.milestone_status = 'missed') AS deals_missed
          FROM deals d
          JOIN employers e ON e.employer_id = d.employer_id
          WHERE TRIM(e.relationship_owner) IS NOT NULL
            AND TRIM(e.relationship_owner) NOT IN ('', 'Not Potential', 'test')
            ${dealFilter}
          GROUP BY TRIM(e.relationship_owner)
        )
        SELECT
          lc.salesperson,
          lc.total_leads,
          COALESCE(pc.profiles_sent, 0)   AS profiles_sent,
          COALESCE(ic.interviews_done, 0) AS interviews_done,
          COALESCE(dc.deals_won, 0)       AS deals_won,
          COALESCE(dc.deals_missed, 0)    AS deals_missed,
          ROUND(100.0 * COALESCE(pc.profiles_sent, 0) / NULLIF(lc.total_leads, 0), 1) AS activation_pct,
          ROUND(100.0 * COALESCE(dc.deals_won, 0)     / NULLIF(lc.total_leads, 0), 1) AS conversion_pct
        FROM lead_counts lc
        LEFT JOIN profile_counts   pc ON pc.salesperson = lc.salesperson
        LEFT JOIN interview_counts ic ON ic.salesperson = lc.salesperson
        LEFT JOIN deal_counts      dc ON dc.salesperson = lc.salesperson
        ORDER BY lc.total_leads DESC
      `),

      // ── 2. Missed deals (join via employer_id FK) ─────────────────────────
      sql(`
        SELECT d.employer_name, d.nationality, d.type,
               d.milestone_status, d.date::text AS date,
               e.relationship_owner AS lead_owner
        FROM deals d
        LEFT JOIN employers e ON e.employer_id = d.employer_id
        WHERE d.milestone_status = 'missed'
          ${dealFilter}
        ORDER BY d.date DESC
        LIMIT 30
      `),

      // ── 3. Stale leads ────────────────────────────────────────────────────
      sql(`
        SELECT e.employer_name, e.contact_name, TRIM(e.relationship_owner) AS lead_owner,
               e.enquiry_date::text,
               (CURRENT_DATE - e.enquiry_date)::int AS days_stale
        FROM employers e
        LEFT JOIN profiles_sent ps ON ps.employer_id = e.employer_id
        WHERE ps.id IS NULL
          AND e.enquiry_date < CURRENT_DATE - INTERVAL '14 days'
          AND e.active = true
          AND TRIM(e.relationship_owner) IS NOT NULL
          AND TRIM(e.relationship_owner) NOT IN ('', 'Not Potential', 'test')
          ${empFilter}
        ORDER BY days_stale DESC
        LIMIT 30
      `),

      // ── 4. Interview outcomes by RO ───────────────────────────────────────
      sql(`
        SELECT
          COALESCE(i.ro, 'Unknown') AS owner,
          COUNT(*) FILTER (WHERE i.status = 'Completed') AS completed,
          COUNT(*) FILTER (WHERE i.status = 'Deal')      AS deal,
          COUNT(*) FILTER (WHERE i.status = 'No Show')   AS no_show,
          COUNT(*) FILTER (WHERE i.status = 'Cancelled') AS cancelled,
          COUNT(*) FILTER (WHERE i.status = 'Postponed') AS postponed,
          ROUND(100.0 * COUNT(*) FILTER (WHERE i.status = 'Deal') / NULLIF(COUNT(*), 0), 1) AS deal_rate_pct
        FROM interview i
        WHERE i.ro IS NOT NULL
          ${intFilter}
        GROUP BY i.ro
        ORDER BY completed DESC
      `),
    ]);

    return NextResponse.json(
      { funnel, missed, stale, interview_outcomes },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sales/route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
