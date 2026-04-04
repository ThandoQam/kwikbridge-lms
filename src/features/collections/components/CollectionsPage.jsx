// KwikBridge LMS — Collections Page
// Delinquency management — PTP, restructuring, write-off
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Collections() {
    const activeLoans = loans.filter(l => l.status === "Active");
    const delinquent = activeLoans.filter(l => l.dpd > 0);
    const [tab, setTab] = useState("accounts");
    const ptps = collections.filter(c=>c.ptpDate);
    const pendingWriteOffs = collections.filter(c=>c.writeOff);
    const early = delinquent.filter(l=>l.dpd<=30);
    const mid = delinquent.filter(l=>l.dpd>30&&l.dpd<=90);
    const late = delinquent.filter(l=>l.dpd>90);

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Collections & Recovery</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>NCA-compliant delinquency management, PTP tracking, restructuring & legal recovery</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Early (1-30)" value={early.length} sub={fmt.cur(early.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Mid (31-90)" value={mid.length} sub={fmt.cur(mid.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Late (91+)" value={late.length} sub={fmt.cur(late.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Total Arrears" value={fmt.cur(delinquent.reduce((s,l)=>s+l.balance,0))} />
        <KPI label="Active PTPs" value={ptps.filter(p=>p.ptpDate>Date.now()).length} />
        <KPI label="Write-Off Proposals" value={pendingWriteOffs.length} />
      </div>

      <Tab tabs={[
        {key:"accounts",label:"Delinquent Accounts",count:delinquent.length},
        {key:"activity",label:"Activity Log",count:collections.length},
        {key:"ptp",label:"Promise-to-Pay",count:ptps.length},
        {key:"writeoff",label:"Write-Offs",count:pendingWriteOffs.length},
      ]} active={tab} onChange={setTab} />

      {tab==="accounts" && <Table columns={[
        { label:"Loan", render:r=><span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{r.id}</span> },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Balance", render:r=>fmt.cur(r.balance) },
        { label:"DPD", render:r=><span style={{ fontSize:18, fontWeight:700, color:r.dpd<=30?C.amber:C.red }}>{r.dpd}</span> },
        { label:"Stage", render:r=><Badge color={r.dpd<=30?"amber":r.dpd<=90?"red":"red"}>{r.dpd<=30?"Early":r.dpd<=90?"Mid":"Late"}</Badge> },
        { label:"Last Action", render:r=>{ const last=collections.filter(c=>c.loanId===r.id).sort((a,b)=>b.created-a.created)[0]; return last?<span style={{ fontSize:10, color:C.textDim }}>{last.action} ({fmt.date(last.created)})</span>:<span style={{ fontSize:10, color:C.textMuted }}>None</span>; }},
        { label:"Actions", render:r=>canDo("collections","create") ? <div style={{ display:"flex", gap:3 }}>
          <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Phone Call","Outbound call.",{channel:"Phone"})}}>Call</Btn>
          <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"ptp"})}}>PTP</Btn>
          {r.dpd>30&&<Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Letter of Demand","Formal NCA demand issued.",{channel:"Letter"})}}>Demand</Btn>}
          {r.dpd>30&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"restructure"})}}>Restructure</Btn>}
          {r.dpd>90&&<Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();addCollectionAction(r.id,"Legal Handover","Referred to Legal Department for recovery.",{channel:"Legal"})}}>Legal</Btn>}
          {r.dpd>90&&<Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();setActionModal({loanId:r.id,type:"writeoff"})}}>Write-Off</Btn>}
        </div> : <span style={{ fontSize:10, color:C.textMuted }}>View only</span> },
      ]} rows={delinquent.sort((a,b)=>b.dpd-a.dpd)} onRowClick={r=>setDetail({type:"loan",id:r.id})} />}

      {tab==="activity" && <Table columns={[
        { label:"Date", render:r=>fmt.date(r.created) },
        { label:"Loan", key:"loanId" },
        { label:"Borrower", render:r=>cust(r.custId)?.name },
        { label:"Stage", render:r=>statusBadge(r.stage) },
        { label:"Action", render:r=><span style={{ fontWeight:600 }}>{r.action}</span> },
        { label:"Channel", key:"channel" },
        { label:"Officer", key:"officer" },
        { label:"Notes", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:250, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.notes}</span> },
      ]} rows={[...collections].sort((a,b)=>b.created-a.created)} />}

      {tab==="ptp" && <div>
        <Table columns={[
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"PTP Date", render:r=>fmt.date(r.ptpDate) },
          { label:"PTP Amount", render:r=>fmt.cur(r.ptpAmount) },
          { label:"Status", render:r=>{
            if (!r.ptpDate) return <span style={{ color:C.textMuted }}>—</span>;
            const met = loans.find(l=>l.id===r.loanId)?.payments?.some(p=>p.date>=r.created&&p.amount>=r.ptpAmount);
            return met ? <Badge color="green">Honoured</Badge> : r.ptpDate > Date.now() ? <Badge color="amber">Pending</Badge> : <Badge color="red">Broken</Badge>;
          }},
          { label:"Officer", key:"officer" },
          { label:"Created", render:r=>fmt.date(r.created) },
        ]} rows={ptps.sort((a,b)=>b.created-a.created)} />
      </div>}

      {tab==="writeoff" && <div>
        <Table columns={[
          { label:"Loan", key:"loanId" },
          { label:"Borrower", render:r=>cust(r.custId)?.name },
          { label:"Balance", render:r=>fmt.cur(loans.find(l=>l.id===r.loanId)?.balance||0) },
          { label:"DPD", render:r=>r.dpd },
          { label:"Reason", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.notes}</span> },
          { label:"Proposed By", key:"officer" },
          { label:"Date", render:r=>fmt.date(r.created) },
          { label:"Action", render:r=>{
            const l = loans.find(x=>x.id===r.loanId);
            if (l?.status === "Written Off") return <Badge color="red">Written Off</Badge>;
            return canDo("collections","approve") ? <Btn size="sm" variant="danger" onClick={e=>{e.stopPropagation();approveWriteOff(r.loanId)}}>Approve Write-Off</Btn> : <Badge color="amber">Pending Approval</Badge>;
          }},
        ]} rows={pendingWriteOffs.sort((a,b)=>b.created-a.created)} />
      </div>}

      {/* PTP Modal */}
      <Modal open={actionModal?.type==="ptp"} onClose={()=>setActionModal(null)} title={`Promise-to-Pay — ${actionModal?.loanId}`} width={440}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Record a payment commitment from the customer.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Field label="PTP Date"><Input type="date" value={ptpForm.date} onChange={e=>setPtpForm({...ptpForm,date:e.target.value})} /></Field>
          <Field label="PTP Amount (R)"><Input type="number" value={ptpForm.amount} onChange={e=>setPtpForm({...ptpForm,amount:e.target.value})} /></Field>
        </div>
        <Field label="Notes"><Textarea value={ptpForm.notes} onChange={e=>setPtpForm({...ptpForm,notes:e.target.value})} rows={2} placeholder="Context from call..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn onClick={()=>{if(ptpForm.date&&ptpForm.amount){createPTP(actionModal.loanId,ptpForm.date,ptpForm.amount,ptpForm.notes);setActionModal(null);setPtpForm({date:"",amount:"",notes:""})}}} disabled={!ptpForm.date||!ptpForm.amount}>Record PTP</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Restructure Modal */}
      <Modal open={actionModal?.type==="restructure"} onClose={()=>setActionModal(null)} title={`Restructuring Proposal — ${actionModal?.loanId}`} width={480}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Propose a restructuring plan. Requires Credit Committee or Head of Credit approval.</div>
        <Field label="Restructure Type"><Select value={restructForm.type} onChange={e=>setRestructForm({...restructForm,type:e.target.value})} options={["Term Extension","Payment Holiday","Rate Reduction","Reduced Instalments","Combined"].map(v=>({value:v,label:v}))} /></Field>
        <Field label="Proposal Detail"><Textarea value={restructForm.detail} onChange={e=>setRestructForm({...restructForm,detail:e.target.value})} rows={3} placeholder="e.g. Extend term by 6 months with 3-month reduced payment plan..." /></Field>
        <Field label="Approval Required From"><Select value={restructForm.approver} onChange={e=>setRestructForm({...restructForm,approver:e.target.value})} options={["Collections Manager","Head of Credit","Credit Committee"].map(v=>({value:v,label:v}))} /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn onClick={()=>{if(restructForm.detail){proposeRestructure(actionModal.loanId,restructForm);setActionModal(null);setRestructForm({type:"Term Extension",detail:"",approver:"Credit Committee"})}}} disabled={!restructForm.detail}>Submit Proposal</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Write-Off Modal */}
      <Modal open={actionModal?.type==="writeoff"} onClose={()=>setActionModal(null)} title={`Write-Off Proposal — ${actionModal?.loanId}`} width={440}>
        <div style={{ fontSize:12, color:C.textDim, marginBottom:12 }}>Propose this loan for write-off. Requires Credit Committee approval.</div>
        <Field label="Reason / Justification"><Textarea value={writeOffReason} onChange={e=>setWriteOffReason(e.target.value)} rows={3} placeholder="e.g. Debtor absconded, no assets, recovery unviable..." /></Field>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <Btn variant="danger" onClick={()=>{if(writeOffReason){proposeWriteOff(actionModal.loanId,writeOffReason);setActionModal(null);setWriteOffReason("")}}} disabled={!writeOffReason}>Submit Write-Off Proposal</Btn>
          <Btn variant="ghost" onClick={()=>setActionModal(null)}>Cancel</Btn>
        </div>
      </Modal>
    </div>);
  }
