/**
 * DetailView — right-hand pane / drawer that displays detail for a
 * selected entity (customer, application, or loan).
 *
 * EXTRACTED FROM MONOLITH (Sprint 5/5, May 2026).
 * The largest extraction at 932 lines. Uses context hooks for all
 * shared dependencies. Page-local state for forms (detailEditing,
 * detailForm, etc.) lives inside this component.
 *
 * Renders three distinct entity types:
 *   - customer: customer profile, FICA/BEE status, document checklist
 *   - application: 8-step DD pipeline, credit memo, decision flow
 *   - loan: account details, payment history, collections, servicing
 *
 * Future refinement: split into CustomerDetail, ApplicationDetail,
 * LoanDetail components for testability and code review.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { Badge, Btn, C, Field, I, InfoGrid, Input, KPI, ProgressBar, SectionCard, Select, Table, statusBadge } from '../../../components/ui';
import { cell, fmt } from '../../../lib/format';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface DetailViewProps {
// UI primitives
  // Helpers
  // Constants/data
  ROLES: any;
  SECURITY_INSTRUMENTS: any;
  KYB_FICA_DOCS: any;
  ddSteps: any;
  getProductSecurity: any;
  navTo: (page: string) => void;
}

export function DetailView({
  ROLES,
  SECURITY_INSTRUMENTS,
  KYB_FICA_DOCS,
  ddSteps,
  getProductSecurity,
  navTo,
}: DetailViewProps) {
  // ═══ Context-driven dependencies ═══
  const {
    customers, applications, loans, products,
    documents, audit, alerts, provisions, comms, collections,
    cust, prod, addAudit, data, save,
  } = useData();
  const {
    updateCustomer, updateFicaStatus, updateBeeStatus,
    decideLoan, bookLoan, disburseLoan, recordPayment,
    addCollectionAction, submitRecommendation, approveDocument,
    generateLoanAgreement, generateSecurityDoc,
    saveAnalystNotes, updateFindingNote,
    saveSiteVisitNotes, saveSiteVisitField, saveSiteVisitRating,
    saveCreditFinding, runDDStep,
  } = useActions();
  const {
    setPage, detail, setDetail, showToast,
    viewingDoc, setViewingDoc,
    securitySelections, setSecuritySelections,
  } = useUI();
  const { currentUser, role, canDo } = useAuth();

    // ═══ Page-local state (was in monolith, now scoped to DetailView) ═══
    const [detailEditing, setDetailEditing] = useState(false);
    const [detailForm, setDetailForm] = useState({});
    const [detailBeeForm, setDetailBeeForm] = useState({level:3,expiry:""});
    const [expandedStep, setExpandedStep] = useState(null);
    const [notifForm, setNotifForm] = useState({subject:"",body:""});
    const [reqDocType, setReqDocType] = useState("");

    const goBack = () => setDetail(null);
    const BackBtn = () => <button onClick={goBack} style={{ background:"none", border:"none", color:C.accent, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex", alignItems:"center", gap:4, fontFamily:"inherit" }}>{I.back} Back</button>;

    if (detail.type === "customer") {
      const c = customers.find(x=>x.id===detail.id); if (!c) return <div>Not found</div>;
      const ca = applications.filter(a=>a.custId===c.id);
      const cl = loans.filter(l=>l.custId===c.id);
      const custDocs = (documents||[]).filter(d=>d.custId===c.id);

      const ficaActions = {
        "Pending": [{ label:"Start KYC Review", target:"Under Review" }],
        "Under Review": [{ label:"Verify (FICA Pass)", target:"Verified" }, { label:"Fail", target:"Failed" }],
        "Failed": [{ label:"Re-submit for Review", target:"Under Review" }],
        "Verified": [{ label:"Mark Expired", target:"Expired" }],
        "Expired": [{ label:"Re-submit for Review", target:"Under Review" }],
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.textDim, fontSize:16, fontWeight:600 }}>{c.name.charAt(0)}</div>
          <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>{c.name}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c.id} · {c.industry} · {c.province}</p></div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>{statusBadge(c.ficaStatus)}<Badge color="purple">BEE Level {c.beeLevel}</Badge><Badge color={c.riskCategory==="Low"?"green":c.riskCategory==="Medium"?"amber":"red"}>{c.riskCategory} Risk</Badge></div>
        </div>

        {/* Profile — read or edit */}
        <SectionCard title="Customer Profile" actions={canDo("customers","update") && !detailEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setDetailForm({...c});setDetailEditing(true)}}>Edit</Btn> : null}>
          {!detailEditing ? (
            <InfoGrid items={[["Contact",c.contact],["Email",c.email],["Phone",c.phone],["ID Number",c.idNum],["Reg Number",c.regNum],["Address",c.address],["Annual Revenue",fmt.cur(c.revenue)],["Employees",c.employees],["Years in Business",c.years],["Sector",c.sector],["BEE Expiry",fmt.date(c.beeExpiry)],["Women Ownership",(c.womenOwned||0)+"%"],["Youth Ownership",(c.youthOwned||0)+"%"],["Disability Ownership",(c.disabilityOwned||0)+"%"],["FICA Date",fmt.date(c.ficaDate)],["Created",fmt.date(c.created)]]} />
          ) : (
            <div>
              <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Business Name"><Input value={detailForm.name} onChange={e=>setDetailForm({...detailForm,name:e.target.value})} /></Field>
                <Field label="Contact"><Input value={detailForm.contact} onChange={e=>setDetailForm({...detailForm,contact:e.target.value})} /></Field>
                <Field label="Email"><Input value={detailForm.email} onChange={e=>setDetailForm({...detailForm,email:e.target.value})} /></Field>
              </div>
              <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Phone"><Input value={detailForm.phone} onChange={e=>setDetailForm({...detailForm,phone:e.target.value})} /></Field>
                <Field label="Industry"><Select value={detailForm.industry} onChange={e=>setDetailForm({...detailForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Revenue"><Input type="number" value={detailForm.revenue} onChange={e=>setDetailForm({...detailForm,revenue:+e.target.value})} /></Field>
                <Field label="Employees"><Input type="number" value={detailForm.employees} onChange={e=>setDetailForm({...detailForm,employees:+e.target.value})} /></Field>
              </div>
              <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Address"><Input value={detailForm.address} onChange={e=>setDetailForm({...detailForm,address:e.target.value})} /></Field>
                <Field label="Province"><Select value={detailForm.province} onChange={e=>setDetailForm({...detailForm,province:e.target.value})} options={["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Risk Category"><Select value={detailForm.riskCategory} onChange={e=>setDetailForm({...detailForm,riskCategory:e.target.value})} options={["Low","Medium","High"].map(v=>({value:v,label:v}))} /></Field>
              </div>
              <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Women Ownership %"><Input type="number" min="0" max="100" value={detailForm.womenOwned||0} onChange={e=>setDetailForm({...detailForm,womenOwned:+e.target.value})} /></Field>
                <Field label="Youth Ownership %"><Input type="number" min="0" max="100" value={detailForm.youthOwned||0} onChange={e=>setDetailForm({...detailForm,youthOwned:+e.target.value})} /></Field>
                <Field label="Disability Ownership %"><Input type="number" min="0" max="100" value={detailForm.disabilityOwned||0} onChange={e=>setDetailForm({...detailForm,disabilityOwned:+e.target.value})} /></Field>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>{updateCustomer(c.id,detailForm);setDetailEditing(false)}}>Save Changes</Btn>
                <Btn variant="ghost" onClick={()=>setDetailEditing(false)}>Cancel</Btn>
              </div>
            </div>
          )}
        </SectionCard>

        {/* FICA / KYC Status & Workflow */}
        <SectionCard title="FICA / KYC Verification">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>Status: {c.ficaStatus}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{c.ficaDate ? `Verified: ${fmt.date(c.ficaDate)}` : "Not yet verified"}</div>
            </div>
            <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
              {canDoAny("customers",["update"]) && (ficaActions[c.ficaStatus]||[]).map((a,i) => (
                <Btn key={i} size="sm" variant={a.target==="Verified"?"default":a.target==="Failed"?"danger":"secondary"} onClick={()=>updateFicaStatus(c.id, a.target)}>{a.label}</Btn>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>
            FICA verification flow: Pending → Under Review → Verified / Failed. Verified status can expire. Failed can be re-submitted. All transitions are audited.
          </div>
        </SectionCard>

        {/* BEE Verification */}
        <SectionCard title="BEE Verification">
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>BEE Level {c.beeLevel} — {c.beeStatus}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{c.beeExpiry ? `Expires: ${fmt.date(c.beeExpiry)}${c.beeExpiry < now + 90*day ? " ⚠ Expiring soon" : ""}` : "No expiry date"}</div>
            </div>
            {canDoAny("customers",["update"]) && <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
              {c.beeStatus !== "Verified" && <Btn size="sm" onClick={()=>updateBeeStatus(c.id,"Verified",detailBeeForm.level,detailBeeForm.expiry)}>Verify BEE</Btn>}
              {c.beeStatus === "Verified" && <Btn size="sm" variant="secondary" onClick={()=>updateBeeStatus(c.id,"Expired",null,null)}>Mark Expired</Btn>}
              <Btn size="sm" variant="ghost" onClick={()=>updateBeeStatus(c.id,"Pending Review",null,null)}>Reset</Btn>
            </div>}
          </div>
          {canDoAny("customers",["update"]) && (
            <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
              <Field label="BEE Level"><Select value={detailBeeForm.level} onChange={e=>setDetailBeeForm({...detailBeeForm,level:e.target.value})} options={[1,2,3,4,5,6,7,8].map(v=>({value:v,label:`Level ${v}`}))} /></Field>
              <Field label="Certificate Expiry"><Input type="date" value={detailBeeForm.expiry} onChange={e=>setDetailBeeForm({...detailBeeForm,expiry:e.target.value})} /></Field>
            </div>
          )}
        </SectionCard>

        {/* Documents */}
        <SectionCard title={`Documents (${custDocs.length})`} actions={<Btn size="sm" variant="ghost" onClick={()=>{setDetail(null);setPage("documents")}}>View All</Btn>}>
          <Table columns={[
            {label:"ID", render:r=><span style={{fontFamily:"monospace",fontSize:10}}>{r.id}</span>},
            {label:"Document", render:r=><span style={{fontWeight:500}}>{r.name}</span>},
            {label:"Category", render:r=><span style={{fontSize:11,color:C.textDim}}>{r.category}</span>},
            {label:"Status", render:r=>statusBadge(r.status)},
            {label:"Expiry", render:r=>{
              if(!r.expiryDate) return <span style={{fontSize:10,color:C.textMuted}}>—</span>;
              const d=Math.ceil((r.expiryDate-now)/day);
              return <span style={{fontSize:11,fontWeight:d<=30?600:400,color:d<=30?C.red:d<=90?C.amber:C.textDim}}>{fmt.date(r.expiryDate)}</span>;
            }},
            {label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
              {canDo("documents","approve") && r.status!=="Verified" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();approveDocument(r.id)}}>Approve</Btn>}
              {canDo("documents","update") && r.status!=="Rejected" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();rejectDocument(r.id,"Re-submission required.")}}>Reject</Btn>}
            </div>},
          ]} rows={custDocs} />
        </SectionCard>

        {/* Applications */}
        {ca.length>0 && <SectionCard title={`Applications (${ca.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Product",render:r=>prod(r.product)?.name},{label:"Amount",render:r=>cell.money(r.amount)},{label:"Status",render:r=>statusBadge(r.status)}]} rows={ca} onRowClick={r=>setDetail({type:"application",id:r.id})} />
        </SectionCard>}

        {/* Loans */}
        {cl.length>0 && <SectionCard title={`Active Loans (${cl.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Balance",render:r=>cell.money(r.balance)},{label:"DPD",render:r=>cell.count(r.dpd)},{label:"Stage",render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge>}]} rows={cl} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
        </SectionCard>}
      </div>);
    }

    if (detail.type === "application") {
      const a = applications.find(x=>x.id===detail.id); if (!a) return <div>Not found</div>;
      const c = cust(a.custId); const p = prod(a.product);
      const w = a.workflow || {};
      const isUW = a.status === "Underwriting";
      const isSub = a.status === "Submitted";
      const isDecided = ["Approved","Declined"].includes(a.status);
      const appDocs = (documents||[]).filter(d => d.custId === a.custId && (d.appId === a.id || !d.appId));
      const allDDComplete = w.kycComplete && w.docsComplete && w.siteVisitComplete && w.financialAnalysisComplete && w.collateralAssessed && w.socialVerified;

      const steps = [
        { key:"submitted", label:"1. Application Received & QA", done:!!a.qaSignedOff, hasData:true, detail: a.qaSignedOff ? `QA passed ${fmt.date(a.qaDate)} by ${a.qaOfficer}` : a.qaFindings?.result === "Failed" ? "QA failed — resolve issues" : "Awaiting QA sign-off" },
        { key:"kyc", label:"2. KYC/FICA & Sanctions", done:w.kycComplete, hasData:!!w.kycDate, canRun:isUW, gateOk:!!a.qaSignedOff, gateMsg:"Complete Step 1 (QA sign-off) first", runLabel:w.kycDate?"Re-run Checks":"Run Automated Checks" },
        { key:"docs", label:"3. Document Completeness Review", done:w.docsComplete, hasData:!!w.docsDate, canRun:isUW, gateOk:w.kycComplete, gateMsg:"Complete Step 2 (KYC/FICA) first", runLabel:w.docsDate?"Re-check":"Run Document Check" },
        { key:"sitevisit", label:"4. Site Visit & Management Interview", done:w.siteVisitComplete, hasData:!!w.siteVisitDate, canRun:isUW, gateOk:w.docsComplete, gateMsg:"Complete Step 3 (Document Review) first", runLabel:w.siteVisitDate?"Re-generate":"Generate Findings" },
        { key:"credit", label:"5. Credit Bureau & Financial Analysis", done:w.financialAnalysisComplete, hasData:!!w.creditDate, canRun:isUW, gateOk:w.kycComplete&&w.docsComplete&&w.siteVisitComplete, gateMsg:"Complete Steps 2–4 first", runLabel:w.creditPulled?"Re-analyse":"Pull Credit & Analyse" },
        { key:"collateral", label:"6. Collateral & Security Assessment", done:w.collateralAssessed, hasData:!!w.collateralDate, canRun:isUW, gateOk:w.siteVisitComplete, gateMsg:"Complete Step 4 (Site Visit) first", runLabel:w.collateralDate?"Re-assess":"Run Assessment" },
        { key:"social", label:"7. Social Impact & BEE Verification", done:w.socialVerified, hasData:!!w.socialDate, canRun:isUW, gateOk:w.kycComplete, gateMsg:"Complete Step 2 (KYC/FICA) first", runLabel:w.socialDate?"Re-verify":"Run Verification" },
        { key:"decision", label:"8. Credit Decision", done:isDecided, hasData:isDecided },
      ];
      const doneCount = steps.filter(s=>s.done).length - 1;

      const renderChecklist = (findings, stepKey) => {
        if (!findings || !Array.isArray(findings)) return null;
        const isActionable = isUW && (stepKey==="kyc"||stepKey==="docs");
        const reqItems = findings.filter(f => {
          if (f.inherited) return false; // KYC docs inherited from step 2 — skip
          if (stepKey==="docs" && f.required===false) return false;
          return true;
        });
        const allActioned = isActionable && reqItems.every(f => f.officerAction);
        return (<div>
          <div style={{ border:`1px solid ${C.border}` }}>
            {findings.map((f,i) => {
              const doc = f.docId ? (documents||[]).find(d=>d.id===f.docId) : null;
              const isExpanded = viewingDoc === `${stepKey}-${i}`;
              const isInherited = f.inherited;
              return (
              <div key={i} style={{ borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none", opacity:isInherited?0.6:1 }}>
                <div style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, alignItems:"center" }}>
                  <span style={{ width:40, flexShrink:0, fontWeight:500, color: f.status==="Pass"||f.status==="Verified"||f.status==="Confirmed (Override)"?C.green : f.status==="Flagged"?C.amber : f.status==="Rejected"||f.status==="Fail"||f.status==="Missing"?C.red : f.status==="Pending KYC"?C.amber : C.textMuted }}>{f.officerAction?f.status:(f.systemResult||f.status)}</span>
                  <span style={{ width:130, flexShrink:0, fontWeight:500, color:isInherited?C.textDim:C.text, fontSize:11 }}>{f.item}</span>
                  <span style={{ flex:1, color:C.textDim, fontSize:11 }}>{f.detail}{f.source?` (${f.source})`:""}{f.purpose&&!isInherited?<span style={{ color:C.textMuted, fontSize:10 }}> — {f.purpose}</span>:""}</span>
                  {/* View Document button */}
                  {doc && !isInherited && <button onClick={()=>setViewingDoc(isExpanded?null:`${stepKey}-${i}`)} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:isExpanded?C.surface2:"transparent", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontWeight:isExpanded?600:400 }}>{isExpanded?"Close":"View"}</button>}
                  {/* Request button — shown for Missing non-inherited docs */}
                  {!doc && !isInherited && f.systemResult==="Missing" && isUW && (() => {
                    const reqs = (w.docRequests||[]).filter(r=>r.docType===f.item);
                    const lastReq = reqs[reqs.length-1];
                    return lastReq
                      ? <span style={{ fontSize:10, color:C.textMuted, flexShrink:0 }}>Requested {fmt.date(lastReq.requestedAt)} by {lastReq.requestedBy}</span>
                      : <button onClick={()=>requestDocFromApplicant(a.id,f.item,"")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Request</button>;
                  })()}
                  {/* Inherited indicator */}
                  {isInherited && <span style={{ fontSize:10, color:C.textMuted, flexShrink:0, fontStyle:"italic" }}>from Step 2</span>}
                  {/* Confirm / Flag / Reject — only for non-inherited items */}
                  {isActionable && !isInherited && !f.officerAction && (
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Confirmed","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Flagged","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.amber, cursor:"pointer", fontFamily:"inherit" }}>Flag</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Rejected","")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </div>
                  )}
                  {isActionable && !isInherited && f.officerAction && <span style={{ fontSize:10, color:C.textMuted, flexShrink:0 }}>{f.officerAction}</span>}
                  {/* Doc-level approve/reject — only for non-inherited items */}
                  {doc && !isInherited && isUW && doc.status!=="Verified" && canDo("documents","approve") && <button onClick={()=>approveDocument(doc.id,a.id)} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Approve Doc</button>}
                  {doc && !isInherited && isUW && doc.status!=="Rejected" && canDo("documents","update") && <button onClick={()=>rejectDocument(doc.id,"Re-submission required.")} style={{ padding:"1px 5px", fontSize:10, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject Doc</button>}
                </div>
                {/* Expanded document detail panel */}
                {isExpanded && doc && (
                  <div style={{ padding:"8px 8px 8px 46px", background:C.surface2, borderTop:`1px solid ${C.border}` }}>
                    <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, fontSize:10 }}>
                      <div><span style={{ color:C.textMuted }}>Document ID:</span> <span style={{ fontFamily:"monospace", fontWeight:500 }}>{doc.id}</span></div>
                      <div><span style={{ color:C.textMuted }}>Name:</span> <span style={{ fontWeight:500 }}>{doc.name}</span></div>
                      <div><span style={{ color:C.textMuted }}>Category:</span> {doc.category}</div>
                      <div><span style={{ color:C.textMuted }}>Status:</span> <span style={{ fontWeight:600, color:doc.status==="Verified"?C.green:doc.status==="Rejected"?C.red:C.amber }}>{doc.status}</span></div>
                      <div><span style={{ color:C.textMuted }}>Uploaded By:</span> {doc.uploadedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Uploaded:</span> {fmt.date(doc.uploadedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Verified By:</span> {doc.verifiedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Verified:</span> {fmt.date(doc.verifiedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Expiry:</span> {doc.expiryDate ? <span style={{ color: doc.expiryDate < now + 90*day ? C.red : C.textDim }}>{fmt.date(doc.expiryDate)}</span> : "None"}</div>
                      <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>File:</span> <span style={{ fontFamily:"monospace", fontSize:10 }}>{doc.fileRef||"—"}</span></div>
                      {doc.notes && <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>Notes:</span> {doc.notes}</div>}
                    </div>
                  </div>
                )}
                {/* Officer note input */}
                {isActionable && f.officerAction && (
                  <div style={{ padding:"0 8px 4px 46px" }}>
                    <input value={f.officerNote||""} onChange={e=>updateFindingNote(a.id,stepKey,i,e.target.value)} placeholder="Note..." style={{ width:"100%", padding:"2px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {isActionable && <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.textMuted }}>{allActioned?"Ready for sign-off.":`${reqItems.filter(f=>f.officerAction).length}/${reqItems.length} reviewed.`}</span>
            <Btn size="sm" onClick={()=>signOffStep(a.id,stepKey)} disabled={!allActioned}>Sign Off</Btn>
          </div>}
        </div>);
      };

      const renderReadOnly = (findings) => {
        if (!findings || !Array.isArray(findings)) return null;
        return (<div style={{ border:`1px solid ${C.border}` }}>
          {findings.map((f,i) => (
            <div key={i} style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ width:140, flexShrink:0, fontWeight:500, color:C.text }}>{f.item}</span>
              <span style={{ flex:1, color:C.textDim, lineHeight:1.5 }}>{f.detail}</span>
            </div>
          ))}
        </div>);
      };

      const renderStepBody = (s) => {
        if (s.key==="submitted") return (<div>
          <InfoGrid items={[["Applicant",c?.name],["Product",p?.name],["Amount",fmt.cur(a.amount)],["Term",`${a.term}m`],["Created",fmt.date(a.createdAt||a.submitted)],["Purpose",a.purpose]]} />
          {a.qaFindings && <div style={{ marginTop:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:4 }}>QA Document Check</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {(a.qaFindings.mandatoryDocs||[]).map((d,i) => (
                <div key={i} style={{ display:"flex", gap:8, padding:"4px 8px", fontSize:11, borderBottom:i<(a.qaFindings.mandatoryDocs.length-1)?`1px solid ${C.border}`:"none" }}>
                  <span style={{ width:40, fontWeight:500, color:d.onFile && d.status!=="Pending" && d.status!=="Rejected" ? C.green : C.red }}>{d.onFile && d.status!=="Pending" && d.status!=="Rejected" ? "OK" : d.status}</span>
                  <span style={{ width:140, fontWeight:500 }}>{d.type}</span>
                  <span style={{ color:C.textDim }}>{d.docId || "Not on file"}{d.status ? ` — ${d.status}` : ""}</span>
                </div>
              ))}
            </div>
            {a.qaFindings.missingDocs?.length > 0 && <div style={{ fontSize:11, color:C.red, marginTop:4 }}>Missing: {a.qaFindings.missingDocs.join(", ")}</div>}
            {a.qaFindings.incompleteDocs?.length > 0 && <div style={{ fontSize:11, color:C.amber, marginTop:2 }}>Incomplete: {a.qaFindings.incompleteDocs.join(", ")}</div>}
            <div style={{ fontSize:10, color:a.qaFindings.result==="Passed"?C.green:C.red, marginTop:4, fontWeight:600 }}>
              QA Result: {a.qaFindings.result}{a.qaFindings.officer ? ` — ${a.qaFindings.officer} on ${fmt.date(a.qaFindings.passedAt)}` : ""}
            </div>
          </div>}
          {a.expiresAt && a.status === "Draft" && <div style={{ fontSize:10, color: a.expiresAt < Date.now() ? C.red : C.amber, marginTop:8 }}>
            {a.expiresAt < Date.now() ? `EXPIRED on ${fmt.date(a.expiresAt)}` : `Expires: ${fmt.date(a.expiresAt)} (${Math.ceil((a.expiresAt - Date.now())/day)} days remaining)`}
          </div>}
        </div>);
        if (s.key==="kyc") return (<div>
          {!w.kycDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Verify applicant identity and regulatory compliance: ID against Home Affairs, company registration against CIPC, bank account confirmation, address verification, sanctions screening (OFAC/UN/SA), and PEP check. Each item requires your review and sign-off.</div>}
          {w.kycFindings && renderChecklist(w.kycFindings, "kyc")}
          {w.kycComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.kycOfficer}</div>}
        </div>);
        if (s.key==="docs") return (<div>
          {!w.docsDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Check application document completeness. KYC documents (ID, PoA, Bank, Registration) carry forward from Step 2. This step verifies financial statements, business plan, and any industry-specific documents are on file and adequate for underwriting.</div>}
          {w.docsFindings && renderChecklist(w.docsFindings, "docs")}
          {isUW && <div style={{ marginTop:8, padding:"8px 8px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Request Document from Applicant</div>
            <div style={{ display:"flex", gap:4 }}>
              <input value={reqDocType} onChange={e=>setReqDocType(e.target.value)} placeholder="Document type..." style={{ flex:1, padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
              <Btn size="sm" variant="secondary" onClick={()=>{if(reqDocType){requestDocFromApplicant(a.id,reqDocType,"");setReqDocType("")}}}>Send</Btn>
            </div>
          </div>}
          {w.docsComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.docsOfficer}</div>}
        </div>);
        if (s.key==="sitevisit") {
          const findings = w.siteVisitFindings || [];
          const isOldFormat = findings.length > 0 && findings[0].field === undefined;
          const filledCount = findings.filter(f => f.value && f.value.trim().length > 10).length;
          const allFilled = findings.length > 0 && !isOldFormat && findings.every(f => f.value && f.value.trim().length > 5);
          return (<div>
          {!w.siteVisitDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Click "Generate Findings" to create the site visit assessment form. Complete each field after the physical visit, then sign off.</div>}
          {isOldFormat && <div style={{ padding:12, background:C.amberBg, border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Site visit data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-generate" above to create the interactive assessment form. You will need to re-enter your observations.</div>
          </div>}
          {findings.length > 0 && !isOldFormat && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:8 }}>{filledCount}/{findings.length} sections completed{allFilled ? " — ready for sign-off" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 12px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.value && f.value.trim().length > 5 ? <span style={{ fontSize:10, color:C.green }}>Completed</span> : <span style={{ fontSize:10, color:C.amber }}>Required</span>}
                  </div>
                  {isUW && !w.siteVisitComplete ? (
                    <textarea value={f.value||""} onChange={e=>saveSiteVisitField(a.id,i,e.target.value)} placeholder={f.placeholder||""} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
                  ) : (
                    <div style={{ fontSize:11, color:f.value ? C.textDim : C.textMuted, lineHeight:1.5, fontStyle:f.value?"normal":"italic" }}>{f.value || "Not completed"}</div>
                  )}
                  {f.item === "Overall Assessment" && isUW && !w.siteVisitComplete && (
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
                      {["Satisfactory","Concerns Noted","Unsatisfactory"].map(r => (
                        <button key={r} onClick={()=>saveSiteVisitRating(a.id,i,r)} style={{ padding:"2px 8px", fontSize:10, border:`1px solid ${f.rating===r?C.accent:C.border}`, background:f.rating===r?C.accent:"transparent", color:f.rating===r?"#fff":C.textDim, cursor:"pointer", fontFamily:"inherit" }}>{r}</button>
                      ))}
                    </div>
                  )}
                  {f.item === "Overall Assessment" && f.rating && (
                    <div style={{ fontSize:10, marginTop:3, fontWeight:500, color:f.rating==="Satisfactory"?C.green:f.rating==="Unsatisfactory"?C.red:C.amber }}>Rating: {f.rating}</div>
                  )}
                </div>
              ))}
            </div>
          </div>}
          {isUW && <div style={{ marginTop:8 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Additional Notes</div>
            <textarea value={w.siteVisitNotes||""} onChange={e=>saveSiteVisitNotes(a.id,e.target.value)} placeholder="Any additional observations not covered above..." rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
          </div>}
          {isUW && w.siteVisitDate && !w.siteVisitComplete && !isOldFormat && (
            <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:allFilled?C.green:C.amber }}>{allFilled ? "All sections completed. Ready for sign-off." : `${filledCount}/${findings.length} completed. Complete all sections to sign off.`}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"sitevisit")} disabled={!allFilled}>Sign Off</Btn>
            </div>
          )}
          {/* Old format fallback — show read-only for reference */}
          {isOldFormat && findings.length > 0 && renderReadOnly(findings)}
          {w.siteVisitComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.siteVisitOfficer}</div>}
        </div>);
        }
        if (s.key==="credit") {
          const findings = w.creditFindings || [];
          const hasNewFormat = findings.length > 0 && findings[0].analystNote !== undefined;
          const isOldCreditFormat = findings.length > 0 && !hasNewFormat;
          const notedCount = findings.filter(f => f.analystNote && f.analystNote.trim().length > 3).length;
          const riskFinding = findings.find(f => f.item === "Risk Score & Recommendation");
          const canSignOff = hasNewFormat && riskFinding?.analystNote && riskFinding.analystNote.trim().length > 10;
          return (<div>
          {!w.creditDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Pull credit bureau report and run automated financial analysis. System computes key ratios from submitted financials. Review each finding, add your professional assessment, flag concerns, then confirm.</div>}
          {isOldCreditFormat && <div style={{ padding:12, background:C.amberBg, border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Credit analysis data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-analyse" above to generate the interactive analyst review form.</div>
          </div>}
          {isOldCreditFormat && renderReadOnly(findings)}
          {hasNewFormat && findings.length > 0 && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:8 }}>{notedCount}/{findings.length} findings reviewed by analyst{canSignOff ? " — ready for confirmation" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 12px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.flag && <span style={{ fontSize:10, padding:"1px 6px", background:f.flag==="Accept"?C.green:f.flag==="Override"?C.purple:C.red, color:"#fff" }}>{f.flag}</span>}
                  </div>
                  {/* System-computed value — always visible as reference */}
                  <div style={{ fontSize:11, color:C.accent, fontWeight:500, marginBottom:2 }}>{f.systemValue}</div>
                  {f.systemDetail && <div style={{ fontSize:10, color:C.textDim, marginBottom:4, lineHeight:1.5 }}>{f.systemDetail}</div>}
                  {/* Analyst commentary */}
                  {isUW && !w.financialAnalysisComplete ? (
                    <div>
                      <textarea value={f.analystNote||""} onChange={e=>saveCreditFinding(a.id,i,"analystNote",e.target.value)} placeholder={f.placeholder || "Analyst assessment — confirm, qualify, or override the system finding..."} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5, marginBottom:4 }} />
                      <div style={{ display:"flex", gap:4 }}>
                        {["Accept","Override","Concern"].map(fl => (
                          <button key={fl} onClick={()=>saveCreditFinding(a.id,i,"flag",f.flag===fl?"":fl)} style={{ padding:"1px 7px", fontSize:10, border:`1px solid ${f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):C.border}`, background:f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):"transparent", color:f.flag===fl?"#fff":(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red), cursor:"pointer", fontFamily:"inherit" }}>{fl}</button>
                        ))}
                      </div>
                    </div>
                  ) : f.analystNote ? (
                    <div style={{ fontSize:11, color:C.textDim, lineHeight:1.5, marginTop:2, paddingLeft:8, borderLeft:`2px solid ${C.border}` }}>{f.analystNote}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>}
          {isUW && w.creditDate && !w.financialAnalysisComplete && (
            <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:canSignOff?C.green:C.amber }}>{canSignOff ? "Risk assessment complete. Ready for confirmation." : "Provide analyst assessment on 'Risk Score & Recommendation' to confirm."}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"credit")} disabled={!canSignOff}>Confirm Analysis</Btn>
            </div>
          )}
          {w.financialAnalysisComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Confirmed by Credit Analyst</div>}
        </div>);
        }
        if (s.key==="collateral") return (<div>
          {!w.collateralDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Assess collateral and security linked to the customer. Computes LTV.</div>}
          {w.collateralFindings && renderReadOnly(w.collateralFindings)}
          {isUW && w.collateralDate && !w.collateralAssessed && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"collateral")}>Confirm</Btn></div>}
          {w.collateralAssessed && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Assessment confirmed</div>}
        </div>);
        if (s.key==="social") return (<div>
          {!w.socialDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:8 }}>Verify BEE status, employment impact, and development alignment.</div>}
          {w.socialFindings && renderReadOnly(w.socialFindings)}
          {isUW && w.socialDate && !w.socialVerified && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"social")}>Confirm</Btn></div>}
          {w.socialVerified && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Verified by {w.socialOfficer}</div>}
        </div>);
        if (s.key==="decision" && isDecided) return <InfoGrid items={[["Decision",a.status],["Date",fmt.date(a.decided)],["Approver",a.approver],["Risk",a.riskScore],["DSCR",`${a.dscr}x`],["Social",a.socialScore]]} />;
        return null;
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text }}>{a.id}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c?.name} \u00b7 {p?.name} \u00b7 {fmt.cur(a.amount)} over {a.term}m</p></div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>{statusBadge(a.status)}<span style={{ fontSize:11, color:C.textMuted }}>{doneCount}/7</span></div>
        </div>
        <div style={{ display:"flex", gap:0, marginBottom:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, overflow:"hidden" }}>
          <KPI label="Amount" value={fmt.cur(a.amount)} /><KPI label="Term" value={`${a.term}m`} /><KPI label="Bureau" value={w.creditBureauScore??"-"} /><KPI label="Risk" value={a.riskScore??"-"} /><KPI label="DSCR" value={a.dscr?`${a.dscr}x`:"-"} /><KPI label="Social" value={a.socialScore??"-"} /><KPI label="LTV" value={w.collateralTotal?`${(a.amount/w.collateralTotal*100).toFixed(0)}%`:"-"} />
        </div>
        {isSub && <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Application awaiting due diligence</div><div style={{ fontSize:11, color:C.textMuted }}>Initiate underwriting to begin step-by-step verification.</div></div>
          <Btn onClick={()=>moveToUnderwriting(a.id)}>Start Due Diligence</Btn>
        </div>}

        {/* Decision summary for Approved/Declined/Booked — no workflow accordion */}
        {isDecided && !isUW && <div>
          <SectionCard title="Decision Summary">
            <InfoGrid items={[
              ["Decision", a.status],
              ["Decided By", a.approver || "—"],
              ["Decision Date", a.decided ? fmt.date(a.decided) : "—"],
              ["Risk Score", a.riskScore || "—"],
              ["DSCR", a.dscr ? `${a.dscr}x` : "—"],
              ["Rate", a.rate ? `${a.rate}%` : "—"],
            ]} />
          </SectionCard>
          {a.creditMemo && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.5, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
          {a.conditions?.length>0 && <SectionCard title={`Conditions (${a.conditions.length})`}>{a.conditions.map((cond,i)=><div key={i} style={{ display:"flex", alignItems:"flex-start", gap:4, padding:"4px 0", fontSize:12 }}><span style={{ color:C.green, flexShrink:0, marginTop:1 }}>{I.check}</span><span>{cond}</span></div>)}</SectionCard>}
          {a.status === "Approved" && canDo("loans","update") && !loanForApp(a.id) && (
            <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginTop:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booking</div>

              {/* ═══ Security Instruments ═══ */}
              {(() => {
                const prodSec = PRODUCT_SECURITY[a.product];
                if (!prodSec) return null;
                const allInstruments = [...(prodSec.required||[]), ...(prodSec.optional||[])];
                const sels = securitySelections[a.id] || {};
                return (
                  <SectionCard title="Security Instruments">
                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:12 }}>{prodSec.desc}</div>
                    {allInstruments.map(instId => {
                      const inst = SECURITY_INSTRUMENTS[instId];
                      if (!inst) return null;
                      const isRequired = (prodSec.required||[]).includes(instId);
                      const isSelected = isRequired || sels[instId];
                      return (
                        <div key={instId} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"8px 0", borderBottom:`1px solid ${C.surface3}` }}>
                          <input type="checkbox" checked={isSelected} disabled={isRequired} onChange={() => { const next = {...sels, [instId]:!sels[instId]}; setSecuritySelections({...securitySelections, [a.id]:next}); }} style={{ marginTop:2, accentColor:C.accent }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{inst.name} {isRequired && <span style={{ fontSize:10, color:C.red, fontWeight:500 }}>(Required)</span>}</div>
                            <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{inst.desc}</div>
                          </div>
                          {isSelected && inst.template && <button className="kb-cta-outline" onClick={() => { const c2 = customers.find(x=>x.id===a.custId); const p2 = products.find(x=>x.id===a.product); showToast(`Generating ${inst.name} template...`); generateSecurityDoc(inst.template, a, c2, p2); }} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 12px", fontSize:10, fontWeight:500, color:C.accent, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Generate</button>}
                        </div>
                      );
                    })}
                    <div style={{ marginTop:8, fontSize:10, color:C.textMuted }}>Required instruments must be signed before disbursement. Optional instruments reduce risk exposure and may improve pricing.</div>
                  </SectionCard>
                );
              })()}
                  <div style={{ fontSize:11, color:C.textMuted }}>Verify conditions precedent and create loan record.</div>
                </div>
              <Btn variant="secondary" onClick={() => { const c3 = customers.find(x=>x.id===a.custId); const p3 = products.find(x=>x.id===a.product); generateLoanAgreement(null, a, c3, p3); }}>Generate Agreement</Btn>
                <Btn variant="secondary" onClick={()=>{
                const c3 = customers.find(x=>x.id===a.custId);
                const p3 = products.find(x=>x.id===a.product);
                const result = generateLoanOffer(a, c3, p3);
                if (result) {
                  save({ ...data,
                    applications: applications.map(x => x.id === a.id ? { ...x, loanOfferRef: result.ref, loanOfferDate: Date.now() } : x),
                    audit: [...audit, addAudit("Loan Offer Generated", a.id, currentUser.name, `Ref: ${result.ref}. Amount: ${fmt.cur(result.amount)}. Rate: ${result.rate}% p.a. Term: ${result.term}m. Instalment: ${fmt.cur(result.instalment)}. Total repayable: ${fmt.cur(result.totalRepayable)}.`, "Origination")],
                  });
                  showToast("Loan offer generated — " + result.ref);
                }
              }}>Print Loan Offer</Btn>
              <Btn onClick={()=>bookLoan(a.id)}>Book Loan</Btn>
              </div>
            </div>
          )}
          {/* Underwriting Record — read-only expandable for audit/review */}
          {Object.keys(w).length > 0 && <div style={{ marginTop:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1px solid ${C.border}`, cursor:"pointer", background:C.surface2 }} onClick={()=>setExpandedStep(expandedStep==="uwRecord"?null:"uwRecord")}>
              <span style={{ fontSize:12, fontWeight:600, color:C.textDim }}>Underwriting Record</span>
              <span style={{ fontSize:10, color:C.textMuted }}>(click to {expandedStep==="uwRecord"?"collapse":"expand"})</span>
              <span style={{ marginLeft:"auto", color:C.textMuted, transform:expandedStep==="uwRecord"?"rotate(90deg)":"none", transition:"transform .15s" }}>{I.chev}</span>
            </div>
            {expandedStep==="uwRecord" && <div style={{ border:`1px solid ${C.border}`, borderTop:"none" }}>
              {steps.filter(s=>s.key!=="decision").map((s,i) => (
                <div key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px" }}>
                    <div style={{ width:14, height:14, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.green:"transparent", color:s.done?"#fff":C.textMuted, fontSize:10, fontWeight:600, border:`1px solid ${s.done?C.green:C.border}` }}>{s.done?I.check:""}</div>
                    <span style={{ fontSize:11, fontWeight:s.done?500:400, color:s.done?C.text:C.textMuted }}>{s.label}</span>
                    {s.done && <span style={{ fontSize:10, color:C.green, marginLeft:4 }}>Complete</span>}
                    {!s.done && s.hasData && <span style={{ fontSize:10, color:C.amber, marginLeft:4 }}>Incomplete</span>}
                    {!s.done && !s.hasData && <span style={{ fontSize:10, color:C.textMuted, marginLeft:4 }}>Not performed</span>}
                  </div>
                  {s.hasData && <div style={{ padding:"4px 10px 8px 32px", fontSize:11, color:C.textDim }}>
                    {s.key==="submitted" && s.detail && <div>{s.detail}</div>}
                    {s.key==="kyc" && w.kycFindings && <div>{w.kycFindings.filter(f=>f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:f.status==="Pass"?C.green:C.amber, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.kycOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.kycOfficer}</div>}</div>}
                    {s.key==="docs" && w.docsFindings && <div>{w.docsFindings.filter(f=>!f.inherited&&f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:C.green, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.docsOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.docsOfficer}</div>}</div>}
                    {s.key==="sitevisit" && w.siteVisitFindings && <div>{w.siteVisitFindings.filter(f=>f.value).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.value?.substring(0,120)}{f.value?.length>120?"...":""}{f.rating?` [${f.rating}]`:""}</div>)}{w.siteVisitOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.siteVisitOfficer}</div>}</div>}
                    {s.key==="credit" && w.creditFindings && <div>{w.creditFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.systemValue||""}{f.flag?<span style={{ fontSize:10, marginLeft:4, padding:"0 4px", background:f.flag==="Accept"?C.green:f.flag==="Concern"?C.red:C.purple, color:"#fff" }}>{f.flag}</span>:""}{f.analystNote?<div style={{ paddingLeft:8, color:C.textDim, fontSize:10, marginTop:1 }}>{f.analystNote.substring(0,150)}{f.analystNote.length>150?"...":""}</div>:""}</div>)}</div>}
                    {s.key==="collateral" && w.collateralFindings && <div>{w.collateralFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {fmt.cur(f.value)} — {f.detail?.substring(0,100)}</div>)}<div style={{ fontWeight:500, marginTop:2 }}>Total: {fmt.cur(w.collateralTotal)}</div></div>}
                    {s.key==="social" && w.socialFindings && renderReadOnly(w.socialFindings)}
                  </div>}
                </div>
              ))}
              {w.analystNotes && <div style={{ padding:"8px 12px", borderTop:`1px solid ${C.border}` }}><span style={{ fontSize:10, fontWeight:600, color:C.textDim }}>Analyst Notes:</span><div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{w.analystNotes}</div></div>}
            </div>}
          </div>}
        </div>}

        {/* Interactive workflow steps — only for Draft/Submitted/Underwriting */}
        {(isUW || a.status === "Draft") && steps.map((s,i) => {
          const isOpen = expandedStep===s.key;
          return (<div key={i} style={{ border:`1px solid ${C.border}`, marginBottom:1, background:C.surface }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", cursor:"pointer", background:isOpen?C.surface2:"transparent" }} onClick={()=>setExpandedStep(isOpen?null:s.key)}>
              <div style={{ width:16, height:16, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.accent:"transparent", color:s.done?"#fff":C.textMuted, fontSize:10, fontWeight:600, border:`1px solid ${s.done?C.text:s.hasData&&!s.done?C.amber:C.border}` }}>{s.done?I.check:i}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, fontWeight:s.done?600:400, color:s.done?C.text:C.textDim }}>{s.label}</span>
                {s.done && <span style={{ fontSize:10, color:C.textMuted, marginLeft:6 }}>Complete</span>}
                {s.hasData && !s.done && <span style={{ fontSize:10, color:C.amber, marginLeft:6 }}>Awaiting sign-off</span>}
              </div>
              {s.canRun && isOpen && (s.gateOk ? <Btn size="sm" variant="secondary" onClick={e=>{e.stopPropagation();runDDStep(a.id,s.key)}}>{s.runLabel}</Btn> : <span style={{ fontSize:10, color:C.textMuted }}>{s.gateMsg}</span>)}
              <span style={{ color:C.textMuted, transform:isOpen?"rotate(90deg)":"none", transition:"transform .15s" }}>{I.chev}</span>
            </div>
            {isOpen && <div style={{ padding:"8px 10px 10px 34px", borderTop:`1px solid ${C.border}` }}>{renderStepBody(s)}</div>}
          </div>);
        })}
        {/* Analyst Notes */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:8, padding:"8px 12px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Analyst Notes</div>
          <textarea value={w.analystNotes||""} onChange={e=>saveAnalystNotes(a.id,e.target.value)} placeholder="Observations, concerns, conditions to propose..." rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
        </div>}
        {/* Notify applicant */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:1, padding:"8px 12px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Notify Applicant</div>
          <input value={notifForm.subject} onChange={e=>setNotifForm({...notifForm,subject:e.target.value})} placeholder="Subject" style={{ width:"100%", padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:3 }} />
          <textarea value={notifForm.body} onChange={e=>setNotifForm({...notifForm,body:e.target.value})} placeholder="Message..." rows={2} style={{ width:"100%", padding:"4px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.4 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:3 }}>
            <Btn size="sm" variant="secondary" onClick={()=>{if(notifForm.subject&&notifForm.body){sendNotification(a.id,notifForm.subject,notifForm.body);setNotifForm({subject:"",body:""})}}}>Send</Btn>
          </div>
        </div>}
        {a.creditMemo && isUW && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.5, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
        {/* STP Fast-Track — for eligible products */}
        {isUW && a.status === "Underwriting" && prod(a.product)?.stpEnabled && <div style={{ border:`1px solid ${C.green}33`, borderRadius:6, padding:"16px 20px", marginTop:4, background:`${C.green}08` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.green }}>STP Fast-Track Available</div>
              <div style={{ fontSize:11, color:C.textDim }}>This {prod(a.product)?.name} application qualifies for Straight-Through Processing. Auto-KYC, bureau pull, risk scoring, and decisioning in under 3 minutes.</div>
            </div>
            <Btn onClick={()=>{
              const c = cust(a.custId);
              const p = prod(a.product);
              const pipeline = runSTPPipeline(a, c, p, (documents||[]).filter(d=>d.appId===a.id));
              
              if (pipeline.result?.approved) {
                const w = a.workflow || {};
                // Auto-complete all DD steps
                w.kycComplete = true; w.kycOfficer = "STP Engine"; w.kycDate = Date.now();
                w.kycFindings = pipeline.result.kycResult.kycFindings;
                w.sanctionsCleared = true; w.sanctionsDate = Date.now();
                w.docsComplete = true;
                w.financialAnalysisComplete = true;
                w.creditBureauScore = pipeline.result.bureauScore;
                w.collateralAssessed = true;
                w.socialVerified = true;
                w.siteVisitComplete = true; w.siteVisitDate = Date.now(); w.siteVisitOfficer = "STP — Waived (micro-loan)";
                w.siteVisitFindings = [{ item: "Site Visit", status: "Waived", detail: "Below STP threshold — site visit not required" }];
                
                const updated = { ...a,
                  status: "Approved",
                  workflow: w,
                  riskScore: pipeline.result.riskScore,
                  dscr: pipeline.result.dscr,
                  decided: Date.now(),
                  approver: "STP Engine (Auto-Approved)",
                  recommendation: "Approve",
                  creditMemo: `STP AUTO-APPROVAL\n${"═".repeat(40)}\nPipeline: ${pipeline.steps.map(s=>s.name+": "+s.status).join(" → ")}\nBureau: ${pipeline.result.bureauScore}\nRisk: ${pipeline.result.riskScore}\nDSCR: ${pipeline.result.dscr}x\nElapsed: ${pipeline.elapsed}\nApproved by: STP Engine`,
                  rate: p?.baseRate || 18,
                  conditions: ["Maintain debit order mandate", "Repay within term"],
                  stpPipeline: pipeline,
                };
                save({ ...data,
                  applications: applications.map(x => x.id === a.id ? updated : x),
                  audit: [...audit,
                    addAudit("STP Auto-KYC", a.id, "STP Engine", `KYC auto-verified. ${pipeline.result.kycResult.kycFindings.filter(f=>f.status==="Pass").length}/4 checks passed.`, "Automation"),
                    addAudit("STP Bureau Pull", a.id, "STP Engine", `TransUnion score: ${pipeline.result.bureauScore}. ${pipeline.result.dscr}x DSCR.`, "Automation"),
                    addAudit("STP Auto-Approval", a.id, "STP Engine", `AUTO-APPROVED in ${pipeline.elapsed}. Amount: ${fmt.cur(a.amount)}. Risk: ${pipeline.result.riskScore}/100.`, "Decision"),
                  ],
                  alerts: [...alerts, addAlert("Application", "info", `STP Approved – ${c?.name}`, `${a.id} auto-approved in ${pipeline.elapsed}. ${fmt.cur(a.amount)} at ${p?.baseRate}%.`)],
                });
                showToast(`STP Complete — ${a.id} auto-approved in ${pipeline.elapsed}`);
              } else {
                showToast(`STP: Not eligible — ${pipeline.result?.referralReason || "Referred to analyst"}. Process manually.`);
              }
            }} style={{ background:C.green, color:"#fff" }}>Run Fast-Track</Btn>
          </div>
        </div>}

        {isUW && a.status === "Underwriting" && <div style={{ border:`1px solid ${C.border}`, borderRadius:6, padding:"16px 20px", marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Submit Recommendation</div><div style={{ fontSize:11, color:C.textMuted }}>{allDDComplete?`All steps signed off. Submit memo to ${getApprovalAuthority(a.amount).label}.`:`${doneCount}/7 steps completed.`}</div></div>
            <div style={{ display:"flex", gap:8 }}><Btn onClick={()=>submitRecommendation(a.id,"Approve")} disabled={!allDDComplete}>Recommend Approve</Btn><Btn variant="danger" onClick={()=>submitRecommendation(a.id,"Decline")} disabled={!allDDComplete}>Recommend Decline</Btn></div>
          </div>
        </div>}
        {/* Generate Indicative Term Sheet */}
        {(a.status === "Submitted" || a.status === "Pre-Approval" || a.status === "Underwriting") && canDo("origination","create") && <div style={{ border:`1px solid ${C.accent}33`, borderRadius:6, padding:"16px 20px", marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.accent }}>Indicative Term Sheet</div>
              <div style={{ fontSize:11, color:C.textDim }}>Auto-generate from LMS product data and applicant security position</div>
            </div>
            <Btn size="sm" onClick={()=>{
              const c3 = cust(a.custId);
              const p3 = prod(a.product);
              const appSec = a.securityInHand || [];
              const secPos = {
                awardLetter: appSec.includes("Award letter") || (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("award")),
                purchaseOrder: appSec.includes("Purchase order") || (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("purchase order")),
                signedSLA: appSec.includes("Signed contract / SLA") || (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("sla")),
                signedInvoice: appSec.includes("Verified invoice") || (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("invoice")),
                cessionExecuted: (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("cession")),
                progressCert: appSec.includes("Progress certificate") || (documents||[]).some(d=>d.appId===a.id && (d.name||"").toLowerCase().includes("progress")),
              };
              const ts = generateTermSheet(a, c3, p3, secPos);
              const tsText = formatTermSheetText(ts);
              // Store on application and open in new window
              const updated = { ...a, termSheet: ts, termSheetText: tsText, termSheetDate: Date.now() };
              save({ ...data,
                applications: applications.map(x => x.id === a.id ? updated : x),
                audit: [...audit, addAudit("Term Sheet Generated", a.id, currentUser.name, `${ts.facilityType}. Net: ${fmt.cur(ts.totalNet)}. ${ts.tranches.length} tranche(s). Rate: ${ts.interestRate.preSecurityAnnual}% p.a. Security: ${ts.securityAssessment.overallRisk} risk.`, "Origination")],
              });
              // Open printable term sheet
              const w2 = window.open("", "_blank");
              if (w2) {
                // Build DOM safely — escape all user content via textContent
                const escapeHtml = (s) => String(s).replace(/[<>&"']/g, c => ({
                  "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;"
                }[c]));
                const safeId = escapeHtml(a.id);
                const safeContent = escapeHtml(tsText);
                w2.document.open();
                w2.document.write("<!DOCTYPE html><html><head><title>Term Sheet — " + safeId + "</title><meta charset=\"utf-8\"><style>body{font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;padding:40px;max-width:800px;margin:0 auto;line-height:1.5}@media print{body{padding:20px}}</style></head><body></body></html>");
                w2.document.close();
                w2.document.body.textContent = tsText;
              }
              showToast("Term sheet generated — " + ts.tranches.length + " tranche(s), " + ts.interestRate.preSecurityAnnual + "% p.a.");
            }}>Generate Term Sheet</Btn>
          </div>
        </div>}

        {a.stpPipeline && <div style={{ border:`1px solid ${C.green}33`, borderRadius:6, padding:"16px 20px", marginTop:4, background:`${C.green}08` }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.green, marginBottom:8 }}>STP Pipeline — {a.stpPipeline.status} ({a.stpPipeline.elapsed})</div>
          {a.stpPipeline.steps.map((s,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:i < a.stpPipeline.steps.length - 1 ? `1px solid ${C.surface3}` : "none" }}>
              <div style={{ fontSize:11, color:C.textDim }}>{s.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:C.textMuted }}>{s.duration}</span>
                <Badge color={s.status === "Pass" || s.status === "AUTO-APPROVED" ? "green" : s.status === "Fail" ? "red" : "amber"}>{s.status}</Badge>
              </div>
            </div>
          ))}
          {a.stpPipeline.result && <div style={{ fontSize:10, color:C.textMuted, marginTop:8 }}>Bureau: {a.stpPipeline.result.bureauScore} | Risk: {a.stpPipeline.result.riskScore}/100 | DSCR: {a.stpPipeline.result.dscr}x</div>}
        </div>}

        {a.status === "Pending Approval" && <div style={{ border:`1px solid ${C.accent}33`, borderRadius:6, padding:"16px 20px", marginTop:4, background:C.accentGlow }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.accent }}>Pending Approval — {a.approvalAuthority?.label}</div>
              <div style={{ fontSize:11, color:C.textDim }}>Recommended: {a.recommendation} by {a.recommendedBy} on {fmt.date(a.recommendedAt)}. {a.approvalAuthority?.level === "Committee" ? "Requires Credit Committee adjudication." : `Requires ${a.approvalAuthority?.label} sign-off.`}</div>
            </div>
            {approvalLimit(role) >= a.amount && a.recommendedBy !== currentUser.name && <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>decideLoan(a.id,"Approved")}>Approve</Btn>
              <Btn variant="danger" onClick={()=>decideLoan(a.id,"Declined")}>Decline</Btn>
            </div>}
            {a.recommendedBy === currentUser.name && <Badge color="amber">Awaiting different authority</Badge>}
            {approvalLimit(role) < a.amount && a.recommendedBy !== currentUser.name && <Badge color="red">Above your authority ({fmt.cur(approvalLimit(role))})</Badge>}
          </div>
        </div>}
        {a.status === "Booked" && (
          <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginTop:4, background:C.surface2 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booked — Awaiting Disbursement</div>
                <div style={{ fontSize:11, color:C.textMuted }}>Loan {loanForApp(a.id)?.id} created. Finance to initiate disbursement (requires dual authorization).</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={()=>{const l=loanForApp(a.id); if(l) setDetail({type:"loan",id:l.id})}}>View Loan</Btn>
            </div>
          </div>
        )}
      </div>);
    }

    if (detail.type === "loan") {
      const l = loans.find(x=>x.id===detail.id); if (!l) return <div>Not found</div>;
      const c = cust(l.custId); const prov = provisions.find(p=>p.loanId===l.id);
      const lc = collections.filter(x=>x.loanId===l.id);
      const repaidPct = l.status === "Active" ? Math.round((1-l.balance/l.amount)*100) : 0;
      const isBooked = l.status === "Booked";
      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:24 }}>
          <div><h2 style={{ margin:0, fontSize:24, fontWeight:700, color:C.text }}>{l.id}</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>{c?.name}</p></div>
          <div style={{ display:"flex", gap:8 }}>
            {statusBadge(l.status)}
            {l.status==="Active"&&<Badge color={l.dpd===0?"green":l.dpd<=30?"amber":"red"}>{l.dpd} DPD</Badge>}
            {l.status==="Active"&&<Badge color={l.stage===1?"green":l.stage===2?"amber":"red"}>Stage {l.stage}</Badge>}
          </div>
        </div>

        {/* Disbursement panel for Booked loans */}
        {isBooked && (
          <div style={{ border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:20, background:C.surface2 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Loan Booked — Awaiting Disbursement</div>
                <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>
                  Booked by: {SYSTEM_USERS.find(u=>u.id===l.bookedBy)?.name || "—"} on {fmt.date(l.bookedAt)}<br/>
                  Pre-disbursement AML check will run automatically. Dual authorization required (disbursing officer must differ from booking officer).
                  {l.arrangementFee > 0 && <span> · Arrangement fee: {fmt.cur(l.arrangementFee)}</span>}
                </div>
              </div>
              {canDoAny("servicing",["create"]) && canDoAny("loans",["update"]) && <>
                {(() => {
                const appForLoan = applications.find(x => x.id === l.appId);
                return appForLoan ? <Btn variant="secondary" onClick={()=>{
                  const c3 = customers.find(x=>x.id===l.custId);
                  const p3 = products.find(x=>x.id===l.product);
                  generateLoanOffer(appForLoan, c3, p3);
                  showToast("Loan offer reprinted");
                }}>Reprint Offer</Btn> : null;
              })()}
              <Btn onClick={()=>disburseLoan(l.id)}>Disburse Funds</Btn>
              </>}
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:0, marginBottom:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, overflow:"hidden" }}>
          <KPI label={isBooked?"Amount":"Disbursed"} value={fmt.cur(l.amount)} accent={C.blue} />
          <KPI label="Balance" value={fmt.cur(l.balance)} accent={C.red} />
          <KPI label="Rate" value={`${l.rate}%`} accent={C.amber} />
          <KPI label="Monthly PMT" value={fmt.cur(l.monthlyPmt)} />
          <KPI label="Term" value={`${l.term}m`} />
          <KPI label="Total Paid" value={fmt.cur(l.totalPaid)} accent={C.green} />
        </div>
        <SectionCard title={`Repayment Progress — ${repaidPct}%`}>
          <ProgressBar value={repaidPct} color={C.accent} height={10} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:C.textMuted }}>
            <span>Disbursed: {fmt.date(l.disbursed)}</span><span>Next Due: {fmt.date(l.nextDue)}</span><span>Last Payment: {l.lastPmt ? `${fmt.cur(l.lastPmtAmt)} on ${fmt.date(l.lastPmt)}` : "—"}</span>
          </div>
        </SectionCard>
        <div className="kb-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <SectionCard title="Covenant Monitoring">
            {l.covenants.map((cov,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div><div style={{ fontSize:13, color:C.text }}>{cov.name}</div><div style={{ fontSize:10, color:C.textMuted }}>Checked: {fmt.date(cov.checked)} · Value: {cov.value}</div></div>
                {statusBadge(cov.status)}
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Collateral & Security">
            {l.collateral.length>0 ? l.collateral.map((col,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div><div style={{ fontSize:13, fontWeight:600, color:C.text }}>{col.type}</div><div style={{ fontSize:11, color:C.textMuted }}>{col.description}</div></div>
                <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{fmt.cur(col.value)}</span>
              </div>
            )) : <div style={{ color:C.textMuted, fontSize:13 }}>No collateral recorded</div>}
            {l.collateral.length>0 && <div style={{ textAlign:"right", marginTop:10, fontSize:13, fontWeight:700, color:C.text }}>Total Security: {fmt.cur(l.collateral.reduce((s,c)=>s+c.value,0))}</div>}
          </SectionCard>
        </div>
        {prov && <SectionCard title="IFRS 9 Provisioning">
          <div style={{ display:"flex", gap:24 }}>
            {[["Stage",`Stage ${prov.stage}`],["PD",fmt.pct(prov.pd)],["LGD",fmt.pct(prov.lgd,0)],["EAD",fmt.cur(prov.ead)],["ECL",fmt.cur(prov.ecl)],["Method",prov.method]].map(([l,v],i)=>(
              <div key={i}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:14, fontWeight:700, color:l==="ECL"?C.purple:C.text }}>{v}</div></div>
            ))}
          </div>
        </SectionCard>}
        <SectionCard title={`Payment History (${l.payments.length})`}>
          <Table columns={[
            { label:"Date", render:r=>fmt.date(r.date) },
            { label:"Total", render:r=>cell.money(r.amount) },
            { label:"Interest", render:r=>cell.money(r.interest||0) },
            { label:"Principal", render:r=>cell.money(r.principal||0) },
            { label:"Type", key:"type" },
            { label:"Status", render:r=>statusBadge(r.status) },
          ]} rows={[...l.payments].sort((a,b)=>b.date-a.date)} />
          {canDo("servicing","create") && <div style={{ marginTop:12 }}><Btn size="sm" variant="secondary" onClick={()=>recordPayment(l.id, l.monthlyPmt)} icon={I.plus}>Record Payment</Btn></div>}
        </SectionCard>

                {/* Bank Statement Intelligence (TrustID) */}
        {l.status==="Active" && (() => {
          const bankData = trustIdIngestBankData(l.custId, "demo");
          return <SectionCard title={`Bank Statement Analysis · ${bankData.bankName}`}>
            <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Avg Revenue</div><div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace" }}>{fmt.cur(bankData.summary.avgMonthlyRevenue)}</div></div>
              <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Avg Expenses</div><div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace" }}>{fmt.cur(bankData.summary.avgMonthlyExpenses)}</div></div>
              <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Avg Net Cash</div><div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color: bankData.summary.avgMonthlyNetCashFlow > 0 ? C.green : C.red }}>{fmt.cur(bankData.summary.avgMonthlyNetCashFlow)}</div></div>
              <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Income Stability</div><div style={{ fontSize:18, fontWeight:700 }}>{bankData.affordability.incomeStability}</div></div>
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:60 }}>
              {bankData.monthlyData.map((m, i) => {
                const maxRev = Math.max(...bankData.monthlyData.map(x => x.revenue));
                const h = maxRev > 0 ? Math.round(m.revenue / maxRev * 50) : 0;
                return <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <div style={{ width:"100%", height:h, background: m.netCashFlow > 0 ? C.green+"40" : C.red+"40", borderRadius:2, minHeight:2 }} />
                  <div style={{ fontSize:8, color:C.textMuted }}>{m.monthName}</div>
                </div>;
              })}
            </div>
            <div style={{ display:"flex", gap:16, marginTop:8, fontSize:10, color:C.textDim }}>
              <span>Debit orders: {bankData.riskSignals.regularDebitOrders}</span>
              <span>Overdraft days: {bankData.riskSignals.overdraftDays}</span>
              <span>Revenue trend: {bankData.riskSignals.revenueGrowthTrend}</span>
              <span>Txns/month: {bankData.riskSignals.avgMonthlyTransactions}</span>
            </div>
          </SectionCard>;
        })()}

        {/* AI Credit Intelligence */}
        {l.status==="Active" && <SectionCard title="AI Credit Intelligence">
          {(() => {
            const ews = predictDelinquency(l, cust(l.custId), collections, l.payments);
            const willingness = calcWillingnessScore(cust(l.custId), null, collections, comms);
            const altData = calcAlternativeDataScore(cust(l.custId));
            return <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
              <div>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1 }}>EWS Score</div>
                <div style={{ fontSize:28, fontWeight:700, fontFamily:"monospace", color: ews.ewsScore >= 70 ? C.green : ews.ewsScore >= 40 ? C.amber : C.red }}>{ews.ewsScore}</div>
                <Badge color={ews.riskLevel === "Low" ? "green" : ews.riskLevel === "Medium" ? "amber" : "red"}>{ews.riskLevel} Risk</Badge>
                <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{ews.nextAction}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Willingness</div>
                <div style={{ fontSize:28, fontWeight:700, fontFamily:"monospace", color: willingness.score >= 70 ? C.green : willingness.score >= 40 ? C.amber : C.red }}>{willingness.score}</div>
                <Badge color={willingness.grade === "High" ? "green" : willingness.grade === "Medium" ? "amber" : "red"}>{willingness.grade}</Badge>
                <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{willingness.factors.communication}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Alt Data</div>
                <div style={{ fontSize:28, fontWeight:700, fontFamily:"monospace", color: altData.score >= 65 ? C.green : altData.score >= 45 ? C.amber : C.red }}>{altData.score}</div>
                <Badge color={altData.grade === "Strong" ? "green" : altData.grade === "Adequate" ? "amber" : "red"}>{altData.grade}</Badge>
                <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{altData.dataCompleteness}% data completeness</div>
              </div>
            </div>
            {/* Psychometric Assessment */}
            {(() => {
              const appForLoan = applications.find(x => x.id === l.appId);
              const psycho = appForLoan?.psychometricResult;
              if (!psycho) return null;
              return <div style={{ marginTop:12, padding:"12px 0", borderTop:`1px solid ${C.surface3}` }}>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Psychometric Profile</div>
                <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr", gap:8 }}>
                  {Object.entries(psycho.traits).map(([trait, score]) => (
                    <div key={trait} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:700, fontFamily:"monospace", color: score >= 70 ? C.green : score >= 40 ? C.amber : C.red }}>{score}</div>
                      <div style={{ fontSize:8, color:C.textDim, textTransform:"capitalize" }}>{trait.replace(/_/g," ")}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:8 }}>{psycho.creditIndicators.repaymentPrediction}</div>
              </div>;
            })()}
            <div style={{ display:"none" }}>
            </div>;
          })()}
        </SectionCard>}

        {/* Collateral Valuation */}
        {(() => {
          const appForLoan = applications.find(x => x.id === l.appId);
          const val = appForLoan?.workflow?.collateralValuation;
          if (!val || !val.items?.length) return null;
          return <SectionCard title="Automated Collateral Valuation">
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div><span style={{ fontSize:10, color:C.textMuted }}>Current Value</span><div style={{ fontSize:20, fontWeight:700 }}>{fmt.cur(val.total)}</div></div>
              <div><span style={{ fontSize:10, color:C.textMuted }}>Forced Sale</span><div style={{ fontSize:20, fontWeight:700, color:C.amber }}>{fmt.cur(val.totalForcedSale)}</div></div>
              <div><span style={{ fontSize:10, color:C.textMuted }}>LTV</span><div style={{ fontSize:20, fontWeight:700 }}>{l.amount && val.total ? Math.round(l.amount / val.total * 100) : "—"}%</div></div>
              <div><span style={{ fontSize:10, color:C.textMuted }}>Confidence</span><div style={{ fontSize:20, fontWeight:700 }}>{val.avgConfidence}%</div></div>
            </div>
            {val.items.map((item, i) => (
              <div key={i} style={{ padding:"6px 0", borderBottom: i < val.items.length - 1 ? `1px solid ${C.surface3}` : "none", fontSize:11 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:C.text, fontWeight:500 }}>{item.description || item.type}</span>
                  <span style={{ fontFamily:"monospace" }}>{fmt.cur(item.currentValue)} / {fmt.cur(item.forcedSaleValue)}</span>
                </div>
                <div style={{ fontSize:10, color:C.textDim }}>{item.valuationMethod} · {item.confidence}% confidence</div>
              </div>
            ))}
            <div style={{ fontSize:10, color:C.textDim, marginTop:8, fontStyle:"italic" }}>{val.recommendation}</div>
          </SectionCard>;
        })()}

        {/* Collections Actions — visible for delinquent loans */}
        {l.status==="Active" && l.dpd > 0 && canDo("collections","create") && <SectionCard title="Collections Actions">
          <div style={{ fontSize:11, color:C.textDim, marginBottom:12 }}>{l.dpd <= 30 ? "Early stage (1-30 DPD) — customer engagement and payment arrangement." : l.dpd <= 90 ? "Mid stage (31-90 DPD) — formal demand and restructuring." : "Late stage (91+ DPD) — legal recovery and write-off consideration."}</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Btn size="sm" variant="secondary" onClick={()=>addCollectionAction(l.id,"Phone Call","Outbound collection call.",{channel:"Phone"})}>Log Call</Btn>
            <Btn size="sm" variant="secondary" onClick={()=>addCollectionAction(l.id,"SMS Reminder","Payment reminder sent.",{channel:"SMS"})}>Send Reminder</Btn>
            <Btn size="sm" variant="secondary" onClick={()=>setActionModal({loanId:l.id,type:"ptp"})}>Promise to Pay</Btn>
            {l.dpd>30 && <Btn size="sm" variant="danger" onClick={()=>addCollectionAction(l.id,"Letter of Demand","Formal NCA s129 demand issued.",{channel:"Letter"})}>Letter of Demand</Btn>}
            {l.dpd>30 && <Btn size="sm" variant="secondary" onClick={()=>setActionModal({loanId:l.id,type:"restructure"})}>Restructure</Btn>}
            {l.dpd>90 && <Btn size="sm" variant="danger" onClick={()=>addCollectionAction(l.id,"Legal Handover","Referred to Legal Department.",{channel:"Legal"})}>Legal Handover</Btn>}
            {l.dpd>90 && <Btn size="sm" variant="secondary" onClick={()=>setActionModal({loanId:l.id,type:"writeoff"})}>Propose Write-Off</Btn>}
          </div>
        </SectionCard>}

        {lc.length>0 && <SectionCard title="Collection Activity">
          {lc.sort((a,b)=>b.created-a.created).map((col,i) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontWeight:700, color:C.text, fontSize:13 }}>{col.action}</span><Badge color="slate">{col.channel}</Badge></div>
                <span style={{ fontSize:10, color:C.textMuted }}>{fmt.date(col.created)}</span>
              </div>
              <div style={{ fontSize:12, color:C.textDim }}>{col.notes}</div>
              {col.ptpDate && <div style={{ fontSize:11, color:C.accent, marginTop:3 }}>PTP: {fmt.cur(col.ptpAmount)} by {fmt.date(col.ptpDate)}</div>}
            </div>
          ))}
        </SectionCard>}
      </div>);
    }
    return null;
}
