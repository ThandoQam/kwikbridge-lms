// @ts-nocheck
// KwikBridge LMS — Collections Hooks
// PTP, restructuring, write-off actions.

export const addCollectionAction = (loanId, actionType, notes, extra={}) => {
    if (!canDo("collections","create")) { alert("Permission denied: you cannot log collection actions."); return; }
    const l = loans.find(x => x.id === loanId);
    const entry = { id: uid(), loanId, custId: l?.custId, stage: l?.dpd <= 30 ? "Early" : l?.dpd <= 90 ? "Mid" : "Late", dpd: l?.dpd || 0, action: actionType, channel: extra.channel || "System", officer: currentUser.name, notes, created: Date.now(), ...extra };
    let newAlerts = [...alerts];
    let newAudit = [...audit, addAudit(`Collection: ${actionType}`, loanId, currentUser.name, notes, "Collections")];
    if (actionType === "Letter of Demand") newAlerts.push(addAlert("Collections","warning",`Demand Issued – ${l?.id}`,`Formal NCA demand sent to ${cust(l?.custId)?.name}.`));
    if (actionType === "Legal Handover") newAlerts.push(addAlert("Collections","critical",`Legal Handover – ${l?.id}`,`${l?.id} referred to Legal Department. Balance: ${fmt.cur(l?.balance)}.`));
    save({ ...data, collections: [...collections, entry], audit: newAudit, alerts: newAlerts });
  };

