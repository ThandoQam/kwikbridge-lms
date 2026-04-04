// @ts-nocheck
// KwikBridge LMS — Loan Decision Hooks
// Approve/decline, booking, disbursement.

export const decideLoan = (appId, decision) => {
    if (!canDo("underwriting","approve")) { alert("Permission denied: you cannot approve/decline applications."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const limit = approvalLimit(role);
    if (decision === "Approved" && a.amount > limit) { alert(`Authority exceeded: your limit is ${fmt.cur(limit)}. This application (${fmt.cur(a.amount)}) requires escalation to ${a.amount > 1000000 ? "Credit Committee" : "Head of Credit"}.`); return; }
    if (a.createdBy === currentUser.id) { alert("Separation of duties: you cannot approve an application you created."); return; }
    const w = a.workflow || {};
    const c = cust(a.custId);
    const p = prod(a.product);
    const memoSections = [];
    if (w.kycFindings?.length) memoSections.push(`KYC/FICA: ${w.kycComplete ? "All checks passed." : "Incomplete — see findings."}`);
    if (w.docsFindings?.length) { const vd = w.docsFindings.filter(f=>f.status==="Verified").length; memoSections.push(`Documents: ${vd}/${w.docsFindings.length} verified.`); }
    if (w.siteVisitFindings?.length) memoSections.push(`Site visit completed ${fmt.date(w.siteVisitDate)}. ${w.siteVisitFindings.length} areas assessed.`);
    if (w.creditFindings?.length) memoSections.push(`Bureau: ${w.creditBureauScore}. DSCR: ${a.dscr}x. Risk score: ${a.riskScore}/100.`);
    if (w.collateralFindings?.length) memoSections.push(`Security: ${fmt.cur(w.collateralTotal)}. LTV: ${a.amount && w.collateralTotal ? (a.amount/w.collateralTotal*100).toFixed(0) : "—"}%.`);
    if (w.socialFindings?.length) memoSections.push(`Social impact: ${a.socialScore}/100. BEE Level ${c?.beeLevel}.`);
    if (w.analystNotes) memoSections.push(`Analyst notes: ${w.analystNotes}`);
    const recommendation = decision === "Approved" ? `Recommendation: APPROVE. ${p?.name} of ${fmt.cur(a.amount)} over ${a.term} months.` : `Recommendation: DECLINE. ${a.dscr < 1.2 ? "DSCR below threshold. " : ""}${a.riskScore < 50 ? "Risk score below acceptable level." : ""}`;
    memoSections.push(recommendation);
    const approver = `${currentUser.name} (${ROLES[role]?.label})`;
    const conditions = decision === "Approved" ? [
      `Maintain DSCR above ${a.dscr >= 1.5 ? "1.3" : "1.2"}`,
      "Submit quarterly management accounts within 30 days of quarter-end",
      "Maintain adequate insurance on all financed assets",
      ...(c?.beeLevel <= 2 ? ["Maintain BEE Level " + c.beeLevel + " status"] : []),
      ...(a.amount > 1000000 ? ["Annual audited financial statements required"] : []),
    ] : [];
    const updated = { ...a, status: decision, decided: Date.now(), recommendation: decision, approver, creditMemo: memoSections.join("\n"), conditions, rate: decision === "Approved" ? (p?.baseRate || 14.5) : null };
    save({ ...data,
      applications: applications.map(x => x.id === appId ? updated : x),
      audit: [...audit, addAudit(`Credit Decision – ${decision}`, appId, approver, `${decision}. Risk: ${a.riskScore}. DSCR: ${a.dscr}x. Bureau: ${w.creditBureauScore}. Social: ${a.socialScore}.`, "Decision")],
      alerts: [...alerts, addAlert("Application", decision==="Approved"?"info":"warning", `${decision} – ${c?.name}`, `${appId} ${decision.toLowerCase()} by ${currentUser.name}. Amount: ${fmt.cur(a.amount)}.`)]
    });
  };

export const bookLoan = (appId) => {
    if (!canDo("loans","update")) { alert("Permission denied: you cannot book loans."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Approved") { alert("Only Approved applications can be booked."); return; }
    const c = cust(a.custId);
    const p = prod(a.product);
    const w = a.workflow || {};
    const cpFail = [];
    if (!w.kycComplete) cpFail.push("KYC/FICA not verified");
    if (!w.docsComplete) cpFail.push("Document checklist incomplete");
    if (c?.ficaStatus !== "Verified") cpFail.push(`FICA status: ${c?.ficaStatus} (must be Verified)`);
    if (c?.beeStatus !== "Verified" && p?.eligibleBEE?.length < 4) cpFail.push("BEE certificate not verified");
    if (cpFail.length > 0) { alert(`Conditions precedent not met:\n${cpFail.join("\n")}\n\nResolve before booking.`); return; }
    const rate = a.rate || p?.baseRate || 14.5;
    const monthlyPmt = Math.round(a.amount * (rate / 100 / 12) / (1 - Math.pow(1 + rate / 100 / 12, -a.term)));
    const loan = { id:`LN-${String(loans.length+1).padStart(3,"0")}`, appId, custId:a.custId, status:"Booked", amount:a.amount, balance:a.amount, rate, term:a.term, monthlyPmt, disbursed:null, nextDue:null, lastPmt:null, lastPmtAmt:null, totalPaid:0, dpd:0, stage:1, payments:[], bookedAt:Date.now(), bookedBy:currentUser.id, disbursedBy:null, disbursementAuth2:null, preDisbursementAML:null, covenants:(a.conditions||[]).map(c=>({name:c,status:"Compliant",value:"—",checked:Date.now()})), collateral:w.collateralFindings?.filter(f=>f.item!=="Security Coverage").map(f=>({type:f.item,value:0,description:f.detail}))||[], arrangementFee: Math.round(a.amount * ((p?.arrangementFee||1)/100)) };
    const updatedApp = { ...a, status:"Booked" };
    save({ ...data,
      applications: applications.map(x => x.id === appId ? updatedApp : x),
      loans: [...loans, loan],
      provisions: [...provisions, {loanId:loan.id,stage:1,pd:0.02,lgd:0.25,ead:a.amount,ecl:Math.round(a.amount*0.005),method:"12-month ECL"}],
      audit: [...audit,
        addAudit("Loan Booked", loan.id, currentUser.name, `Loan ${loan.id} booked. Amount: ${fmt.cur(a.amount)}. Rate: ${rate}%. Conditions verified.`, "Booking"),
        addAudit("Agreement Generated", loan.id, "System", `Loan agreement generated for ${c?.name}. Awaiting signatures and disbursement.`, "Booking"),
      ],
      alerts: [...alerts, addAlert("Loan","info",`Loan Booked – ${c?.name}`,`${loan.id} booked for ${fmt.cur(a.amount)}. Awaiting disbursement.`)]
    });
  };

export const disburseLoan = (loanId) => {
    if (!canDo("servicing","create") && !canDo("loans","update")) { alert("Permission denied: you cannot disburse loans."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l || l.status !== "Booked") { alert("Only Booked loans can be disbursed."); return; }
    const c = cust(l.custId);
    const amlClear = true; // Placeholder for API
    if (!amlClear) { alert("Pre-disbursement AML check failed. Disbursement blocked."); return; }
    if (l.bookedBy === currentUser.id) { alert("Dual authorization required: the person who booked the loan cannot disburse it."); return; }
    const updated = { ...l, status:"Active", disbursed:Date.now(), disbursedBy:currentUser.id, preDisbursementAML:{ clear:true, date:Date.now(), checkedBy:currentUser.name }, nextDue:Date.now()+30*day };
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? updated : x),
      audit: [...audit,
        addAudit("Pre-disbursement AML", loanId, "System", `AML screening clear. No sanctions matches.`, "Compliance"),
        addAudit("Loan Disbursed", loanId, currentUser.name, `${fmt.cur(l.amount)} disbursed to ${c?.name}. Dual auth: booked by ${SYSTEM_USERS.find(u=>u.id===l.bookedBy)?.name}, disbursed by ${currentUser.name}.`, "Disbursement"),
      ],
      alerts: [...alerts, addAlert("Loan","info",`Disbursement – ${c?.name}`,`${loanId}: ${fmt.cur(l.amount)} disbursed to ${c?.name}.`)]
    });
  };

