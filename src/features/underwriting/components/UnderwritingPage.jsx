// KwikBridge LMS — Underwriting Page
// Due diligence workflow — 8-step sequential gating
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Underwriting() {
    const pending = applications.filter(a => ["Submitted","Underwriting"].includes(a.status));
    const decided = applications.filter(a => ["Approved","Declined"].includes(a.status)).slice(-5);
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Credit Assessment & Underwriting</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Risk analysis, affordability, scoring & credit decisions</p>
      <SectionCard title={`Pending Decisions (${pending.length})`}>
        <Table columns={[
          { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
          { label:"Applicant", render:r=>cust(r.custId)?.name },
          { label:"Amount", render:r=>fmt.cur(r.amount) },
          { label:"Authority", render:r=>r.amount>1000000?"Credit Committee":r.amount>500000?"Head of Credit":r.amount>250000?"Senior Analyst":"Analyst" },
          { label:"Status", render:r=>statusBadge(r.status) },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:6 }}>{r.status==="Submitted"&&canDo("underwriting","update")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();moveToUnderwriting(r.id)}}>Start DD</Btn>}{r.status==="Underwriting"&&canDo("underwriting","view")&&<Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setDetail({type:"application",id:r.id})}}>Open Workflow</Btn>}</div> },
        ]} rows={pending} onRowClick={r=>setDetail({type:"application",id:r.id})} />
      </SectionCard>
      <SectionCard title="Recent Decisions">
        <Table columns={[
          { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontSize:12 }}>{r.id}</span> },
          { label:"Applicant", render:r=>cust(r.custId)?.name },
          { label:"Amount", render:r=>fmt.cur(r.amount) },
          { label:"Risk Score", render:r=>r.riskScore!=null?<span style={{ fontWeight:700, color:r.riskScore>=70?C.green:r.riskScore>=50?C.amber:C.red }}>{r.riskScore}</span>:"—" },
          { label:"DSCR", render:r=>r.dscr||"—" },
          { label:"Decision", render:r=>statusBadge(r.status) },
          { label:"Approver", key:"approver" },
        ]} rows={decided} onRowClick={r=>setDetail({type:"application",id:r.id})} />
      </SectionCard>
    </div>);
  }
