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

  const employerDateFilter  = from && to ? `AND e.enquiry_date  BETWEEN '${from}' AND '${to}'` : "";
  const dealDateFilter      = from && to ? `AND d.date          BETWEEN '${from}' AND '${to}'` : "";
  const interviewDateFilter = from && to ? `AND i.scheduled_date BETWEEN '${from}' AND '${to}'` : "";

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
      // ── 1. Funnel by relationship owner (salesperson) ─────────────────────
      sql(`
        WITH leads AS (
          SELECT e.relationship_owner AS salesperson, e.employer_id, e.contact_name, e.employer_name
          FROM employers e
          WHERE e.relationship_owner IS NOT NULL
            AND e.relationship_owner NOT IN ('', 'Not Potential', 'test')
            AND e.active = true
            ${employerDateFilter}
        ),
        activated   AS (SELECT DISTINCT employer_id FROM profiles_sent),
        interviewed AS (
          SELECT DISTINCT employer_contact_name FROM interview
          WHERE status IN ('Completed','Deal')
        ),
        won    AS (SELECT DISTINCT employer_name FROM deals WHERE milestone_status IS NOT NULL AND milestone_status <> 'missed'),
        missed AS (SELECT DISTINCT employer_name FROM deals WHERE milestone_status = 'missed')
        SELECT
          l.salesperson,
          COUNT(DISTINCT l.employer_id)                                                           AS total_leads,
          COUNT(DISTINCT a.employer_id)                                                           AS profiles_sent,
          COUNT(DISTINCT i.employer_contact_name)                                                 AS interviews_done,
          COUNT(DISTINCT w.employer_name)                                                         AS deals_won,
          COUNT(DISTINCT m.employer_name)                                                         AS deals_missed,
          ROUND(100.0*COUNT(DISTINCT a.employer_id)/NULLIF(COUNT(DISTINCT l.employer_id),0),1)    AS activation_pct,
          ROUND(100.0*COUNT(DISTINCT w.employer_name)/NULLIF(COUNT(DISTINCT l.employer_id),0),1)  AS conversion_pct
        FROM leads l
        LEFT JOIN activated   a ON a.employer_id           = l.employer_id
        LEFT JOIN interviewed i ON i.employer_contact_name = l.contact_name
        LEFT JOIN won         w ON w.employer_name          = l.employer_name
        LEFT JOIN missed      m ON m.employer_name          = l.employer_name
        GROUP BY l.salesperson ORDER BY total_leads DESC
      `),

      // ── 2. Missed deals ───────────────────────────────────────────────────
      sql(`
        SELECT d.employer_name, d.nationality, d.type,
               d.milestone_status, d.date::text AS date,
               e.relationship_owner AS lead_owner
        FROM deals d
        LEFT JOIN employers e ON e.employer_name = d.employer_name
        WHERE d.milestone_status = 'missed'
          ${dealDateFilter}
        ORDER BY d.date DESC LIMIT 30
      `),

      // ── 3. Stale leads (active, no profile sent, >14 days) ────────────────
      sql(`
        SELECT e.employer_name, e.contact_name, e.relationship_owner AS lead_owner,
               e.enquiry_date::text,
               (CURRENT_DATE - e.enquiry_date)::int AS days_stale
        FROM employers e
        LEFT JOIN profiles_sent ps ON ps.employer_id = e.employer_id
        WHERE ps.id IS NULL
          AND e.enquiry_date < CURRENT_DATE - INTERVAL '14 days'
          AND e.active = true
          AND e.relationship_owner IS NOT NULL
          AND e.relationship_owner NOT IN ('', 'Not Potential', 'test')
          ${employerDateFilter}
        ORDER BY days_stale DESC LIMIT 30
      `),

      // ── 4. Interview outcomes by relationship owner ────────────────────────
      sql(`
        SELECT
          COALESCE(i.ro,'Unknown') AS owner,
          COUNT(*) FILTER (WHERE i.status='Completed') AS completed,
          COUNT(*) FILTER (WHERE i.status='Deal')       AS deal,
          COUNT(*) FILTER (WHERE i.status='No Show')    AS no_show,
          COUNT(*) FILTER (WHERE i.status='Cancelled')  AS cancelled,
          COUNT(*) FILTER (WHERE i.status='Postponed')  AS postponed,
          ROUND(100.0*COUNT(*) FILTER (WHERE i.status='Deal')/NULLIF(COUNT(*),0),1) AS deal_rate_pct
        FROM interview i
        WHERE i.ro IS NOT NULL
          ${interviewDateFilter}
        GROUP BY i.ro ORDER BY deal_rate_pct DESC
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
