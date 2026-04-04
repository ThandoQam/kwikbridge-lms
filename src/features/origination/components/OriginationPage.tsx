// @ts-nocheck
// KwikBridge LMS — Origination Page
// Application origination — intake, QA sign-off, pipeline
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Origination() {
    const [tab, setTab] = useState("all");
    const drafts = applications.filter(a=>a.status==="Draft");
    const expiredDrafts = drafts.filter(a=>a.expiresAt && a.expiresAt < Date.now());
    const tabs = [
      { key:"all", label:"All", count:applications.length },
      { key:"Draft", label:"Draft (QA Pending)", count:drafts.length },
      { key:"Submitted", label:"Submitted", count:applications.filter(a=>a.status==="Submitted").length },
      { key:"Underwriting", label:"Underwriting", count:applications.filter(a=>a.status==="Underwriting").length },
      { key:"Approved", label:"Approved", count:applications.filter(a=>a.status==="Approved").length },
      { key:"Declined", label:"Declined", count:applications.filter(a=>a.status==="Declined").length },
      { key:"Withdrawn", label:"Withdrawn", count:applications.filter(a=>a.status==="Withdrawn").length },
    ];
    const filtered = applications.filter(a => tab === "all" || a.status === tab).filter(a => !search || [a.id, cust(a.custId)?.name, prod(a.product)?.name].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    const assignableUsers = SYSTEM_USERS.filter(u => ["LOAN_OFFICER","CREDIT","CREDIT_SNR","CREDIT_HEAD"].includes(u.role));

    return (<div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>Loan Origination</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>Application intake, QA & document validation, assignment & pipeline management</p></div>
        {canDo("origination","create") && <Btn onClick={() => setModal("newApp")} icon={I.plus}>New Application</Btn>}
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Drafts (QA Pending)" value={drafts.length} sub={expiredDrafts.length > 0 ? `${expiredDrafts.length} expired` : ""} />
        <KPI label="Submitted" value={applications.filter(a=>a.status==="Submitted").length} sub="awaiting DD" />
        <KPI label="Underwriting" value={applications.filter(a=>a.status==="Underwriting").length} />
        <KPI label="Pipeline Value" value={fmt.cur(applications.filter(a=>["Draft","Submitted","Underwriting"].includes(a.status)).reduce((s,a)=>s+a.amount,0))} />
        <KPI label="Approved" value={applications.filter(a=>a.status==="Approved").length} />
        <KPI label="Declined" value={applications.filter(a=>a.status==="Declined").length} />
      </div>

      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table columns={[
        { label:"App ID", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Applicant", render:r=>cust(r.custId)?.name },
        { label:"Product", render:r=>prod(r.product)?.name || r.product },
        { label:"Amount", render:r=>fmt.cur(r.amount) },
        { label:"Term", render:r=>`${r.term}m` },
        { label:"Date", render:r=>fmt.date(r.submitted || r.createdAt) },
        { label:"Assigned To", render:r=>{
          const u = SYSTEM_USERS.find(x=>x.id===r.assignedTo);
          if (u) return <span style={{ fontSize:11 }}>{u.name}</span>;
          if (!["Submitted","Underwriting"].includes(r.status)) return <span style={{ fontSize:10, color:C.textMuted }}>—</span>;
          if (!canDo("origination","assign")) return <span style={{ fontSize:10, color:C.amber }}>Unassigned</span>;
          return <select onChange={e=>{if(e.target.value)assignApplication(r.id,e.target.value)}} defaultValue="" style={{ fontSize:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontFamily:"inherit", padding:"1px 3px" }}>
            <option value="">Assign...</option>
            {assignableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>;
        }},
        { label:"QA", render:r=> r.qaSignedOff ? <span style={{ fontSize:10, color:C.green }}>Passed</span> : r.qaFindings?.result==="Failed" ? <span style={{ fontSize:10, color:C.red }}>Failed</span> : r.status==="Draft" ? <span style={{ fontSize:10, color:C.amber }}>Pending</span> : <span style={{ fontSize:10, color:C.textMuted }}>—</span> },
        { label:"Status", render:r=>{
          if (r.status==="Draft" && r.expiresAt && r.expiresAt < Date.now()) return <Badge color="red">Expired</Badge>;
          return statusBadge(r.status);
        }},
        { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
          {r.status==="Draft" && !(r.expiresAt && r.expiresAt < Date.now()) && canDo("origination","update") && <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();qaSignOffApplication(r.id)}}>QA & Submit</Btn>}
          {["Draft","Submitted","Underwriting"].includes(r.status) && canDo("origination","update") && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setWithdrawId(r.id)}}>Withdraw</Btn>}
        </div> },
      ]} rows={filtered} onRowClick={r=>setDetail({type:"application",id:r.id})} />

      <Modal open={!!withdrawId} onClose={()=>setWithdrawId(null)} title={`Withdraw Application ${withdrawId}`} width={420}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>This will cancel the application. The customer can re-apply later.</div>
        <Field label="Reason for withdrawal"><Textarea value={withdrawReason} onChange={e=>setWithdrawReason(e.target.value)} rows={3} placeholder="Customer request / Duplicate / Failed validation..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <Btn variant="danger" onClick={()=>{withdrawApplication(withdrawId,withdrawReason);setWithdrawId(null);setWithdrawReason("")}}>Confirm Withdrawal</Btn>
          <Btn variant="ghost" onClick={()=>{setWithdrawId(null);setWithdrawReason("")}}>Cancel</Btn>
        </div>
      </Modal>
    </div>);
  }
