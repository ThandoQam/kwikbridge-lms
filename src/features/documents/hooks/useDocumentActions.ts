// @ts-nocheck
// KwikBridge LMS — Document Hooks
// Document approval, rejection.

export const approveDocument = (docId, appId) => {
    if (!canDo("documents","approve")) { alert("Permission denied: you cannot approve documents."); return; }
    const doc = (documents||[]).find(d => d.id === docId);
    if (!doc) return;
    const updated = { ...doc, status: "Verified", verifiedBy: currentUser.name, verifiedAt: Date.now() };
    save({ ...data, documents: documents.map(d => d.id === docId ? updated : d), audit: [...audit, addAudit("Document Approved", docId, currentUser.name, `${doc.name} verified and approved.`, "Underwriting")] });
  };

