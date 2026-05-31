"use client";
// app/page.tsx — full sales performance dashboard

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FunnelRow {
  salesperson: string;
  total_leads: number; profiles_sent: number; interviews_done: number;
  deals_won: number; deals_missed: number;
  activation_pct: number; conversion_pct: number;
}
interface MissedRow   { employer_name:string; nationality:string; type:string; milestone_status:string; lead_owner:string; date:string; }
interface StaleRow    { employer_name:string; contact_name:string; lead_owner:string; enquiry_date:string; days_stale:number; }
interface InterviewRow{ owner:string; completed:number; deal:number; no_show:number; cancelled:number; postponed:number; deal_rate_pct:number; }
interface DashData    { funnel:FunnelRow[]; missed:MissedRow[]; stale:StaleRow[]; interview_outcomes:InterviewRow[]; }

// ── Tiny shared pieces ────────────────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex:1, height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min(Math.max(+pct,0),100)}%`, background:color, borderRadius:3, transition:"width .7s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

function Pill({ label, color }: { label:string; color:string }) {
  return (
    <span style={{ background:`${color}18`, color, border:`1px solid ${color}30`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:600 }}>
      {label}
    </span>
  );
}

function KPI({ label, value, sub, color }: { label:string; value:string|number; sub?:string; color:string }) {
  return (
    <div style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderTop:`2px solid ${color}`, borderRadius:10, padding:"18px 20px" }}>
      <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--text-2)", letterSpacing:".08em", textTransform:"uppercase", fontWeight:600 }}>{label}</p>
      <p style={{ margin:0, fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</p>
      {sub && <p style={{ margin:"6px 0 0", fontSize:12, color:"var(--text-3)" }}>{sub}</p>}
    </div>
  );
}

function H2({ icon, title }: { icon:string; title:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
      <span>{icon}</span>
      <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:"var(--text-1)", letterSpacing:"-.01em" }}>{title}</h2>
      <div style={{ flex:1, height:1, background:"var(--border)" }} />
    </div>
  );
}

function Empty({ text, ok=false }: { text:string; ok?:boolean }) {
  return <p style={{ color: ok ? "var(--green)" : "var(--text-2)", fontSize:13, padding:"12px 0" }}>{ok ? "✅ " : "— "}{text}</p>;
}

function Loader() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"48px 0" }}>
      <div style={{ width:24, height:24, borderRadius:"50%", border:"2px solid var(--border)", borderTopColor:"var(--gold)", animation:"spin .75s linear infinite" }} />
      <span style={{ color:"var(--text-2)", fontSize:13 }}>Fetching live data…</span>
    </div>
  );
}

// ── Funnel table ──────────────────────────────────────────────────────────────
function FunnelTable({ rows }: { rows: FunnelRow[] }) {
  if (!rows.length) return <Empty text="No funnel data." />;
  const cols = [
    { k:"salesperson"    as keyof FunnelRow, label:"Salesperson",   color:"var(--text-1)",  pct:false },
    { k:"total_leads",     label:"Leads",        color:"var(--blue)",  pct:false },
    { k:"profiles_sent",   label:"Profiles",     color:"var(--amber)", pct:false },
    { k:"interviews_done", label:"Interviews",   color:"var(--gold)",  pct:false },
    { k:"deals_won",       label:"Won",          color:"var(--green)", pct:false },
    { k:"deals_missed",    label:"Missed",       color:"var(--red)",   pct:false },
    { k:"activation_pct",  label:"Activation",  color:"var(--amber)", pct:true  },
    { k:"conversion_pct",  label:"Conversion",  color:"var(--green)", pct:true  },
  ] as { k: keyof FunnelRow; label:string; color:string; pct:boolean }[];

  const th: React.CSSProperties = { textAlign:"left", padding:"10px 14px", color:"var(--text-2)", fontSize:11, fontWeight:600, letterSpacing:".07em", textTransform:"uppercase" as const, borderBottom:"1px solid var(--border)" };
  const td = (color:string): React.CSSProperties => ({ padding:"11px 14px", color, borderBottom:"1px solid #ffffff08" });

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:"#ffffff06" }}>{cols.map(c=><th key={c.k} style={th}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background="#F5C51808")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              {cols.map(c=>{
                const val = row[c.k];
                const num = parseFloat(String(val))||0;
                return (
                  <td key={c.k} style={td(c.color)}>
                    {c.pct
                      ? <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:100 }}><span style={{ minWidth:38, fontWeight:600 }}>{num}%</span><Bar pct={num} color={c.color} /></div>
                      : <span style={{ fontWeight: c.k==="salesperson" ? 600 : 400 }}>{val ?? "—"}</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Interview outcomes ────────────────────────────────────────────────────────
function Interviews({ rows }: { rows: InterviewRow[] }) {
  if (!rows.length) return <Empty text="No interview data." />;
  const th: React.CSSProperties = { textAlign:"left", padding:"10px 14px", color:"var(--text-2)", fontSize:11, fontWeight:600, letterSpacing:".07em", textTransform:"uppercase" as const, borderBottom:"1px solid var(--border)" };
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:"#ffffff06" }}>{["Owner","Completed","Deal","No Show","Cancelled","Postponed","Deal Rate"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background="#F5C51808")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              {[
                { v:r.owner,          c:"var(--text-1)", bold:true  },
                { v:r.completed,      c:"var(--gold)",   bold:false },
                { v:r.deal,           c:"var(--green)",  bold:false },
                { v:r.no_show,        c:"var(--red)",    bold:false },
                { v:r.cancelled,      c:"var(--text-3)", bold:false },
                { v:r.postponed,      c:"var(--text-3)", bold:false },
              ].map((cell,j)=>(
                <td key={j} style={{ padding:"11px 14px", color:cell.c, fontWeight:cell.bold?600:400, borderBottom:"1px solid #ffffff08" }}>{cell.v}</td>
              ))}
              <td style={{ padding:"11px 14px", borderBottom:"1px solid #ffffff08" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:100 }}>
                  <span style={{ color:"var(--green)", fontWeight:700, minWidth:40 }}>{r.deal_rate_pct ?? 0}%</span>
                  <Bar pct={parseFloat(String(r.deal_rate_pct))||0} color="var(--green)" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Missed deals ──────────────────────────────────────────────────────────────
function Missed({ rows }: { rows: MissedRow[] }) {
  if (!rows.length) return <Empty text="No missed deals — great work!" ok />;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {rows.map((r,i)=>(
        <div key={i} style={{ background:"#EF444408", border:"1px solid var(--border)", borderLeft:"3px solid var(--red)", borderRadius:8, padding:"12px 16px", display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:12, alignItems:"center" }}>
          <div>
            <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{r.employer_name||"—"}</p>
            <p style={{ margin:"3px 0 0", fontSize:11, color:"var(--text-2)" }}>{r.lead_owner||"Unassigned"}</p>
          </div>
          <p style={{ margin:0, fontSize:12, color:"var(--text-2)" }}>{r.nationality||"—"} · {r.type||"—"}</p>
          <Pill label={r.milestone_status||"missed"} color="var(--red)" />
          <p style={{ margin:0, fontSize:11, color:"var(--text-3)", whiteSpace:"nowrap" }}>{r.date||"—"}</p>
        </div>
      ))}
    </div>
  );
}

// ── Stale leads ───────────────────────────────────────────────────────────────
function Stale({ rows }: { rows: StaleRow[] }) {
  if (!rows.length) return <Empty text="All leads activated — nice!" ok />;
  const urg = (d:number) => d > 60 ? "var(--red)" : d > 30 ? "var(--amber)" : "var(--gold)";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {rows.map((r,i)=>{
        const c = urg(r.days_stale);
        return (
          <div key={i} style={{ background:`${c}06`, border:"1px solid var(--border)", borderLeft:`3px solid ${c}`, borderRadius:8, padding:"12px 16px", display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:12, alignItems:"center" }}>
            <div>
              <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{r.employer_name||"—"}</p>
              <p style={{ margin:"3px 0 0", fontSize:11, color:"var(--text-2)" }}>{r.contact_name||"—"}</p>
            </div>
            <p style={{ margin:0, fontSize:12, color:"var(--text-2)" }}>{r.lead_owner||"Unassigned"}</p>
            <Pill label={`${r.days_stale}d idle`} color={c} />
          </div>
        );
      })}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"funnel",     label:"Funnel",        icon:"🎯" },
  { id:"interviews", label:"Interviews",    icon:"🤝" },
  { id:"missed",     label:"Missed Deals",  icon:"❌" },
  { id:"stale",      label:"Stale Leads",   icon:"⏳" },
] as const;
type Tab = typeof TABS[number]["id"];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const [tab, setTab]       = useState<Tab>("funnel");
  const [loading, setLoading] = useState(false);
  const [ts, setTs]         = useState<string|null>(null);
  const [err, setErr]       = useState<string|null>(null);
  const [data, setData]     = useState<DashData>({ funnel:[], missed:[], stale:[], interview_outcomes:[] });

  const totalLeads  = data.funnel.reduce((s,r)=>s+(+r.total_leads||0),0);
  const totalWon    = data.funnel.reduce((s,r)=>s+(+r.deals_won||0),0);
  const totalMissed = data.funnel.reduce((s,r)=>s+(+r.deals_missed||0),0);
  const totalInt    = data.funnel.reduce((s,r)=>s+(+r.interviews_done||0),0);
  const avgConv     = data.funnel.length
    ? (data.funnel.reduce((s,r)=>s+(+r.conversion_pct||0),0)/data.funnel.length).toFixed(1)
    : "0.0";

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/sales", { cache:"no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setTs(new Date().toLocaleTimeString("en-SG",{ hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    } catch(e) { setErr(e instanceof Error ? e.message : "Fetch failed"); }
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); },[load]);

  return (
    <div style={{ minHeight:"100vh", background:"var(--page-bg)", padding:"28px 32px 60px", animation:"fade-in .3s ease" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#F5C518,#FFD700)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📊</div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, letterSpacing:"-.03em" }}>Sales Performance</h1>
            <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--text-2)" }}>
              Live lead-to-deal funnel · Legitstar
              {ts && <span style={{ color:"var(--text-3)" }}> · {ts}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={load} disabled={loading}
          style={{ background: loading ? "var(--border)" : "var(--gold)", color: loading ? "var(--text-3)" : "#000", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:700, cursor: loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", gap:7, fontFamily:"inherit" }}
          onMouseEnter={e=>{ if(!loading)(e.currentTarget.style.background="var(--gold-hover)"); }}
          onMouseLeave={e=>{ if(!loading)(e.currentTarget.style.background="var(--gold)"); }}
        >
          ⟳ {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {err && (
        <div style={{ background:"#EF444412", border:"1px solid #EF444440", borderRadius:8, padding:"12px 16px", marginBottom:24, fontSize:13, color:"var(--red)" }}>
          ⚠️ {err} — check Vercel env vars and Supabase execute_sql RPC.
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:28 }}>
        <KPI label="Total Leads"    value={totalLeads}          color="var(--blue)"  sub="All active" />
        <KPI label="Deals Won"      value={totalWon}            color="var(--green)" sub="Converted" />
        <KPI label="Missed Deals"   value={totalMissed}         color="var(--red)"   sub="Lost" />
        <KPI label="Interviews"     value={totalInt}            color="var(--amber)" sub="Completed / Deal" />
        <KPI label="Avg Conversion" value={`${avgConv}%`}       color="var(--gold)"  sub="All owners" />
        <KPI label="Stale Leads"    value={data.stale.length}   color="var(--amber)" sub=">14 days idle" />
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:2, marginBottom:20, background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:10, padding:4, width:"fit-content" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ background: tab===t.id ? "var(--gold)" : "transparent", color: tab===t.id ? "#000" : "var(--text-2)", border:"none", borderRadius:7, padding:"7px 16px", fontSize:13, fontWeight: tab===t.id ? 700 : 500, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"inherit", transition:"all .15s", position:"relative" }}
          >
            {t.icon} {t.label}
            {t.id==="missed" && data.missed.length > 0 && (
              <span style={{ background:"var(--red)", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{data.missed.length}</span>
            )}
            {t.id==="stale" && data.stale.length > 0 && (
              <span style={{ background:"var(--amber)", color:"#000", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{data.stale.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"24px 28px", minHeight:300 }}>
        {loading ? <Loader /> : (
          <>
            {tab==="funnel"     && <><H2 icon="🎯" title="Salesperson Funnel Performance" /><FunnelTable rows={data.funnel} /></>}
            {tab==="interviews" && <><H2 icon="🤝" title="Interview Outcomes by Relationship Owner" /><Interviews rows={data.interview_outcomes} /></>}
            {tab==="missed"     && <><H2 icon="❌" title="Missed Deals" /><Missed rows={data.missed} /></>}
            {tab==="stale"      && <><H2 icon="⏳" title="Stale Leads — No Profile Sent 14+ Days" /><Stale rows={data.stale} /></>}
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop:14, display:"flex", gap:20, flexWrap:"wrap", fontSize:11, color:"var(--text-3)" }}>
        {[["var(--blue)","Leads"],["var(--amber)","Profiles / Interviews"],["var(--green)","Won"],["var(--red)","Missed"],["var(--gold)","Conversion %"]].map(([c,l])=>(
          <span key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:c, display:"inline-block" }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
