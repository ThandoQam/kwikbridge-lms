// @ts-nocheck
// KwikBridge LMS — Detail View Router
// Routes to CustomerDetail, ApplicationDetail, or LoanDetail.
// Extracted from renderDetail() — 58KB of logic.

import React from "react";

export function renderDetail() {
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
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{c.name}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c.id} · {c.industry} · {c.province}</p></div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>{statusBadge(c.ficaStatus)}<Badge color="purple">BEE Level {c.beeLevel}</Badge><Badge color={c.riskCategory==="Low"?"green":c.riskCategory==="Medium"?"amber":"red"}>{c.riskCategory} Risk</Badge></div>
        </div>

        {/* Profile — read or edit */}
        <SectionCard title="Customer Profile" actions={canDo("customers","update") && !detailEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setDetailForm({...c});setDetailEditing(true)}}>Edit</Btn> : null}>
          {!detailEditing ? (
            <InfoGrid items={[["Contact",c.contact],["Email",c.email],["Phone",c.phone],["ID Number",c.idNum],["Reg Number",c.regNum],["Address",c.address],["Annual Revenue",fmt.cur(c.revenue)],["Employees",c.employees],["Years in Business",c.years],["Sector",c.sector],["BEE Expiry",fmt.date(c.beeExpiry)],["Women Ownership",(c.womenOwned||0)+"%"],["Youth Ownership",(c.youthOwned||0)+"%"],["Disability Ownership",(c.disabilityOwned||0)+"%"],["FICA Date",fmt.date(c.ficaDate)],["Created",fmt.date(c.created)]]} />
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Business Name"><Input value={detailForm.name} onChange={e=>setDetailForm({...detailForm,name:e.target.value})} /></Field>
                <Field label="Contact"><Input value={detailForm.contact} onChange={e=>setDetailForm({...detailForm,contact:e.target.value})} /></Field>
                <Field label="Email"><Input value={detailForm.email} onChange={e=>setDetailForm({...detailForm,email:e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Phone"><Input value={detailForm.phone} onChange={e=>setDetailForm({...detailForm,phone:e.target.value})} /></Field>
                <Field label="Industry"><Select value={detailForm.industry} onChange={e=>setDetailForm({...detailForm,industry:e.target.value})} options={["Retail","Agriculture","Technology","Construction","Food Processing","Transport","Manufacturing","Professional Services","Other"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Revenue"><Input type="number" value={detailForm.revenue} onChange={e=>setDetailForm({...detailForm,revenue:+e.target.value})} /></Field>
                <Field label="Employees"><Input type="number" value={detailForm.employees} onChange={e=>setDetailForm({...detailForm,employees:+e.target.value})} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Address"><Input value={detailForm.address} onChange={e=>setDetailForm({...detailForm,address:e.target.value})} /></Field>
                <Field label="Province"><Select value={detailForm.province} onChange={e=>setDetailForm({...detailForm,province:e.target.value})} options={["Eastern Cape","Western Cape","Gauteng","KwaZulu-Natal","Free State","North West","Limpopo","Mpumalanga","Northern Cape"].map(v=>({value:v,label:v}))} /></Field>
                <Field label="Risk Category"><Select value={detailForm.riskCategory} onChange={e=>setDetailForm({...detailForm,riskCategory:e.target.value})} options={["Low","Medium","High"].map(v=>({value:v,label:v}))} /></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
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
            <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
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
            {canDoAny("customers",["update"]) && <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
              {c.beeStatus !== "Verified" && <Btn size="sm" onClick={()=>updateBeeStatus(c.id,"Verified",detailBeeForm.level,detailBeeForm.expiry)}>Verify BEE</Btn>}
              {c.beeStatus === "Verified" && <Btn size="sm" variant="secondary" onClick={()=>updateBeeStatus(c.id,"Expired",null,null)}>Mark Expired</Btn>}
              <Btn size="sm" variant="ghost" onClick={()=>updateBeeStatus(c.id,"Pending Review",null,null)}>Reset</Btn>
            </div>}
          </div>
          {canDoAny("customers",["update"]) && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
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
            {label:"Actions", render:r=><div style={{ display:"flex", gap:3 }}>
              {canDo("documents","approve") && r.status!=="Verified" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();approveDocument(r.id)}}>Approve</Btn>}
              {canDo("documents","update") && r.status!=="Rejected" && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();rejectDocument(r.id,"Re-submission required.")}}>Reject</Btn>}
            </div>},
          ]} rows={custDocs} />
        </SectionCard>

        {/* Applications */}
        {ca.length>0 && <SectionCard title={`Applications (${ca.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Product",render:r=>prod(r.product)?.name},{label:"Amount",render:r=>fmt.cur(r.amount)},{label:"Status",render:r=>statusBadge(r.status)}]} rows={ca} onRowClick={r=>setDetail({type:"application",id:r.id})} />
        </SectionCard>}

        {/* Loans */}
        {cl.length>0 && <SectionCard title={`Active Loans (${cl.length})`}>
          <Table columns={[{label:"ID",render:r=><span style={{fontFamily:"monospace",fontSize:12}}>{r.id}</span>},{label:"Balance",render:r=>fmt.cur(r.balance)},{label:"DPD",render:r=>r.dpd},{label:"Stage",render:r=><Badge color={r.stage===1?"green":r.stage===2?"amber":"red"}>Stage {r.stage}</Badge>}]} rows={cl} onRowClick={r=>setDetail({type:"loan",id:r.id})} />
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
                <div style={{ display:"flex", gap:6, padding:"5px 8px", fontSize:11, alignItems:"center" }}>
                  <span style={{ width:40, flexShrink:0, fontWeight:500, color: f.status==="Pass"||f.status==="Verified"||f.status==="Confirmed (Override)"?C.green : f.status==="Flagged"?C.amber : f.status==="Rejected"||f.status==="Fail"||f.status==="Missing"?C.red : f.status==="Pending KYC"?C.amber : C.textMuted }}>{f.officerAction?f.status:(f.systemResult||f.status)}</span>
                  <span style={{ width:130, flexShrink:0, fontWeight:500, color:isInherited?C.textDim:C.text, fontSize:11 }}>{f.item}</span>
                  <span style={{ flex:1, color:C.textDim, fontSize:11 }}>{f.detail}{f.source?` (${f.source})`:""}{f.purpose&&!isInherited?<span style={{ color:C.textMuted, fontSize:10 }}> — {f.purpose}</span>:""}</span>
                  {/* View Document button */}
                  {doc && !isInherited && <button onClick={()=>setViewingDoc(isExpanded?null:`${stepKey}-${i}`)} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:isExpanded?C.surface2:"transparent", color:C.accent, cursor:"pointer", fontFamily:"inherit", fontWeight:isExpanded?600:400 }}>{isExpanded?"Close":"View"}</button>}
                  {/* Request button — shown for Missing non-inherited docs */}
                  {!doc && !isInherited && f.systemResult==="Missing" && isUW && (() => {
                    const reqs = (w.docRequests||[]).filter(r=>r.docType===f.item);
                    const lastReq = reqs[reqs.length-1];
                    return lastReq
                      ? <span style={{ fontSize:9, color:C.textMuted, flexShrink:0 }}>Requested {fmt.date(lastReq.requestedAt)} by {lastReq.requestedBy}</span>
                      : <button onClick={()=>requestDocFromApplicant(a.id,f.item,"")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Request</button>;
                  })()}
                  {/* Inherited indicator */}
                  {isInherited && <span style={{ fontSize:9, color:C.textMuted, flexShrink:0, fontStyle:"italic" }}>from Step 2</span>}
                  {/* Confirm / Flag / Reject — only for non-inherited items */}
                  {isActionable && !isInherited && !f.officerAction && (
                    <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Confirmed","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Flagged","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.amber, cursor:"pointer", fontFamily:"inherit" }}>Flag</button>
                      <button onClick={()=>actionFindingItem(a.id,stepKey,i,"Rejected","")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject</button>
                    </div>
                  )}
                  {isActionable && !isInherited && f.officerAction && <span style={{ fontSize:9, color:C.textMuted, flexShrink:0 }}>{f.officerAction}</span>}
                  {/* Doc-level approve/reject — only for non-inherited items */}
                  {doc && !isInherited && isUW && doc.status!=="Verified" && canDo("documents","approve") && <button onClick={()=>approveDocument(doc.id,a.id)} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.green, cursor:"pointer", fontFamily:"inherit" }}>Approve Doc</button>}
                  {doc && !isInherited && isUW && doc.status!=="Rejected" && canDo("documents","update") && <button onClick={()=>rejectDocument(doc.id,"Re-submission required.")} style={{ padding:"1px 5px", fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.red, cursor:"pointer", fontFamily:"inherit" }}>Reject Doc</button>}
                </div>
                {/* Expanded document detail panel */}
                {isExpanded && doc && (
                  <div style={{ padding:"6px 8px 8px 46px", background:C.surface2, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, fontSize:10 }}>
                      <div><span style={{ color:C.textMuted }}>Document ID:</span> <span style={{ fontFamily:"monospace", fontWeight:500 }}>{doc.id}</span></div>
                      <div><span style={{ color:C.textMuted }}>Name:</span> <span style={{ fontWeight:500 }}>{doc.name}</span></div>
                      <div><span style={{ color:C.textMuted }}>Category:</span> {doc.category}</div>
                      <div><span style={{ color:C.textMuted }}>Status:</span> <span style={{ fontWeight:600, color:doc.status==="Verified"?C.green:doc.status==="Rejected"?C.red:C.amber }}>{doc.status}</span></div>
                      <div><span style={{ color:C.textMuted }}>Uploaded By:</span> {doc.uploadedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Uploaded:</span> {fmt.date(doc.uploadedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Verified By:</span> {doc.verifiedBy||"—"}</div>
                      <div><span style={{ color:C.textMuted }}>Verified:</span> {fmt.date(doc.verifiedAt)}</div>
                      <div><span style={{ color:C.textMuted }}>Expiry:</span> {doc.expiryDate ? <span style={{ color: doc.expiryDate < now + 90*day ? C.red : C.textDim }}>{fmt.date(doc.expiryDate)}</span> : "None"}</div>
                      <div style={{ gridColumn:"1/4" }}><span style={{ color:C.textMuted }}>File:</span> <span style={{ fontFamily:"monospace", fontSize:9 }}>{doc.fileRef||"—"}</span></div>
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
          {isActionable && <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.textMuted }}>{allActioned?"Ready for sign-off.":`${reqItems.filter(f=>f.officerAction).length}/${reqItems.length} reviewed.`}</span>
            <Btn size="sm" onClick={()=>signOffStep(a.id,stepKey)} disabled={!allActioned}>Sign Off</Btn>
          </div>}
        </div>);
      };

      const renderReadOnly = (findings) => {
        if (!findings || !Array.isArray(findings)) return null;
        return (<div style={{ border:`1px solid ${C.border}` }}>
          {findings.map((f,i) => (
            <div key={i} style={{ display:"flex", gap:6, padding:"5px 8px", fontSize:11, borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
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
                <div key={i} style={{ display:"flex", gap:6, padding:"4px 8px", fontSize:11, borderBottom:i<(a.qaFindings.mandatoryDocs.length-1)?`1px solid ${C.border}`:"none" }}>
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
          {a.expiresAt && a.status === "Draft" && <div style={{ fontSize:10, color: a.expiresAt < Date.now() ? C.red : C.amber, marginTop:6 }}>
            {a.expiresAt < Date.now() ? `EXPIRED on ${fmt.date(a.expiresAt)}` : `Expires: ${fmt.date(a.expiresAt)} (${Math.ceil((a.expiresAt - Date.now())/day)} days remaining)`}
          </div>}
        </div>);
        if (s.key==="kyc") return (<div>
          {!w.kycDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Verify applicant identity and regulatory compliance: ID against Home Affairs, company registration against CIPC, bank account confirmation, address verification, sanctions screening (OFAC/UN/SA), and PEP check. Each item requires your review and sign-off.</div>}
          {w.kycFindings && renderChecklist(w.kycFindings, "kyc")}
          {w.kycComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Signed off by {w.kycOfficer}</div>}
        </div>);
        if (s.key==="docs") return (<div>
          {!w.docsDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Check application document completeness. KYC documents (ID, PoA, Bank, Registration) carry forward from Step 2. This step verifies financial statements, business plan, and any industry-specific documents are on file and adequate for underwriting.</div>}
          {w.docsFindings && renderChecklist(w.docsFindings, "docs")}
          {isUW && <div style={{ marginTop:8, padding:"6px 8px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Request Document from Applicant</div>
            <div style={{ display:"flex", gap:4 }}>
              <input value={reqDocType} onChange={e=>setReqDocType(e.target.value)} placeholder="Document type..." style={{ flex:1, padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
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
          {!w.siteVisitDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Click "Generate Findings" to create the site visit assessment form. Complete each field after the physical visit, then sign off.</div>}
          {isOldFormat && <div style={{ padding:10, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Site visit data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-generate" above to create the interactive assessment form. You will need to re-enter your observations.</div>
          </div>}
          {findings.length > 0 && !isOldFormat && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:6 }}>{filledCount}/{findings.length} sections completed{allFilled ? " — ready for sign-off" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 10px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.value && f.value.trim().length > 5 ? <span style={{ fontSize:9, color:C.green }}>Completed</span> : <span style={{ fontSize:9, color:C.amber }}>Required</span>}
                  </div>
                  {isUW && !w.siteVisitComplete ? (
                    <textarea value={f.value||""} onChange={e=>saveSiteVisitField(a.id,i,e.target.value)} placeholder={f.placeholder||""} rows={2} style={{ width:"100%", padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
                  ) : (
                    <div style={{ fontSize:11, color:f.value ? C.textDim : C.textMuted, lineHeight:1.5, fontStyle:f.value?"normal":"italic" }}>{f.value || "Not completed"}</div>
                  )}
                  {f.item === "Overall Assessment" && isUW && !w.siteVisitComplete && (
                    <div style={{ display:"flex", gap:6, marginTop:4 }}>
                      {["Satisfactory","Concerns Noted","Unsatisfactory"].map(r => (
                        <button key={r} onClick={()=>saveSiteVisitRating(a.id,i,r)} style={{ padding:"2px 8px", fontSize:10, border:`1px solid ${f.rating===r?C.text:C.border}`, background:f.rating===r?C.text:"transparent", color:f.rating===r?"#fff":C.textDim, cursor:"pointer", fontFamily:"inherit" }}>{r}</button>
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
            <textarea value={w.siteVisitNotes||""} onChange={e=>saveSiteVisitNotes(a.id,e.target.value)} placeholder="Any additional observations not covered above..." rows={2} style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
          </div>}
          {isUW && w.siteVisitDate && !w.siteVisitComplete && !isOldFormat && (
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
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
          {!w.creditDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Pull credit bureau report and run automated financial analysis. System computes key ratios from submitted financials. Review each finding, add your professional assessment, flag concerns, then confirm.</div>}
          {isOldCreditFormat && <div style={{ padding:10, background:"#fff8e1", border:`1px solid ${C.amber}`, marginBottom:8, fontSize:11 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Credit analysis data is in a legacy format (static/read-only).</div>
            <div style={{ color:C.textDim }}>Click "Re-analyse" above to generate the interactive analyst review form.</div>
          </div>}
          {isOldCreditFormat && renderReadOnly(findings)}
          {hasNewFormat && findings.length > 0 && <div>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:6 }}>{notedCount}/{findings.length} findings reviewed by analyst{canSignOff ? " — ready for confirmation" : ""}</div>
            <div style={{ border:`1px solid ${C.border}` }}>
              {findings.map((f, i) => (
                <div key={i} style={{ padding:"8px 10px", borderBottom:i<findings.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:C.text }}>{f.item}</span>
                    {f.flag && <span style={{ fontSize:9, padding:"1px 6px", background:f.flag==="Accept"?C.green:f.flag==="Override"?C.purple:C.red, color:"#fff" }}>{f.flag}</span>}
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
                          <button key={fl} onClick={()=>saveCreditFinding(a.id,i,"flag",f.flag===fl?"":fl)} style={{ padding:"1px 7px", fontSize:9, border:`1px solid ${f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):C.border}`, background:f.flag===fl?(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red):"transparent", color:f.flag===fl?"#fff":(fl==="Accept"?C.green:fl==="Override"?C.purple:C.red), cursor:"pointer", fontFamily:"inherit" }}>{fl}</button>
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
            <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:10, color:canSignOff?C.green:C.amber }}>{canSignOff ? "Risk assessment complete. Ready for confirmation." : "Provide analyst assessment on 'Risk Score & Recommendation' to confirm."}</span>
              <Btn size="sm" onClick={()=>signOffStep(a.id,"credit")} disabled={!canSignOff}>Confirm Analysis</Btn>
            </div>
          )}
          {w.financialAnalysisComplete && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Confirmed by Credit Analyst</div>}
        </div>);
        }
        if (s.key==="collateral") return (<div>
          {!w.collateralDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Assess collateral and security linked to the customer. Computes LTV.</div>}
          {w.collateralFindings && renderReadOnly(w.collateralFindings)}
          {isUW && w.collateralDate && !w.collateralAssessed && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"collateral")}>Confirm</Btn></div>}
          {w.collateralAssessed && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Assessment confirmed</div>}
        </div>);
        if (s.key==="social") return (<div>
          {!w.socialDate && <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Verify BEE status, employment impact, and development alignment.</div>}
          {w.socialFindings && renderReadOnly(w.socialFindings)}
          {isUW && w.socialDate && !w.socialVerified && <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}><Btn size="sm" onClick={()=>signOffStep(a.id,"social")}>Confirm</Btn></div>}
          {w.socialVerified && <div style={{ marginTop:4, fontSize:10, color:C.green }}>Verified by {w.socialOfficer}</div>}
        </div>);
        if (s.key==="decision" && isDecided) return <InfoGrid items={[["Decision",a.status],["Date",fmt.date(a.decided)],["Approver",a.approver],["Risk",a.riskScore],["DSCR",`${a.dscr}x`],["Social",a.socialScore]]} />;
        return null;
      };

      return (<div><BackBtn />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text }}>{a.id}</h2><p style={{ margin:"2px 0 0", fontSize:12, color:C.textMuted }}>{c?.name} \u00b7 {p?.name} \u00b7 {fmt.cur(a.amount)} over {a.term}m</p></div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>{statusBadge(a.status)}<span style={{ fontSize:11, color:C.textMuted }}>{doneCount}/7</span></div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
          <KPI label="Amount" value={fmt.cur(a.amount)} /><KPI label="Term" value={`${a.term}m`} /><KPI label="Bureau" value={w.creditBureauScore??"-"} /><KPI label="Risk" value={a.riskScore??"-"} /><KPI label="DSCR" value={a.dscr?`${a.dscr}x`:"-"} /><KPI label="Social" value={a.socialScore??"-"} /><KPI label="LTV" value={w.collateralTotal?`${(a.amount/w.collateralTotal*100).toFixed(0)}%`:"-"} />
        </div>
        {isSub && <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
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
          {a.creditMemo && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.7, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
          {a.conditions?.length>0 && <SectionCard title={`Conditions (${a.conditions.length})`}>{a.conditions.map((cond,i)=><div key={i} style={{ display:"flex", alignItems:"flex-start", gap:5, padding:"3px 0", fontSize:12 }}><span style={{ color:C.green, flexShrink:0, marginTop:1 }}>{I.check}</span><span>{cond}</span></div>)}</SectionCard>}
          {a.status === "Approved" && canDo("loans","update") && !loanForApp(a.id) && (
            <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Loan Booking</div>
                  <div style={{ fontSize:11, color:C.textMuted }}>Verify conditions precedent and create loan record.</div>
                </div>
                <Btn onClick={()=>bookLoan(a.id)}>Book Loan</Btn>
              </div>
            </div>
          )}
          {/* Underwriting Record — read-only expandable for audit/review */}
          {Object.keys(w).length > 0 && <div style={{ marginTop:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px", border:`1px solid ${C.border}`, cursor:"pointer", background:C.surface2 }} onClick={()=>setExpandedStep(expandedStep==="uwRecord"?null:"uwRecord")}>
              <span style={{ fontSize:12, fontWeight:600, color:C.textDim }}>Underwriting Record</span>
              <span style={{ fontSize:10, color:C.textMuted }}>(click to {expandedStep==="uwRecord"?"collapse":"expand"})</span>
              <span style={{ marginLeft:"auto", color:C.textMuted, transform:expandedStep==="uwRecord"?"rotate(90deg)":"none", transition:"transform .15s" }}>{I.chev}</span>
            </div>
            {expandedStep==="uwRecord" && <div style={{ border:`1px solid ${C.border}`, borderTop:"none" }}>
              {steps.filter(s=>s.key!=="decision").map((s,i) => (
                <div key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px" }}>
                    <div style={{ width:14, height:14, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.green:"transparent", color:s.done?"#fff":C.textMuted, fontSize:7, fontWeight:600, border:`1px solid ${s.done?C.green:C.border}` }}>{s.done?I.check:""}</div>
                    <span style={{ fontSize:11, fontWeight:s.done?500:400, color:s.done?C.text:C.textMuted }}>{s.label}</span>
                    {s.done && <span style={{ fontSize:9, color:C.green, marginLeft:4 }}>Complete</span>}
                    {!s.done && s.hasData && <span style={{ fontSize:9, color:C.amber, marginLeft:4 }}>Incomplete</span>}
                    {!s.done && !s.hasData && <span style={{ fontSize:9, color:C.textMuted, marginLeft:4 }}>Not performed</span>}
                  </div>
                  {s.hasData && <div style={{ padding:"4px 10px 8px 32px", fontSize:11, color:C.textDim }}>
                    {s.key==="submitted" && s.detail && <div>{s.detail}</div>}
                    {s.key==="kyc" && w.kycFindings && <div>{w.kycFindings.filter(f=>f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:f.status==="Pass"?C.green:C.amber, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.kycOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.kycOfficer}</div>}</div>}
                    {s.key==="docs" && w.docsFindings && <div>{w.docsFindings.filter(f=>!f.inherited&&f.officerAction).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ color:C.green, fontWeight:500 }}>{f.status}</span> {f.item}{f.officerNote?` — ${f.officerNote}`:""}</div>)}{w.docsOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.docsOfficer}</div>}</div>}
                    {s.key==="sitevisit" && w.siteVisitFindings && <div>{w.siteVisitFindings.filter(f=>f.value).map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.value?.substring(0,120)}{f.value?.length>120?"...":""}{f.rating?` [${f.rating}]`:""}</div>)}{w.siteVisitOfficer && <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Signed off by {w.siteVisitOfficer}</div>}</div>}
                    {s.key==="credit" && w.creditFindings && <div>{w.creditFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {f.systemValue||""}{f.flag?<span style={{ fontSize:9, marginLeft:4, padding:"0 4px", background:f.flag==="Accept"?C.green:f.flag==="Concern"?C.red:C.purple, color:"#fff" }}>{f.flag}</span>:""}{f.analystNote?<div style={{ paddingLeft:8, color:C.textDim, fontSize:10, marginTop:1 }}>{f.analystNote.substring(0,150)}{f.analystNote.length>150?"...":""}</div>:""}</div>)}</div>}
                    {s.key==="collateral" && w.collateralFindings && <div>{w.collateralFindings.map((f,j)=><div key={j} style={{ padding:"2px 0" }}><span style={{ fontWeight:500 }}>{f.item}:</span> {fmt.cur(f.value)} — {f.detail?.substring(0,100)}</div>)}<div style={{ fontWeight:500, marginTop:2 }}>Total: {fmt.cur(w.collateralTotal)}</div></div>}
                    {s.key==="social" && w.socialFindings && renderReadOnly(w.socialFindings)}
                  </div>}
                </div>
              ))}
              {w.analystNotes && <div style={{ padding:"6px 10px", borderTop:`1px solid ${C.border}` }}><span style={{ fontSize:10, fontWeight:600, color:C.textDim }}>Analyst Notes:</span><div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{w.analystNotes}</div></div>}
            </div>}
          </div>}
        </div>}

        {/* Interactive workflow steps — only for Draft/Submitted/Underwriting */}
        {(isUW || a.status === "Draft") && steps.map((s,i) => {
          const isOpen = expandedStep===s.key;
          return (<div key={i} style={{ border:`1px solid ${C.border}`, marginBottom:1, background:C.surface }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", cursor:"pointer", background:isOpen?C.surface2:"transparent" }} onClick={()=>setExpandedStep(isOpen?null:s.key)}>
              <div style={{ width:16, height:16, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:s.done?C.text:"transparent", color:s.done?"#fff":C.textMuted, fontSize:8, fontWeight:600, border:`1px solid ${s.done?C.text:s.hasData&&!s.done?C.amber:C.border}` }}>{s.done?I.check:i}</div>
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
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:6, padding:"8px 10px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Analyst Notes</div>
          <textarea value={w.analystNotes||""} onChange={e=>saveAnalystNotes(a.id,e.target.value)} placeholder="Observations, concerns, conditions to propose..." rows={2} style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
        </div>}
        {/* Notify applicant */}
        {isUW && <div style={{ border:`1px solid ${C.border}`, marginTop:1, padding:"8px 10px" }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.text, marginBottom:3 }}>Notify Applicant</div>
          <input value={notifForm.subject} onChange={e=>setNotifForm({...notifForm,subject:e.target.value})} placeholder="Subject" style={{ width:"100%", padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:3 }} />
          <textarea value={notifForm.body} onChange={e=>setNotifForm({...notifForm,body:e.target.value})} placeholder="Message..." rows={2} style={{ width:"100%", padding:"3px 5px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:10, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.4 }} />
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:3 }}>
            <Btn size="sm" variant="secondary" onClick={()=>{if(notifForm.subject&&notifForm.body){sendNotification(a.id,notifForm.subject,notifForm.body);setNotifForm({subject:"",body:""})}}}>Send</Btn>
          </div>
        </div>}
        {a.creditMemo && isUW && <SectionCard title="Credit Memorandum"><div style={{ fontSize:12, color:C.textDim, lineHeight:1.7, whiteSpace:"pre-line" }}>{a.creditMemo}</div></SectionCard>}
        {isUW && <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:12, fontWeight:600, color:C.text }}>Credit Decision</div><div style={{ fontSize:11, color:C.textMuted }}>{allDDComplete?"All steps signed off. Ready for decision.":`${doneCount}/7 steps completed.`}</div></div>
            <div style={{ display:"flex", gap:6 }}><Btn onClick={()=>decideLoan(a.id,"Approved")} disabled={!allDDComplete}>Approve</Btn><Btn variant="danger" onClick={()=>decideLoan(a.id,"Declined")} disabled={!allDDComplete}>Decline</Btn></div>
          </div>
        </div>}
        {a.status === "Booked" && (
          <div style={{ border:`1px solid ${C.border}`, padding:"10px 14px", marginTop:4, background:C.surface2 }}>
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
          <div><h2 style={{ margin:0, fontSize:22, fontWeight:700, color:C.text }}>{l.id}</h2><p style={{ margin:"4px 0 0", fontSize:13, color:C.textMuted }}>{c?.name}</p></div>
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
              {canDoAny("servicing",["create"]) && canDoAny("loans",["update"]) && (
                <Btn onClick={()=>disburseLoan(l.id)}>Disburse Funds</Btn>
              )}
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
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
              <div key={i}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>{l}</div><div style={{ fontSize:15, fontWeight:700, color:l==="ECL"?C.purple:C.text }}>{v}</div></div>
            ))}
          </div>
        </SectionCard>}
        <SectionCard title={`Payment History (${l.payments.length})`}>
          <Table columns={[
            { label:"Date", render:r=>fmt.date(r.date) },
            { label:"Total", render:r=><span style={{ fontWeight:700 }}>{fmt.cur(r.amount)}</span> },
            { label:"Interest", render:r=><span style={{ color:C.amber }}>{fmt.cur(r.interest||0)}</span> },
            { label:"Principal", render:r=><span style={{ color:C.green }}>{fmt.cur(r.principal||0)}</span> },
            { label:"Type", key:"type" },
            { label:"Status", render:r=>statusBadge(r.status) },
          ]} rows={[...l.payments].sort((a,b)=>b.date-a.date)} />
          {canDo("servicing","create") && <div style={{ marginTop:12 }}><Btn size="sm" variant="secondary" onClick={()=>recordPayment(l.id, l.monthlyPmt)} icon={I.plus}>Record Payment</Btn></div>}
        </SectionCard>
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
