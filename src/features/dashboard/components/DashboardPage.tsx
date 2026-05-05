/**
 * DashboardPage — main staff landing page.
 *
 * Portfolio KPIs, pipeline, my tasks, IFRS 9 staging summary,
 * statutory deadlines, alerts & widgets. Drag-to-reorder widget
 * panel with localStorage persistence.
 *
 * EXTRACTED FROM MONOLITH (Sprint 3/5, May 2026).
 * Uses context hooks for data, actions, UI navigation, and auth.
 * UI primitives + helpers passed as props.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface DashboardPageProps {
  // UI primitives
  KPI: any;
  Btn: any;
  Badge: any;
  SectionCard: any;
  ProgressBar: any;
  // Helpers + constants
  I: any;
  C: any;
  fmt: any;
  statusBadge: (s: string) => any;
  predictDelinquency: (loan: any, customer: any, collections: any[], payments: any[]) => any;
}

export function DashboardPage({
  KPI, Btn, Badge, SectionCard, ProgressBar,
  I, C, fmt, statusBadge, predictDelinquency,
}: DashboardPageProps) {
  // ═══ Context-driven dependencies ═══
  const {
    customers, applications, loans, products,
    audit, alerts, provisions, collections, cust, prod,
  } = useData();
  const { markRead } = useActions();
  const { setPage, setDetail, setModal } = useUI();
  const { canDo, currentUser, role } = useAuth();

    // ═══ Widget Customisation System ═══
    const WIDGET_DEFAULTS = [
      { id: "kpis", title: "KPI Summary", visible: true, locked: true },
      { id: "ifrs9", title: "IFRS 9 Staging", visible: true },
      { id: "pipeline", title: "Application Pipeline", visible: true },
      { id: "dpd", title: "DPD Distribution", visible: true },
      { id: "productMix", title: "Product Mix", visible: true },
      { id: "impact", title: "Development Impact", visible: true },
      { id: "statutory", title: "NCR Reporting Deadlines", visible: true },
      { id: "tasks", title: "My Tasks", visible: true },
      { id: "alerts", title: "Recent Alerts", visible: true },
    ];
    const [widgetConfig, setWidgetConfig] = useState(() => {
      try { const saved = localStorage.getItem("kb-widgets"); return saved ? JSON.parse(saved) : WIDGET_DEFAULTS; }
      catch { return WIDGET_DEFAULTS; }
    });
    const [showWidgetPanel, setShowWidgetPanel] = useState(false);
    const [dragWidget, setDragWidget] = useState(null);

    const toggleWidget = (id) => {
      const updated = widgetConfig.map(w => w.id === id && !w.locked ? { ...w, visible: !w.visible } : w);
      setWidgetConfig(updated);
      localStorage.setItem("kb-widgets", JSON.stringify(updated));
    };
    const moveWidget = (fromIdx, toIdx) => {
      const items = [...widgetConfig];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      setWidgetConfig(items);
      localStorage.setItem("kb-widgets", JSON.stringify(items));
    };
    const resetWidgets = () => {
      setWidgetConfig(WIDGET_DEFAULTS);
      localStorage.removeItem("kb-widgets");
    };
    const visibleWidgets = widgetConfig.filter(w => w.visible);

    const totalBook = loans.reduce((s, l) => s + l.balance, 0);
    const totalDisbursed = loans.reduce((s, l) => s + l.amount, 0);
    const arrLoans = loans.filter(l => l.dpd > 0);
    const arrAmt = arrLoans.reduce((s, l) => s + l.balance, 0);
    const ecl = provisions.reduce((s, p) => s + p.ecl, 0);
    const pipeline = applications.filter(a => ["Submitted","Underwriting"].includes(a.status));
    const pipeAmt = pipeline.reduce((s, a) => s + a.amount, 0);
    const avgRate = loans.length ? (loans.reduce((s, l) => s + l.rate, 0) / loans.length).toFixed(1) : 0;
    const jobs = customers.reduce((s, c) => s + c.employees, 0);
    const tier = ROLES[role]?.tier ?? 5;

    const roleSummary = {
      ADMIN: `${loans.length} active loans · ${pipeline.length} in pipeline · ${arrLoans.length} in arrears`,
      EXEC: `Portfolio: ${fmt.cur(totalBook)} · ${arrLoans.length} accounts in arrears · ECL: ${fmt.cur(ecl)}`,
      CREDIT_HEAD: `${pipeline.length} applications pending · ${arrLoans.length} in arrears · Risk score avg: ${Math.round(applications.filter(a=>a.riskScore).reduce((s,a)=>s+a.riskScore,0)/(applications.filter(a=>a.riskScore).length||1))}`,
      COMPLIANCE: `FICA pending: ${customers.filter(c=>c.ficaStatus!=="Verified").length} · BEE expiring (90d): ${customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length} · ${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} statutory reports due`,
      CREDIT_SNR: `${pipeline.length} applications in pipeline · ${applications.filter(a=>a.status==="Underwriting").length} in underwriting`,
      CREDIT: `${applications.filter(a=>a.status==="Underwriting").length} applications awaiting analysis · ${pipeline.length} total pipeline`,
      LOAN_OFFICER: `${customers.length} customers · ${pipeline.length} applications pending · ${arrLoans.filter(l=>l.dpd<=30).length} early arrears`,
      COLLECTIONS: `${arrLoans.length} delinquent accounts · ${arrLoans.filter(l=>l.dpd>30).length} mid/late stage · Total arrears: ${fmt.cur(arrAmt)}`,
      FINANCE: `Portfolio: ${fmt.cur(totalBook)} · ECL: ${fmt.cur(ecl)} · ${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} reports due`,
      AUDITOR: `${audit.length} audit entries · ${loans.length} active loans · ${applications.length} total applications`,
      VIEWER: `${loans.length} active loans · Portfolio: ${fmt.cur(totalBook)}`,
    };

    return (<div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text, letterSpacing:-0.3 }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>{currentUser.name} · {ROLES[role]?.label} · {roleSummary[role] || ""}</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="kb-cta-outline" onClick={() => setShowWidgetPanel(!showWidgetPanel)} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 12px", fontSize:11, fontWeight:500, color:C.textDim, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18"/><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Customise
          </button>
          {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
        </div>
      </div>

      {/* KPIs — tiered by role */}
      {/* Primary KPIs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
        <KPI label="Total Loan Book" value={fmt.cur(totalBook)} sub={`${loans.length} active loans`} trend={loans.length > 0 ? "up" : null} />
        {tier <= 3 && <KPI label="Total Disbursed" value={fmt.cur(totalDisbursed)} />}
        {canDo("origination","view") && <KPI label="Pipeline" value={fmt.cur(pipeAmt)} sub={`${pipeline.length} pending`} />}
        {canDo("collections","view") && <KPI label="Arrears" value={fmt.cur(arrAmt)} sub={`${arrLoans.length} accounts`} alert={arrLoans.length > 0} trend={arrLoans.length > 0 ? "down" : null} />}
      </div>
      {/* Secondary KPIs */}
      {(canDo("provisioning","view") || tier <= 2) && <div style={{ display: "flex", gap: 0, marginBottom: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
        {canDo("provisioning","view") && <KPI label="ECL Provision" value={fmt.cur(ecl)} sub="IFRS 9" />}
        {tier <= 2 && <KPI label="Weighted Avg Rate" value={`${avgRate}%`} />}
      </div>}

      
      {/* Widget Customisation Panel */}
      {showWidgetPanel && <div className="kb-widget-panel" style={{ position:"fixed", top:0, right:0, bottom:0, width:300, maxWidth:"100vw", background:C.surface, borderLeft:`1px solid ${C.border}`, boxShadow:"-4px 0 16px rgba(0,0,0,0.08)", zIndex:100, display:"flex", flexDirection:"column", fontFamily:"inherit" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:14, fontWeight:600, color:C.text }}>Customise Dashboard</div><div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Drag to reorder · Toggle visibility</div></div>
          <button onClick={() => setShowWidgetPanel(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:4 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
          {widgetConfig.map((w, idx) => (
            <div key={w.id}
              draggable={!w.locked}
              onDragStart={() => setDragWidget(idx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (dragWidget !== null && dragWidget !== idx) moveWidget(dragWidget, idx); setDragWidget(null); }}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", marginBottom:4, background:dragWidget === idx ? C.accentGlow : C.surface, border:`1px solid ${dragWidget === idx ? C.accent : C.border}`, borderRadius:6, cursor:w.locked ? "default" : "grab", transition:"background .15s, border-color .15s" }}>
              {!w.locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>}
              {w.locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ flexShrink:0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
              <span style={{ flex:1, fontSize:12, fontWeight:500, color:w.visible ? C.text : C.textMuted }}>{w.title}</span>
              {!w.locked && <button onClick={() => toggleWidget(w.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>
                <div style={{ width:32, height:18, borderRadius:9, background:w.visible ? C.accent : C.border, transition:"background .2s", position:"relative" }}>
                  <div style={{ width:14, height:14, borderRadius:7, background:"#fff", position:"absolute", top:2, left:w.visible ? 16 : 2, transition:"left .2s", boxShadow:"0 1px 2px rgba(0,0,0,0.15)" }} />
                </div>
              </button>}
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}` }}>
          <button onClick={resetWidgets} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 16px", fontSize:11, color:C.textDim, cursor:"pointer", width:"100%", fontFamily:"inherit" }}>Reset to Default</button>
        </div>
      </div>}

<div style={{ display: "grid", gridTemplateColumns: tier <= 4 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
        {/* IFRS 9 */}
        <div data-widget="ifrs9" style={{order:widgetConfig.findIndex(w=>w.id==="ifrs9")}}>{visibleWidgets.some(w=>w.id==="ifrs9") && canDo("provisioning","view") && (
          <SectionCard title="IFRS 9 Staging">
            {[1, 2, 3].map(s => {
              const sl = loans.filter(l => l.stage === s);
              const pct = loans.length ? Math.round(sl.length / loans.length * 100) : 0;
              const bal = sl.reduce((sum, l) => sum + l.balance, 0);
              const colors = { 1: C.green, 2: C.amber, 3: C.red };
              const labels = { 1: "Performing", 2: "Underperforming", 3: "Non-performing" };
              return (<div key={s} style={{ marginBottom:16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 4 }}>
                  <span>Stage {s}: {labels[s]}</span><span>{sl.length} ({pct}%) · {fmt.cur(bal)}</span>
                </div>
                <ProgressBar value={pct} color={colors[s]} />
              </div>);
            })}
          </SectionCard>
        )}</div>
        {/* DPD Distribution */}
        <div data-widget="dpd" style={{order:widgetConfig.findIndex(w=>w.id==="dpd")}}>{visibleWidgets.some(w=>w.id==="dpd") && canDo("provisioning","view") && loans.length > 0 && (
          <SectionCard title="DPD Distribution">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, padding: "0 4px" }}>
              {[{label:"Current",min:0,max:0,color:C.green},{label:"1-30",min:1,max:30,color:C.amber},{label:"31-60",min:31,max:60,color:C.amber},{label:"61-90",min:61,max:90,color:C.red},{label:"90+",min:91,max:9999,color:C.red}].map(b => {
                const count = loans.filter(l => l.dpd >= b.min && l.dpd <= b.max).length;
                const pct = loans.length ? count / loans.length : 0;
                const height = Math.max(4, pct * 100);
                return (<div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{count}</div>
                  <div style={{ width: "100%", maxWidth: 40, height: `${height}%`, background: b.color, borderRadius: "4px 4px 0 0", transition: "height .5s ease", minHeight: 4 }} />
                  <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap" }}>{b.label}</div>
                </div>);
              })}
            </div>
          </SectionCard>
        )}</div>

        {/* Product Mix */}
        <div data-widget="productMix" style={{order:widgetConfig.findIndex(w=>w.id==="productMix")}}>{visibleWidgets.some(w=>w.id==="productMix") && canDo("provisioning","view") && loans.length > 0 && (
          <SectionCard title="Product Mix">
            {(() => { const prodCounts = {}; loans.forEach(l => { const p = products.find(pp => pp.id === l.product); const name = p ? p.name.split(" — ")[0].split(" ").slice(0,2).join(" ") : l.product; prodCounts[name] = (prodCounts[name]||0) + 1; }); const entries = Object.entries(prodCounts).sort((a,b)=>b[1]-a[1]); const colors = [C.accent,C.accent,C.accent,C.accent,C.accent,C.accent,C.accent]; return entries.map(([name, count], i) => {
              const pct = loans.length ? Math.round(count / loans.length * 100) : 0;
              return (<div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{name}</span>
                  <span style={{ color: C.textDim }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: C.surface3, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: colors[i % colors.length], borderRadius: 4, transition: "width .5s ease" }} />
                </div>
              </div>);
            }); })()}
          </SectionCard>
        )}</div>

        {/* Pipeline */}
        <div data-widget="pipeline" style={{order:widgetConfig.findIndex(w=>w.id==="pipeline")}}>{visibleWidgets.some(w=>w.id==="pipeline") && canDo("origination","view") && (
          <SectionCard title="Application Pipeline">
            {["Submitted","Underwriting","Approved","Declined"].map(s => {
              const count = applications.filter(a => a.status === s).length;
              const amt = applications.filter(a => a.status === s).reduce((sum, a) => sum + a.amount, 0);
              return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
                {statusBadge(s)}<div style={{ textAlign:"right" }}><div style={{ fontSize:18, fontWeight:700, color:C.text }}>{count}</div><div style={{ fontSize:10, color:C.textMuted }}>{fmt.cur(amt)}</div></div>
              </div>);
            })}
          </SectionCard>
        )}</div>
        {/* Impact — everyone */}
        <div data-widget="impact" style={{order:widgetConfig.findIndex(w=>w.id==="impact")}}>{visibleWidgets.some(w=>w.id==="impact") && (
        <SectionCard title="Development Impact">
          {[["Jobs Supported", fmt.num(jobs)], ["BEE Level 1-2 Clients", customers.filter(c => c.beeLevel <= 2).length], ["Women-Owned (>50%)", customers.filter(c => (c.womenOwned||0) > 50).length], ["Youth-Owned (>50%)", customers.filter(c => (c.youthOwned||0) > 50).length], ["Disability-Owned (>50%)", customers.filter(c => (c.disabilityOwned||0) > 50).length], ["Avg Social Impact Score", applications.filter(a => a.socialScore).length > 0 ? Math.round(applications.filter(a => a.socialScore).reduce((s, a) => s + a.socialScore, 0) / applications.filter(a => a.socialScore).length) : "—"]].map(([l, v], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:18, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        )}</div>

        {/* AI Early Warning System */}
        <div data-widget="ews" style={{ order: widgetConfig.findIndex(w2=>w2.id==="ews") >= 0 ? widgetConfig.findIndex(w2=>w2.id==="ews") : 99 }}>
        <SectionCard title="AI Early Warning System">
          {loans.filter(l=>l.status==="Active").length === 0 ? <div style={{ fontSize:12, color:C.textMuted }}>No active loans to monitor</div> :
          loans.filter(l=>l.status==="Active").slice(0,5).map(l => {
            const ews = predictDelinquency(l, cust(l.custId), collections, l.payments);
            return <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{l.id} · {cust(l.custId)?.name}</div>
                <div style={{ fontSize:10, color:C.textDim }}>{ews.recommendation}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color: ews.ewsScore >= 70 ? C.green : ews.ewsScore >= 40 ? C.amber : C.red }}>{ews.ewsScore}</div>
                <Badge color={ews.riskLevel === "Low" ? "green" : ews.riskLevel === "Medium" ? "amber" : "red"}>{ews.riskLevel}</Badge>
              </div>
            </div>;
          })}
        </SectionCard>
        </div>
      </div>

      {/* Statutory Deadlines — Compliance, Finance, Admin, Exec only */}
      <div data-widget="statutory" style={{order:widgetConfig.findIndex(w=>w.id==="statutory")}}>{visibleWidgets.some(w=>w.id==="statutory") && canDo("statutory","view") && (statutoryReports||[]).filter(r => r.status !== "Submitted").length > 0 && (
        <SectionCard title="NCR Statutory Reporting Deadlines" actions={<Btn size="sm" variant="ghost" onClick={() => setPage("statutory")}>View All {I.chev}</Btn>}>
          {(statutoryReports||[]).filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4).map(r => {
            const days = Math.ceil((new Date(r.dueDate) - new Date()) / 864e5);
            const uc = days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap:16, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, height: 36, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: uc, lineHeight: 1 }}>{days < 0 ? "!" : days}</div>
                  <div style={{ fontSize:10, color: C.textMuted, fontWeight: 500 }}>{days < 0 ? "LATE" : "DAYS"}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Due: {fmt.date(new Date(r.dueDate))} · {r.submitTo}</div>
                </div>
                <Badge color={r.type === "Form 39" ? "blue" : "purple"}>{r.type}</Badge>
                {statusBadge(r.status)}
              </div>
            );
          })}
        </SectionCard>
      )}</div>

      {/* My Tasks — role-specific action items */}
      <div data-widget="tasks" style={{order:widgetConfig.findIndex(w=>w.id==="tasks")}}>{visibleWidgets.some(w=>w.id==="tasks") && (role === "LOAN_OFFICER" || role === "CREDIT" || role === "CREDIT_SNR" || role === "COLLECTIONS") && (
        <SectionCard title="My Tasks">
          {role === "LOAN_OFFICER" && applications.filter(a => a.status === "Submitted").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — awaiting DD initiation</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a => a.status === "Underwriting").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — underwriting in progress</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {role === "COLLECTIONS" && arrLoans.map(l => (
            <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{l.id}</span> — {cust(l.custId)?.name} — {l.dpd} DPD — {fmt.cur(l.balance)}</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"loan",id:l.id})}>Open</Btn>
            </div>
          ))}
          {role === "LOAN_OFFICER" && applications.filter(a=>a.status==="Submitted").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a=>a.status==="Underwriting").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {role === "COLLECTIONS" && arrLoans.length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No delinquent accounts.</div>}
        </SectionCard>
      )}</div>

      <div data-widget="alerts" style={{order:widgetConfig.findIndex(w=>w.id==="alerts")}}>{visibleWidgets.some(w=>w.id==="alerts") && (
      <SectionCard title="Recent Alerts" actions={canDo("governance","view") ? <Btn size="sm" variant="ghost" onClick={() => setPage("governance")}>View All</Btn> : null}>
        {alerts.filter(a => {
          if (tier <= 1) return true; // Admin/Exec see all
          if (role === "COMPLIANCE" && (a.type === "Compliance" || a.type === "Statutory" || a.type === "Regulatory")) return true;
          if (role === "COLLECTIONS" && (a.type === "Collections" || a.type === "EWS")) return true;
          if ((role === "CREDIT" || role === "CREDIT_SNR" || role === "CREDIT_HEAD") && (a.type === "Application" || a.type === "EWS" || a.type === "Portfolio")) return true;
          if (role === "LOAN_OFFICER" && (a.type === "Application" || a.type === "EWS" || a.type === "Compliance")) return true;
          if (role === "FINANCE" && (a.type === "Statutory" || a.type === "Portfolio")) return true;
          if (role === "AUDITOR") return true;
          return false;
        }).slice(0, 6).map(a => (
          <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 0", borderBottom:`1px solid ${C.border}`, opacity:a.read?0.4:1 }}>
            <div style={{ width:8, height:8, borderRadius:4, marginTop:5, flexShrink:0, background:a.severity==="critical"?C.red:a.severity==="warning"?C.amber:C.blue }} />
            <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:C.text }}>{a.title}</div><div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{a.msg}</div></div>
            <div style={{ fontSize:10, color:C.textMuted, whiteSpace:"nowrap" }}>{fmt.date(a.ts)}</div>
            {!a.read && <Btn size="sm" variant="ghost" onClick={() => markRead(a.id)}>Dismiss</Btn>}
          </div>
        ))}
        {alerts.length === 0 && <div style={{ fontSize:12, color:C.textMuted }}>No alerts.</div>}
      </SectionCard>
      )}</div>
    </div>);
}
