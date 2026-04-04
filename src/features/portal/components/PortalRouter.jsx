// KwikBridge LMS — Portal Page Router
// Renders the correct portal page based on current page state.
// Contains: Dashboard, Applications, Loans, Documents, Comms, Profile.

import React from "react";

export const renderPortalPage = () => {
      switch(page) {
        case "portal_dashboard": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:22, fontWeight:700 }}>Welcome{myCustomer ? `, ${myCustomer.contact}` : ""}</h2>
          {!myCustomer && <div style={{ background:C.amberBg, border:`1px solid ${C.amber}`, padding:"14px 18px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.amber }}>Complete Your Profile</div>
            <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>Your email ({myEmail}) is not linked to a customer record. Please contact TQA Capital to complete your onboarding.</div>
          </div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:20 }}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Applications</div><div style={{ fontSize:28, fontWeight:700, color:C.accent, marginTop:4 }}>{myApps.length}</div></div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:20 }}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Active Loans</div><div style={{ fontSize:28, fontWeight:700, color:C.green, marginTop:4 }}>{myLoans.filter(l=>l.status==="Active").length}</div></div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:20 }}><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Total Balance</div><div style={{ fontSize:28, fontWeight:700, color:C.blue, marginTop:4 }}>{fmt.cur(myLoans.reduce((s,l)=>s+l.balance,0))}</div></div>
          </div>
          {myApps.length > 0 && <div style={{ marginTop:16 }}><h3 style={{ fontSize:14, fontWeight:600, margin:"0 0 8px" }}>Recent Applications</h3>
            {myApps.slice(0,3).map(a=><div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:13, fontWeight:600 }}>{a.id} — {a.purpose?.substring(0,50)}</div><div style={{ fontSize:11, color:C.textMuted }}>{fmt.cur(a.amount)} · {a.term}m · {fmt.date(a.submitted||a.createdAt)}</div></div>
              <Badge color={a.status==="Approved"?"green":a.status==="Declined"?"red":a.status==="Draft"?"gray":"blue"}>{a.status}</Badge>
            </div>)}
          </div>}
        </div>);
        case "portal_applications": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:22, fontWeight:700 }}>My Applications</h2>
          <Table columns={[
            {label:"ID",render:r=><span style={{fontWeight:600}}>{r.id}</span>},
            {label:"Product",render:r=>prod(r.product)?.name||r.product},
            {label:"Amount",render:r=>fmt.cur(r.amount)},
            {label:"Term",render:r=>`${r.term}m`},
            {label:"Status",render:r=><Badge color={r.status==="Approved"?"green":r.status==="Declined"?"red":"blue"}>{r.status}</Badge>},
            {label:"Submitted",render:r=>fmt.date(r.submitted||r.createdAt)},
          ]} rows={myApps} emptyMsg="No applications found." />
        </div>);
        case "portal_loans": {
          const activeLoanId = portalPtp.loanId || portalPayment.loanId;
          const selLoan = myLoans.find(l=>l.id===activeLoanId);
          const handlePtp = () => {
            if (!portalPtp.date||!portalPtp.amount) return;
            const l = myLoans.find(x=>x.id===portalPtp.loanId);
            if (!l) return;
            const ptpEntry = { date:portalPtp.date, amount:+portalPtp.amount, notes:portalPtp.notes, status:"Pending", createdAt:Date.now(), createdBy:"Borrower" };
            const updLoans = loans.map(x=>x.id===l.id?{...x, ptpHistory:[...(x.ptpHistory||[]),ptpEntry]}:x);
            save({...data, loans:updLoans, audit:[...audit,{id:uid(),action:"PTP Submitted (Portal)",entity:l.id,user:myCustomer?.contact||"Borrower",detail:`PTP: ${fmt.cur(portalPtp.amount)} by ${portalPtp.date}. ${portalPtp.notes}`,ts:Date.now(),category:"Collections"}], alerts:[...alerts,{id:uid(),type:"Collections",severity:"info",title:`PTP from Borrower — ${l.id}`,msg:`${myCustomer?.name} committed ${fmt.cur(portalPtp.amount)} by ${portalPtp.date}`,read:false,ts:Date.now()}]});
            setPortalPtp({loanId:null,date:"",amount:"",notes:""});
          };
          const handlePayment = () => {
            if (!portalPayment.amount||!portalPayment.ref) return;
            const l = myLoans.find(x=>x.id===portalPayment.loanId);
            if (!l) return;
            const pmtEntry = { id:uid(), amount:+portalPayment.amount, method:portalPayment.method, ref:portalPayment.ref, date:Date.now(), status:"Processing", source:"Portal" };
            const newBal = Math.max(0, l.balance - (+portalPayment.amount));
            const updLoans = loans.map(x=>x.id===l.id?{...x, balance:newBal, payments:[...(x.payments||[]),pmtEntry]}:x);
            save({...data, loans:updLoans, audit:[...audit,{id:uid(),action:"Payment Submitted (Portal)",entity:l.id,user:myCustomer?.contact||"Borrower",detail:`${portalPayment.method} payment of ${fmt.cur(portalPayment.amount)} ref ${portalPayment.ref}. Balance: ${fmt.cur(newBal)}`,ts:Date.now(),category:"Servicing"}], alerts:[...alerts,{id:uid(),type:"Servicing",severity:"info",title:`Payment Received — ${l.id}`,msg:`${myCustomer?.name}: ${fmt.cur(portalPayment.amount)} via ${portalPayment.method} (ref: ${portalPayment.ref})`,read:false,ts:Date.now()}]});
            setPortalPayment({loanId:null,amount:"",method:"EFT",ref:""});
          };
          return (<div>
            <h2 style={{ margin:"0 0 16px", fontSize:22, fontWeight:700 }}>My Loans</h2>
            {myLoans.length===0 ? <div style={{ padding:40, textAlign:"center", color:C.textMuted }}>No active loans.</div> :
            myLoans.map(l=>(
              <div key={l.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"20px", marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700 }}>{l.id} — {prod(l.product)?.name||"Loan"}</div>
                    <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>Disbursed {fmt.date(l.disbursedAt)} · {l.rate}% · {l.term}m</div>
                  </div>
                  <Badge color={l.dpd>0?"red":"green"}>{l.dpd>0?`${l.dpd} DPD`:"Current"}</Badge>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Original</div><div style={{ fontSize:14, fontWeight:700 }}>{fmt.cur(l.amount)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Balance</div><div style={{ fontSize:14, fontWeight:700, color:l.dpd>0?C.red:C.text }}>{fmt.cur(l.balance)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Next Due</div><div style={{ fontSize:14, fontWeight:600 }}>{fmt.date(l.nextDue)}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase" }}>Instalment</div><div style={{ fontSize:14, fontWeight:600 }}>{fmt.cur(l.instalment||l.amount/Math.max(l.term,1))}</div></div>
                </div>
                {/* Recent payments */}
                {(l.payments||[]).length>0 && <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>Recent Payments</div>
                  {(l.payments||[]).slice(-3).reverse().map((p,i)=><div key={i} style={{ fontSize:11, color:C.textDim, padding:"3px 0", display:"flex", justifyContent:"space-between" }}><span>{fmt.date(p.date)} · {p.method} · {p.ref}</span><span style={{ fontWeight:600 }}>{fmt.cur(p.amount)}</span></div>)}
                </div>}
                <div style={{ display:"flex", gap:8, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <button onClick={()=>setPortalPayment({loanId:l.id,amount:"",method:"EFT",ref:""})} style={{ background:C.text, color:"#fff", border:"none", padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Make Payment</button>
                  {l.dpd>0 && <button onClick={()=>setPortalPtp({loanId:l.id,date:"",amount:"",notes:""})} style={{ background:"none", border:`1px solid ${C.border}`, padding:"8px 16px", fontSize:12, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Promise to Pay</button>}
                </div>
              </div>
            ))}
            {/* PTP Modal */}
            {portalPtp.loanId && <Modal title={`Promise to Pay — ${portalPtp.loanId}`} onClose={()=>setPortalPtp({loanId:null,date:"",amount:"",notes:""})}>
              <div style={{ display:"grid", gap:10 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Payment Date *</label><input type="date" value={portalPtp.date} onChange={e=>setPortalPtp({...portalPtp,date:e.target.value})} style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Amount (R) *</label><input type="number" value={portalPtp.amount} onChange={e=>setPortalPtp({...portalPtp,amount:e.target.value})} style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Notes</label><textarea value={portalPtp.notes} onChange={e=>setPortalPtp({...portalPtp,notes:e.target.value})} rows={2} style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <Btn onClick={handlePtp} disabled={!portalPtp.date||!portalPtp.amount}>Submit PTP</Btn>
              </div>
            </Modal>}
            {/* Payment Modal */}
            {portalPayment.loanId && <Modal title={`Make Payment — ${portalPayment.loanId}`} onClose={()=>setPortalPayment({loanId:null,amount:"",method:"EFT",ref:""})}>
              <div style={{ display:"grid", gap:10 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Amount (R) *</label><input type="number" value={portalPayment.amount} onChange={e=>setPortalPayment({...portalPayment,amount:e.target.value})} style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Payment Method</label><select value={portalPayment.method} onChange={e=>setPortalPayment({...portalPayment,method:e.target.value})} style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit", background:"#fff" }}>{["EFT","Debit Order","Card","Cash Deposit"].map(m=><option key={m}>{m}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:500, color:C.textDim, marginBottom:3 }}>Reference / Proof *</label><input value={portalPayment.ref} onChange={e=>setPortalPayment({...portalPayment,ref:e.target.value})} placeholder="Bank reference or deposit slip number" style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:"inherit" }} /></div>
                <div style={{ background:C.surface2, padding:"8px 12px", fontSize:11, color:C.textDim }}>Payment will be verified by our finance team within 24 hours. Balance updated upon confirmation.</div>
                <Btn onClick={handlePayment} disabled={!portalPayment.amount||!portalPayment.ref}>Submit Payment</Btn>
              </div>
            </Modal>}
          </div>);
        }
        case "portal_documents": {
          const KYB_FICA_DOCS = [
            { key:"sa_id", label:"SA ID Document", category:"KYC", required:true },
            { key:"proof_address", label:"Proof of Address (< 3 months)", category:"KYC", required:true },
            { key:"cipc", label:"Company Registration (CIPC)", category:"KYB", required:true },
            { key:"bank_confirm", label:"Bank Account Confirmation Letter", category:"KYB", required:true },
            { key:"financials", label:"Financial Statements / Management Accounts", category:"KYB", required:true },
            { key:"tax_clearance", label:"SARS Tax Clearance", category:"KYB", required:false },
            { key:"bee_cert", label:"BEE Certificate", category:"KYB", required:false },
            { key:"business_plan", label:"Business Plan", category:"KYB", required:false },
          ];
          const getDocStatus = (key) => {
            const doc = myDocs.find(d => d.docType === key);
            if (!doc) return { status:"Not Uploaded", color:"gray" };
            if (doc.status === "Approved") return { status:"Verified", color:"green" };
            if (doc.status === "Rejected") return { status:"Rejected — Re-upload Required", color:"red" };
            return { status:"Under Review", color:"blue" };
          };
          const allRequiredUploaded = KYB_FICA_DOCS.filter(d=>d.required).every(d=>myDocs.some(md=>md.docType===d.key));

          const handleDocUpload = (docDef) => {
            if (!myCustomer) return;
            const newDoc = { id:uid(), custId:myCustomer.id, appId:myApps[0]?.id||null, name:docDef.label, category:docDef.category, docType:docDef.key, status:"Pending Review", uploadedAt:Date.now(), uploadedBy:"Borrower", fileType:"PDF", size:"—" };
            save({...data, documents:[...documents,newDoc], audit:[...audit,{id:uid(),action:"Document Uploaded (Portal)",entity:newDoc.id,user:myCustomer.contact||"Borrower",detail:`${docDef.label} uploaded for ${myCustomer.name}`,ts:Date.now(),category:"Documents"}], alerts:[...alerts,{id:uid(),type:"Documents",severity:"info",title:`Document Upload — ${myCustomer.name}`,msg:`${docDef.label} uploaded via borrower portal. Review required.`,read:false,ts:Date.now()}]});
          };

          const runBankVerification = () => {
            setPortalVerify({...portalVerify, running:true, bankStatus:null});
            setTimeout(()=>{ setPortalVerify(v=>({...v, running:false, bankStatus:"verified"})); save({...data, audit:[...audit,{id:uid(),action:"Bank Account Verified (API)",entity:myCustomer?.id,user:"System",detail:`Bank account verification API call completed. Status: Verified.`,ts:Date.now(),category:"Compliance"}]}); }, 1500);
          };
          const runCreditCheck = () => {
            setPortalVerify({...portalVerify, running:true, creditStatus:null});
            setTimeout(()=>{ const score = 580 + Math.floor(Math.random()*120); setPortalVerify(v=>({...v, running:false, creditStatus:`Score: ${score}`})); save({...data, audit:[...audit,{id:uid(),action:"Credit Bureau Check (API)",entity:myCustomer?.id,user:"System",detail:`Credit vetting API call completed. Bureau score: ${score}.`,ts:Date.now(),category:"Compliance"}]}); }, 2000);
          };

          return (<div>
            <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700 }}>KYB / FICA Documents</h2>
            <p style={{ fontSize:12, color:C.textDim, margin:"0 0 16px" }}>Upload all required documents to proceed with your loan application. A tracking number will be assigned once all mandatory documents are received.</p>

            {/* Progress indicator */}
            {(()=>{const req=KYB_FICA_DOCS.filter(d=>d.required).length; const done=KYB_FICA_DOCS.filter(d=>d.required&&myDocs.some(md=>md.docType===d.key)).length; return (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}><span style={{ fontWeight:600 }}>Mandatory Documents</span><span style={{ color:done===req?C.green:C.amber, fontWeight:600 }}>{done}/{req}</span></div>
                  <div style={{ height:6, background:C.surface2, borderRadius:3 }}><div style={{ height:6, background:done===req?C.green:C.amber, borderRadius:3, width:`${(done/req)*100}%`, transition:"width .3s" }} /></div>
                </div>
                {allRequiredUploaded && <Badge color="green">Ready for Review</Badge>}
              </div>
            );})()}

            {/* Document checklist */}
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
              {KYB_FICA_DOCS.map(doc=>{
                const st = getDocStatus(doc.key);
                return (
                  <div key={doc.key} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:st.color==="green"?C.green:st.color==="red"?C.red:st.color==="blue"?C.blue:C.border }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{doc.label}{doc.required&&<span style={{ color:C.red, marginLeft:3 }}>*</span>}</div>
                        <div style={{ fontSize:10, color:st.color==="green"?C.green:st.color==="red"?C.red:st.color==="blue"?C.blue:C.textMuted }}>{st.status}</div>
                      </div>
                    </div>
                    {(st.status==="Not Uploaded"||st.status.includes("Re-upload")) && (
                      <button onClick={()=>handleDocUpload(doc)} style={{ background:C.text, color:"#fff", border:"none", padding:"6px 14px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Upload</button>
                    )}
                    {st.status==="Under Review" && <span style={{ fontSize:10, color:C.blue, fontWeight:500 }}>Pending verification</span>}
                  </div>
                );
              })}
            </div>

            {/* API Verifications */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"16px 18px" }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Verification Checks</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ border:`1px solid ${C.border}`, padding:"14px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Bank Account Verification</div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Verify your bank account details via API integration.</div>
                  {portalVerify.bankStatus==="verified" ? <Badge color="green">Verified</Badge> :
                   <button onClick={runBankVerification} disabled={portalVerify.running} style={{ background:portalVerify.running?C.border:C.text, color:portalVerify.running?C.textMuted:"#fff", border:"none", padding:"7px 16px", fontSize:11, fontWeight:600, cursor:portalVerify.running?"not-allowed":"pointer", fontFamily:"inherit" }}>{portalVerify.running?"Verifying...":"Verify Bank Account"}</button>}
                </div>
                <div style={{ border:`1px solid ${C.border}`, padding:"14px" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Credit Bureau Check</div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Run a credit vetting check (TransUnion/Experian).</div>
                  {portalVerify.creditStatus ? <Badge color="blue">{portalVerify.creditStatus}</Badge> :
                   <button onClick={runCreditCheck} disabled={portalVerify.running} style={{ background:portalVerify.running?C.border:C.text, color:portalVerify.running?C.textMuted:"#fff", border:"none", padding:"7px 16px", fontSize:11, fontWeight:600, cursor:portalVerify.running?"not-allowed":"pointer", fontFamily:"inherit" }}>{portalVerify.running?"Running check...":"Run Credit Check"}</button>}
                </div>
              </div>
            </div>
          </div>);
        }
        case "portal_comms": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:22, fontWeight:700 }}>Messages</h2>
          {myComms.length === 0 ? <div style={{ textAlign:"center", padding:40, color:C.textMuted }}>No messages.</div> :
          myComms.sort((a,b)=>b.ts-a.ts).map(c=><div key={c.id} style={{ background:C.surface, border:`1px solid ${C.border}`, padding:"12px 16px", marginBottom:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textMuted }}><span>{c.channel} · {c.direction}</span><span>{fmt.date(c.ts)}</span></div>
            <div style={{ fontSize:13, fontWeight:600, marginTop:4 }}>{c.subject}</div>
            <div style={{ fontSize:12, color:C.textDim, marginTop:4, lineHeight:1.5 }}>{c.body}</div>
          </div>)}
        </div>);
        case "portal_profile": return (<div>
          <h2 style={{ margin:"0 0 16px", fontSize:22, fontWeight:700 }}>My Profile</h2>
          {myCustomer ? <SectionCard title="Business Details">
            <InfoGrid items={[["Business Name",myCustomer.name],["Contact",myCustomer.contact],["Email",myCustomer.email],["Phone",myCustomer.phone],["Industry",myCustomer.industry],["BEE Level",`Level ${myCustomer.beeLevel}`],["FICA Status",myCustomer.ficaStatus],["Province",myCustomer.province]]} />
          </SectionCard> : <div style={{ padding:32, textAlign:"center", color:C.textMuted }}>Profile not linked. Contact TQA Capital support.</div>}
        </div>);
        default: return <div>Page not found.</div>;
      }
    }
