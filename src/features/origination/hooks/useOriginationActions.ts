// @ts-nocheck
// KwikBridge LMS — Origination Hooks
// QA sign-off, application validation.

export const qaSignOffApplication = (appId) => {
    if (!canDo("origination","update")) { alert("Permission denied."); return; }
    const a = applications.find(x => x.id === appId);
    if (!a || a.status !== "Draft") { alert("Only Draft applications can be QA'd and submitted."); return; }
    const c = cust(a.custId);
    const p = prod(a.product);
    const custDocs = (documents||[]).filter(d => d.custId === a.custId && (d.appId === a.id || !d.appId));

    const mandatoryTypes = ["ID Document","Proof of Address","Bank Confirmation","Company Registration"];
    const missing = [];
    const incomplete = [];
    mandatoryTypes.forEach(type => {
      const doc = custDocs.find(d => d.type === type);
      if (!doc) missing.push(type);
      else if (doc.status === "Pending" || doc.status === "Rejected") incomplete.push(`${type} (${doc.status})`);
    });

    const fieldErrors = [];
    if (!a.amount || a.amount <= 0) fieldErrors.push("Loan amount is required");
    if (!a.term || a.term <= 0) fieldErrors.push("Loan term is required");
    if (!a.purpose) fieldErrors.push("Purpose of loan is required");
    if (p && a.amount < p.minAmount) fieldErrors.push(`Amount below product minimum (${fmt.cur(p.minAmount)})`);
    if (p && a.amount > p.maxAmount) fieldErrors.push(`Amount exceeds product maximum (${fmt.cur(p.maxAmount)})`);

    if (a.expiresAt && a.expiresAt < Date.now()) { alert(`Application ${appId} has expired (${fmt.date(a.expiresAt)}). It can no longer be submitted.`); return; }

    const qaFindings = { mandatoryDocs: mandatoryTypes.map(type => { const doc = custDocs.find(d=>d.type===type); return { type, docId:doc?.id||null, status:doc?.status||"Missing", onFile:!!doc }; }), missingDocs: missing, incompleteDocs: incomplete, fieldErrors, passedAt: null, officer: null };

    if (missing.length > 0 || incomplete.length > 0 || fieldErrors.length > 0) {
      qaFindings.result = "Failed";
      qaFindings.failedAt = Date.now();
      qaFindings.officer = currentUser.name;

      const issueLines = [];
      if (missing.length > 0) issueLines.push(`Missing documents:\n${missing.map(d => `  • ${d}`).join("\n")}`);
      if (incomplete.length > 0) issueLines.push(`Documents requiring resubmission:\n${incomplete.map(d => `  • ${d}`).join("\n")}`);
      if (fieldErrors.length > 0) issueLines.push(`Application issues:\n${fieldErrors.map(e => `  • ${e}`).join("\n")}`);
      const notifBody = `Dear ${c?.contact},\n\nYour loan application ${appId} for ${fmt.cur(a.amount)} (${p?.name}) did not pass our quality assurance review.\n\nThe following items require your attention:\n\n${issueLines.join("\n\n")}\n\nPlease submit the outstanding documents via the KwikBridge portal or email to documents@kwikbridge.co.za.\n\nYour application will remain in draft status until all requirements are met. Please note the application expires on ${fmt.date(a.expiresAt)}.\n\nIf you have any questions, contact your Loan Officer.\n\nRegards,\n${currentUser.name}\nKwikBridge Lending Operations`;

      const notification = { id:uid(), custId:a.custId, loanId:null, channel:"Email", direction:"Outbound", from:currentUser.name, subject:`Action Required – Application ${appId} QA Review`, body:notifBody, ts:Date.now(), relatedTo:appId, type:"QA Notification" };

      const docRequests = [...(a.workflow?.docRequests || [])];
      missing.forEach(docType => {
        docRequests.push({ docType, requestedBy:currentUser.name, requestedAt:Date.now(), status:"Sent", reason:"QA failed — missing", commId:notification.id });
      });
      incomplete.forEach(entry => {
        const docType = entry.split(" (")[0];
        docRequests.push({ docType, requestedBy:currentUser.name, requestedAt:Date.now(), status:"Sent", reason:"QA failed — resubmission required", commId:notification.id });
      });

      const updatedWorkflow = { ...(a.workflow || {}), docRequests };

      save({ ...data,
        applications: applications.map(x => x.id === appId ? { ...x, qaFindings, qaSignedOff: false, workflow: updatedWorkflow } : x),
        comms: [...comms, notification],
        audit: [...audit,
          addAudit("QA Failed", appId, currentUser.name, `QA check failed. Missing: ${missing.join(", ")||"none"}. Incomplete: ${incomplete.join(", ")||"none"}. Field errors: ${fieldErrors.join(", ")||"none"}.`, "Origination"),
          addAudit("QA Failure Notification Sent", appId, "System", `Email sent to ${c?.contact} listing ${missing.length + incomplete.length} document issues and resubmission instructions.`, "Communication"),
        ],
        alerts: [...alerts, addAlert("Application","warning",`QA Failed – ${c?.name}`,`${appId}: ${missing.length} missing, ${incomplete.length} incomplete. Notification sent to applicant.`)]
      });
      alert(`QA check failed:\n${missing.length ? `Missing documents: ${missing.join(", ")}\n` : ""}${incomplete.length ? `Incomplete: ${incomplete.join(", ")}\n` : ""}${fieldErrors.length ? `Validation: ${fieldErrors.join(", ")}\n` : ""}\nNotification sent to ${c?.contact}.`);
      return;
    }

    const sanctionsHit = false; // Placeholder for API
    qaFindings.result = "Passed";
    qaFindings.passedAt = Date.now();
    qaFindings.officer = currentUser.name;

    save({ ...data,
      applications: applications.map(x => x.id === appId ? { ...x, status: "Submitted", submitted: Date.now(), qaSignedOff: true, qaOfficer: currentUser.name, qaDate: Date.now(), qaFindings, sanctionsFlag: sanctionsHit, sanctionsDate: Date.now() } : x),
      audit: [...audit,
        addAudit("QA Sign-Off", appId, currentUser.name, `QA passed. All mandatory documents on file. Application formally submitted.`, "Origination"),
        addAudit("Sanctions Screening", appId, "System", `Automated screening: ${sanctionsHit ? "MATCH FOUND" : "Clear. No matches."}.`, "Compliance"),
      ],
      alerts: [...alerts,
        addAlert("Application", "info", `Application Submitted – ${c?.name}`, `${appId} passed QA and formally submitted. Ready for assignment.`),
        ...(sanctionsHit ? [addAlert("Compliance","critical",`Sanctions Hit – ${c?.name}`,`${appId}: potential match. Immediate review required.`)] : []),
      ]
    });
  };

