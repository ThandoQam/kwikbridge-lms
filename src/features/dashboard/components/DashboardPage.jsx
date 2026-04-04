// KwikBridge LMS — Dashboard Page
// Staff dashboard — KPIs, pipeline, recent activity, dev impact
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Dashboard() {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>{currentUser.name} · {ROLES[role]?.label} · {roleSummary[role] || ""}</p>
        </div>
        {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
      </div>

      {/* KPIs — tiered by role */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {/* Everyone sees portfolio total and loan count */}
        <KPI label="Total Loan Book" value={fmt.cur(totalBook)} sub={`${loans.length} active loans`} />
        {/* Tier 0-3: see full financial KPIs */}
        {tier <= 3 && <KPI label="Total Disbursed" value={fmt.cur(totalDisbursed)} />}
        {/* Origination roles see pipeline */}
        {canDo("origination","view") && <KPI label="Pipeline" value={fmt.cur(pipeAmt)} sub={`${pipeline.length} pending`} />}
        {/* Collections and above see arrears */}
        {canDo("collections","view") && <KPI label="Arrears" value={fmt.cur(arrAmt)} sub={`${arrLoans.length} accounts`} />}
        {/* Finance, Credit Head, Exec, Admin see ECL */}
        {canDo("provisioning","view") && <KPI label="ECL Provision" value={fmt.cur(ecl)} sub="IFRS 9" />}
        {/* Tier 0-2 see rate */}
        {tier <= 2 && <KPI label="Weighted Avg Rate" value={`${avgRate}%`} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: tier <= 2 ? "1fr 1fr 1fr" : tier <= 4 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        {/* IFRS 9 — Finance, Credit, Compliance, Exec, Admin */}
        {canDo("provisioning","view") && (
          <SectionCard title="IFRS 9 Staging">
            {[1, 2, 3].map(s => {
              const sl = loans.filter(l => l.stage === s);
              const pct = loans.length ? Math.round(sl.length / loans.length * 100) : 0;
              const bal = sl.reduce((sum, l) => sum + l.balance, 0);
              const colors = { 1: C.green, 2: C.amber, 3: C.red };
              const labels = { 1: "Performing", 2: "Underperforming", 3: "Non-performing" };
              return (<div key={s} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 4 }}>
                  <span>Stage {s}: {labels[s]}</span><span>{sl.length} ({pct}%) · {fmt.cur(bal)}</span>
                </div>
                <ProgressBar value={pct} color={colors[s]} />
              </div>);
            })}
          </SectionCard>
        )}
        {/* Pipeline — Origination/Credit/Exec/Admin */}
        {canDo("origination","view") && (
          <SectionCard title="Application Pipeline">
            {["Submitted","Underwriting","Approved","Declined"].map(s => {
              const count = applications.filter(a => a.status === s).length;
              const amt = applications.filter(a => a.status === s).reduce((sum, a) => sum + a.amount, 0);
              return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                {statusBadge(s)}<div style={{ textAlign:"right" }}><div style={{ fontSize:18, fontWeight:700, color:C.text }}>{count}</div><div style={{ fontSize:10, color:C.textMuted }}>{fmt.cur(amt)}</div></div>
              </div>);
            })}
          </SectionCard>
        )}
        {/* Impact — everyone */}
        <SectionCard title="Development Impact">
          {[["Jobs Supported", fmt.num(jobs)], ["BEE Level 1-2 Clients", customers.filter(c => c.beeLevel <= 2).length], ["Women-Owned (>50%)", customers.filter(c => (c.womenOwned||0) > 50).length], ["Youth-Owned (>50%)", customers.filter(c => (c.youthOwned||0) > 50).length], ["Disability-Owned (>50%)", customers.filter(c => (c.disabilityOwned||0) > 50).length], ["Avg Social Impact Score", applications.filter(a => a.socialScore).length > 0 ? Math.round(applications.filter(a => a.socialScore).reduce((s, a) => s + a.socialScore, 0) / applications.filter(a => a.socialScore).length) : "—"]].map(([l, v], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.textDim }}>{l}</span><span style={{ fontSize:18, fontWeight:700, color:C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* Statutory Deadlines — Compliance, Finance, Admin, Exec only */}
      {canDo("statutory","view") && (statutoryReports||[]).filter(r => r.status !== "Submitted").length > 0 && (
        <SectionCard title="NCR Statutory Reporting Deadlines" actions={<Btn size="sm" variant="ghost" onClick={() => setPage("statutory")}>View All {I.chev}</Btn>}>
          {(statutoryReports||[]).filter(r => r.status !== "Submitted").sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4).map(r => {
            const days = Math.ceil((new Date(r.dueDate) - new Date()) / 864e5);
            const uc = days < 0 ? C.red : days <= 30 ? C.red : days <= 60 ? C.amber : C.textDim;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, height: 36, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: uc, lineHeight: 1 }}>{days < 0 ? "!" : days}</div>
                  <div style={{ fontSize: 7, color: C.textMuted, fontWeight: 500 }}>{days < 0 ? "LATE" : "DAYS"}</div>
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
      )}

      {/* My Tasks — role-specific action items */}
      {(role === "LOAN_OFFICER" || role === "CREDIT" || role === "CREDIT_SNR" || role === "COLLECTIONS") && (
        <SectionCard title="My Tasks">
          {role === "LOAN_OFFICER" && applications.filter(a => a.status === "Submitted").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — awaiting DD initiation</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a => a.status === "Underwriting").map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{a.id}</span> — {cust(a.custId)?.name} — {fmt.cur(a.amount)} — underwriting in progress</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"application",id:a.id})}>Open</Btn>
            </div>
          ))}
          {role === "COLLECTIONS" && arrLoans.map(l => (
            <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <span><span style={{ fontWeight:600 }}>{l.id}</span> — {cust(l.custId)?.name} — {l.dpd} DPD — {fmt.cur(l.balance)}</span>
              <Btn size="sm" variant="secondary" onClick={()=>setDetail({type:"loan",id:l.id})}>Open</Btn>
            </div>
          ))}
          {role === "LOAN_OFFICER" && applications.filter(a=>a.status==="Submitted").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {(role === "CREDIT" || role === "CREDIT_SNR") && applications.filter(a=>a.status==="Underwriting").length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No pending tasks.</div>}
          {role === "COLLECTIONS" && arrLoans.length===0 && <div style={{ fontSize:12, color:C.textMuted }}>No delinquent accounts.</div>}
        </SectionCard>
      )}

      {/* Alerts — filtered by role relevance */}
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
    </div>);
  }
