// KwikBridge LMS — Statutory Hooks
// NCR report status updates.

export const updateStatutoryStatus = (reportId, newStatus) => {
    const updated = (statutoryReports||[]).map(r => r.id === reportId ? { ...r, status: newStatus, ...(newStatus === "Submitted" ? { submittedDate: new Date().toISOString().split("T")[0] } : {}) } : r);
    save({ ...data, statutoryReports: updated, audit: [...audit, addAudit("Statutory Report Updated", reportId, "Compliance Officer", `Status changed to "${newStatus}".`, "Compliance")] });
  };

