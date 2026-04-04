// @ts-nocheck
// KwikBridge LMS — Provisioning Page
// IFRS 9 ECL — staging, PD/LGD/EAD, provisions
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Provisioning() {
    const totalECL = provisions.reduce((s,p)=>s+p.ecl,0);
    const totalEAD = provisions.reduce((s,p)=>s+p.ead,0);
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>IFRS 9 Impairment & Provisioning</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Expected Credit Loss calculation, staging & forward-looking ECL models</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KPI label="Total ECL Provision" value={fmt.cur(totalECL)} accent={C.purple} />
        <KPI label="Total EAD" value={fmt.cur(totalEAD)} accent={C.blue} />
        <KPI label="Coverage Ratio" value={fmt.pct(totalECL / totalEAD)} accent={C.amber} />
        <KPI label="Stage 2+3 Exposure" value={fmt.cur(provisions.filter(p=>p.stage>=2).reduce((s,p)=>s+p.ead,0))} accent={C.red} />
      </div>
      <SectionCard title="ECL by Loan">
        <Table columns={[
          { label:"Loan ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.loanId}</span> },
          { label:"Borrower", render:r=>cust(loans.find(l=>l.id===r.loanId)?.custId)?.name },
          { label:"Stage", render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge> },
          { label:"EAD", render:r=>fmt.cur(r.ead) },
          { label:"PD", render:r=>fmt.pct(r.pd) },
          { label:"LGD", render:r=>fmt.pct(r.lgd,0) },
          { label:"ECL", render:r=><span style={{ fontWeight:700, color:C.purple }}>{fmt.cur(r.ecl)}</span> },
          { label:"Method", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.method}</span> },
        ]} rows={provisions} />
        <div style={{ textAlign:"right", marginTop:14, fontSize:15, fontWeight:700, color:C.text }}>Total ECL: <span style={{ color:C.purple }}>{fmt.cur(totalECL)}</span></div>
      </SectionCard>
      <SectionCard title="IFRS 9 Stage Distribution">
        {[1,2,3].map(s => {
          const sp = provisions.filter(p=>p.stage===s);
          const ead = sp.reduce((sum,p)=>sum+p.ead,0);
          const ecl = sp.reduce((sum,p)=>sum+p.ecl,0);
          const colors = {1:C.green,2:C.amber,3:C.red};
          const labels = {1:"Performing (12-month ECL)",2:"Underperforming (Lifetime ECL)",3:"Credit-impaired (Lifetime ECL)"};
          return (<div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
            <div><Badge color={s===1?"green":s===2?"amber":"red"}>Stage {s}</Badge><span style={{ fontSize:12, color:C.textDim, marginLeft:10 }}>{labels[s]}</span></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:14, fontWeight:700, color:C.text }}>EAD: {fmt.cur(ead)}</div><div style={{ fontSize:12, color:colors[s] }}>ECL: {fmt.cur(ecl)}</div></div>
          </div>);
        })}
      </SectionCard>
    </div>);
  }
