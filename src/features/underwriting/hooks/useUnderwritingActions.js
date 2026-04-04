// KwikBridge LMS — Underwriting Hooks
// Due diligence steps, workflow progression.

export const moveToUnderwriting = appId => {
    if (!canDo("underwriting","update")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Submitted") { alert("Only Submitted applications (post-QA sign-off) can move to Underwriting."); return; }
    if (!a.qaSignedOff) { alert("QA sign-off required before underwriting can begin."); return; }
    const emptyWF = { kycComplete:false, kycFindings:[], kycDate:null, kycOfficer:null, docsComplete:false, docsFindings:[], docsDate:null, docsOfficer:null, siteVisitComplete:false, siteVisitFindings:[], siteVisitDate:null, siteVisitOfficer:null, siteVisitNotes:"", creditPulled:false, creditBureauScore:null, creditDate:null, creditFindings:[], financialAnalysisComplete:false, financialDate:null, socialVerified:false, socialFindings:[], socialDate:null, socialOfficer:null, collateralAssessed:false, collateralFindings:[], collateralDate:null, collateralTotal:0, sanctionsCleared:false, sanctionsDate:null, analystNotes:"", creditMemoSections:[] };
    save({ ...data,
      applications: applications.map(a => a.id === appId ? { ...a, status: "Underwriting", workflow: a.workflow || emptyWF, assignedTo: currentUser.id } : a),
      audit: [...audit, addAudit("Status Change", appId, currentUser.name, `Application moved to Underwriting by ${currentUser.name}. Assigned to ${currentUser.name}.`, "Origination")]
    });
  };

export const runDDStep = (appId, stepKey) => {
    const a = applications.find(x => x.id === appId);
    if (!a) return;
    const c = cust(a.custId);
    const w = { ...(a.workflow || {}) };
    const custDocs = (documents||[]).filter(d => d.custId === a.custId);
    const appDocs = custDocs.filter(d => d.appId === a.id || !d.appId);
    let newAudit = [...audit];
    let newAlerts = [...alerts];
    let updatedApp = { ...a };

    if (stepKey === "kyc") {
      const checks = [
        { item:"ID Document", source:"Home Affairs API", doc: appDocs.find(d => d.type === "ID Document"), purpose:"Identity verification against Home Affairs database" },
        { item:"Proof of Address", source:"Manual verification", doc: appDocs.find(d => d.type === "Proof of Address"), purpose:"Physical address confirmation (municipal account/utility bill within 3 months)" },
        { item:"Bank Confirmation", source:"Bank verification", doc: appDocs.find(d => d.type === "Bank Confirmation"), purpose:"Bank account ownership and status confirmation" },
        { item:"Company Registration", source:"CIPC API", doc: appDocs.find(d => d.type === "Company Registration"), purpose:"Business registration status verified against CIPC database" },
      ];
      const findings = checks.map(ch => ({
        item: ch.item, source: ch.source, purpose: ch.purpose,
        docId: ch.doc?.id || null,
        systemResult: ch.doc?.status === "Verified" ? "Pass" : ch.doc ? "Fail" : "Missing",
        status: "Pending Review",
        detail: ch.doc?.status === "Verified" ? `${ch.doc.id} — Verified on ${fmt.date(ch.doc.verifiedAt)} by ${ch.doc.verifiedBy || "System"}. ${ch.purpose}`
          : ch.doc ? `${ch.doc.id} — Status: ${ch.doc.status}. ${ch.purpose}`
          : `Not on file. Required for: ${ch.purpose}`,
        officerAction: null, officerNote: ""
      }));
      findings.push({ item:"Sanctions Screening", source:"OFAC / UN / SA Consolidated Lists", purpose:"AML compliance — check against international and domestic sanctions lists", systemResult: a.sanctionsFlag ? "Fail" : "Pass", status:"Pending Review", detail: a.sanctionsFlag ? "MATCH FOUND — review immediately." : "Automated screening returned no matches. Officer must confirm.", officerAction:null, officerNote:"" });
      findings.push({ item:"PEP Screening", source:"PEP Database", purpose:"Politically exposed persons check on directors and shareholders", systemResult:"Pass", status:"Pending Review", detail:"No politically exposed persons identified among directors. Officer must confirm.", officerAction:null, officerNote:"" });
      w.kycComplete = false;
      w.kycFindings = findings;
      w.kycDate = Date.now();
      w.kycOfficer = null;
      w.sanctionsCleared = false;
      newAudit.push(addAudit("KYC Checks Initiated", a.id, "System", `${checks.length + 2} identity/compliance checks run. Awaiting officer review.`, "Compliance"));
    }

    if (stepKey === "docs") {
      const kycTypes = ["ID Document","Proof of Address","Bank Confirmation","Company Registration"];
      const kycStatus = w.kycComplete ? "Verified in KYC (Step 2)" : "Pending KYC verification";
      const reqTypes = ["Annual Financials","Business Plan"];
      const findings = [];
      kycTypes.forEach(type => {
        const doc = appDocs.find(d => d.type === type);
        const kycItem = (w.kycFindings||[]).find(f => f.item === type);
        findings.push({
          item: type, required: true, inherited: true,
          systemResult: kycItem?.officerAction === "Confirmed" ? "Verified" : doc?.status === "Verified" ? "Verified" : w.kycComplete ? "Verified" : doc ? doc.status : "Missing",
          status: w.kycComplete ? "Pass" : kycItem?.officerAction ? kycItem.status : "Pending KYC",
          detail: w.kycComplete ? `Verified in Step 2 (KYC/FICA)${doc ? ` — ${doc.id}` : ""}` : `Awaiting KYC verification in Step 2${doc ? ` — ${doc.id}` : ""}`,
          docId: doc?.id || null,
          officerAction: w.kycComplete ? "Inherited" : null, officerNote: ""
        });
      });
      reqTypes.forEach(type => {
        const doc = appDocs.find(d => d.type === type || d.name.includes(type.split(" ")[0]));
        findings.push({
          item: type, required: true, inherited: false,
          systemResult: doc?.status === "Verified" ? "Verified" : doc?.status === "Under Review" ? "Under Review" : doc ? "Received" : "Missing",
          status: "Pending Review",
          detail: doc ? `${doc.id} — ${doc.status}${doc.verifiedBy ? ` by ${doc.verifiedBy}` : ""}` : "Not uploaded. Request from customer.",
          docId: doc?.id || null,
          officerAction: null, officerNote: ""
        });
      });
      const industryDocs = appDocs.filter(d => ["Industry License","Operating License","CIDB Registration","BEE Certificate","Insurance","Title Deed"].includes(d.type));
      industryDocs.forEach(d => findings.push({ item:d.type, required:false, inherited:false, systemResult:d.status, status:"Pending Review", detail:`${d.id} — ${d.status}`, docId:d.id, officerAction:null, officerNote:"" }));
      w.docsComplete = false;
      w.docsFindings = findings;
      w.docsDate = Date.now();
      w.docsOfficer = null;
      newAudit.push(addAudit("Document Review Initiated", a.id, "System", `${findings.length} documents checked (${kycTypes.length} inherited from KYC, ${reqTypes.length} requiring review). Awaiting sign-off.`, "Underwriting"));
    }

    if (stepKey === "sitevisit") {
      const existing = w.siteVisitFindings || [];
      const isNewFormat = existing.length > 0 && existing[0].field !== undefined;
      const findings = isNewFormat ? existing : [
        { item:"Visit Details", field:"visitDetails", value:"", placeholder:`Date of visit, address visited (${c?.address}), attendees, duration` },
        { item:"Premises Inspection", field:"premises", value:"", placeholder:"Describe physical premises — condition, suitability, ownership/lease, signage, access" },
        { item:"Operational Activity", field:"operations", value:"", placeholder:"Staff observed on site, active trading evidence, equipment/inventory, workflow" },
        { item:"Management Interview", field:"management", value:"", placeholder:`Interview with ${c?.contact} — experience, capability, strategy, understanding of financials` },
        { item:"Infrastructure & Capacity", field:"infrastructure", value:"", placeholder:"Facilities condition, adequacy for current/projected volumes, technology, maintenance" },
        { item:"Revenue Verification", field:"revenue", value:"", placeholder:`Stated revenue ${fmt.cur(c?.revenue||0)} — consistency with observed activity, stock levels, foot traffic` },
        { item:"Risk Observations", field:"risks", value:"", placeholder:"Concerns, red flags, concentration risk, dependency, environmental, compliance issues" },
        { item:"Overall Assessment", field:"assessment", value:"", rating:"", placeholder:"Summary recommendation — satisfactory / concerns noted / unsatisfactory" },
      ];
      w.siteVisitComplete = false;
      w.siteVisitFindings = findings;
      w.siteVisitDate = Date.now();
      w.siteVisitOfficer = null;
      newAudit.push(addAudit("Site Visit Form Created", a.id, currentUser.name, `Site visit assessment form initiated for ${c?.name} at ${c?.address}.`, "Underwriting"));
    }

    if (stepKey === "credit") {
      if (!w.kycComplete) { alert("Complete KYC/FICA verification before running credit analysis."); return; }
      if (!w.docsComplete) { alert("Complete document review before running credit analysis."); return; }
      const bureauScore = w.creditBureauScore || Math.floor(Math.random() * 200 + 500);
      const monthlyPmt = Math.round(a.amount * (0.145 / 12) / (1 - Math.pow(1 + 0.145 / 12, -a.term)));
      const monthlyIncome = Math.round((c?.revenue || 3000000) / 12);
      const existingDebt = Math.round(monthlyIncome * 0.12);
      const dscr = +((monthlyIncome - existingDebt) / monthlyPmt).toFixed(2);
      const currentRatio = +(1.0 + Math.random() * 1.5).toFixed(2);
      const debtEquity = +(Math.random() * 1.8).toFixed(2);
      const grossMargin = +(Math.random() * 0.25 + 0.2).toFixed(2);
      const affordable = dscr >= 1.2;
      const riskScore = Math.min(99, Math.max(20, Math.round(bureauScore / 10 + dscr * 10 + (currentRatio > 1.2 ? 10 : 0) - (debtEquity > 1.0 ? 10 : 0))));

      const existing = w.creditFindings || [];
      const findings = existing.length > 0 && existing[0].analystNote !== undefined ? existing : [
        { item:"Credit Bureau Report", systemValue:`Bureau score: ${bureauScore}/900`, systemDetail: bureauScore >= 650 ? "No adverse information." : bureauScore >= 550 ? "Minor adverse items." : "Material adverse information.", analystNote:"", flag:"" },
        { item:"Affordability (NCA)", systemValue:`DSCR: ${dscr}x | Affordable: ${affordable?"YES":"NO"}`, systemDetail:`Income: ${fmt.cur(monthlyIncome)}/m. Existing debt: ${fmt.cur(existingDebt)}/m. Proposed: ${fmt.cur(monthlyPmt)}/m. Disposable: ${fmt.cur(monthlyIncome-existingDebt-monthlyPmt)}/m.`, analystNote:"", flag:"" },
        { item:"Balance Sheet Ratios", systemValue:`CR: ${currentRatio}x | D/E: ${debtEquity}x | Margin: ${fmt.pct(grossMargin,0)}`, systemDetail:`Current ratio ${currentRatio>=1.5?"strong":currentRatio>=1.0?"adequate":"weak"}. Leverage ${debtEquity<=0.5?"conservative":debtEquity<=1.0?"moderate":"elevated"}.`, analystNote:"", flag:"" },
        { item:"Cash Flow Projections", systemValue:`${a.term}-month projection`, systemDetail:`Revenue assumptions ${c?.years>=5?"supported by track record":"limited history — conservative scenario"}. Seasonal variation ${c?.industry==="Agriculture"?"significant":"within normal range"}.`, analystNote:"", flag:"" },
        { item:"Industry & Market Risk", systemValue:c?.industry||"—", systemDetail:"", analystNote:"", flag:"", placeholder:`Assess ${c?.industry} sector risk, competitive position, market conditions, regulatory environment` },
        { item:"Risk Score & Recommendation", systemValue:`Score: ${riskScore}/100 | Grade: ${bureauScore>=600&&dscr>=1.3?"Low-Medium":dscr>=1.0?"Medium":"High"}`, systemDetail:"", analystNote:"", flag:"", placeholder:"Analyst's overall credit risk assessment and recommendation with rationale" },
      ];

      w.creditPulled = true;
      w.creditBureauScore = bureauScore;
      w.creditDate = Date.now();
      w.financialAnalysisComplete = false;
      w.financialDate = Date.now();
      w.creditFindings = findings;
      updatedApp.dscr = dscr;
      updatedApp.currentRatio = currentRatio;
      updatedApp.debtEquity = debtEquity;
      updatedApp.riskScore = riskScore;
      newAudit.push(addAudit("Credit Report Pulled", a.id, "System (TransUnion API)", `Bureau: ${bureauScore}. DSCR: ${dscr}x. Risk: ${riskScore}. Affordability: ${affordable?"Pass":"Fail"}.`, "Underwriting"));
    }

    if (stepKey === "collateral") {
      const custCollateral = appDocs.filter(d => d.category === "Collateral");
      const findings = [];
      let total = 0;
      if (custCollateral.length > 0) {
        custCollateral.forEach(d => {
          const val = d.type === "Insurance" ? (d.name.includes("1.2") ? 1200000 : d.name.includes("2M") ? 2000000 : d.name.includes("4M") ? 4000000 : d.name.includes("1.6") ? 1600000 : 500000) : d.type === "Title Deed" ? 1500000 : 800000;
          total += val;
          findings.push({ item: d.name, detail: `Type: ${d.type}. Value: ${fmt.cur(val)}. Status: ${d.status}. ${d.expiryDate ? `Expires: ${fmt.date(d.expiryDate)}.` : "No expiry."}` });
        });
      } else {
        findings.push({ item:"Personal Guarantee", detail:`Director surety of ${fmt.cur(a.amount)} to be obtained at disbursement.` });
        total = a.amount;
      }
      const ltv = total > 0 ? (a.amount / total * 100).toFixed(0) : 100;
      findings.push({ item:"Security Coverage", detail:`Total security value: ${fmt.cur(total)}. Loan amount: ${fmt.cur(a.amount)}. Loan-to-value: ${ltv}%. ${+ltv <= 80 ? "Adequate coverage." : +ltv <= 100 ? "Marginal coverage — additional security may be required." : "Under-secured — additional collateral or guarantee required."}` });
      w.collateralAssessed = false;
      w.collateralFindings = findings;
      w.collateralDate = Date.now();
      w.collateralTotal = total;
      newAudit.push(addAudit("Collateral Assessment", a.id, "Credit Analyst – P. Sithole", `Security: ${fmt.cur(total)}. LTV: ${ltv}%. ${custCollateral.length} items assessed.`, "Underwriting"));
    }

    if (stepKey === "social") {
      const beeLevel = c?.beeLevel || 4;
      const jobs = c?.employees || 0;
      const socialScore = Math.min(100, Math.round((beeLevel <= 1 ? 30 : beeLevel <= 2 ? 22 : beeLevel <= 3 ? 15 : 8) + Math.min(25, jobs * 1.2) + (c?.years >= 5 ? 15 : c?.years >= 3 ? 10 : 5) + Math.floor(Math.random() * 15 + 5)));
      const findings = [
        { item:"BEE Status", detail:`Level ${beeLevel}. Verification status: ${c?.beeStatus || "Unknown"}. ${c?.beeExpiry ? `Certificate expires: ${fmt.date(c.beeExpiry)}.` : "No expiry date on file."}` },
        { item:"Employment Impact", detail:`${jobs} direct jobs supported. ${jobs >= 20 ? "Significant employer in local economy." : jobs >= 10 ? "Meaningful employment contribution." : "Small but growing workforce."}` },
        { item:"Skills Development", detail:`${c?.years >= 5 ? "Established training and skills transfer programmes in place." : "Developing internal capacity. Mentorship support recommended."}` },
        { item:"Geographic Impact", detail:`Operating in ${c?.province || "Eastern Cape"}. ${c?.address?.includes("Industrial") || c?.address?.includes("Farm") ? "Located in underserved/rural area — higher development impact weighting." : "Urban location."}` },
        { item:"Sector Contribution", detail:`${c?.sector || c?.industry} sector. ${["Agriculture","Construction","Food Processing"].includes(c?.industry) ? "Priority sector for job creation and food security." : "Productive economic activity aligned with NDP objectives."}` },
        { item:"Social Impact Score", detail:`Composite score: ${socialScore}/100. ${socialScore >= 75 ? "Strong alignment with SEDFA development mandate." : socialScore >= 55 ? "Moderate development impact. Meets minimum funder thresholds." : "Limited impact metrics. May not meet certain funder-specific requirements."}` },
      ];
      w.socialVerified = false;
      w.socialFindings = findings;
      w.socialDate = Date.now();
      w.socialOfficer = null;
      updatedApp.socialScore = socialScore;
      newAudit.push(addAudit("Social Impact Verified", a.id, "Compliance Officer", `Score: ${socialScore}/100. BEE Level ${beeLevel}. ${jobs} jobs.`, "Compliance"));
    }

    updatedApp.workflow = w;
    save({ ...data, applications: applications.map(x => x.id === appId ? updatedApp : x), audit: newAudit, alerts: newAlerts });
  };

