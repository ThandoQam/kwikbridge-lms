// @ts-nocheck
// KwikBridge LMS — Servicing Hooks
// Payment recording, allocation.

export const recordPayment = (loanId, amount) => {
    if (!canDo("servicing","create")) { alert("Permission denied: you cannot record payments."); return; }
    const l = loans.find(x => x.id === loanId);
    if (!l || l.status !== "Active") return;
    const monthlyRate = l.rate / 100 / 12;
    const interestPortion = Math.round(l.balance * monthlyRate);
    const principalPortion = Math.max(0, +amount - interestPortion);
    const newBalance = Math.max(0, l.balance - principalPortion);
    const pmt = { date: Date.now(), amount: +amount, interest: interestPortion, principal: principalPortion, type: "Instalment", status: "Cleared", recordedBy: currentUser.id };
    const updated = { ...l, payments: [...l.payments, pmt], balance: newBalance, totalPaid: l.totalPaid + +amount, lastPmt: Date.now(), lastPmtAmt: +amount, dpd: 0, nextDue: Date.now() + 30 * day };
    updated.stage = stage(updated.dpd);
    if (newBalance === 0) updated.status = "Settled";
    save({ ...data,
      loans: loans.map(x => x.id === loanId ? updated : x),
      audit: [...audit, addAudit("Payment Received", loanId, currentUser.name, `${fmt.cur(amount)} received. Interest: ${fmt.cur(interestPortion)}. Principal: ${fmt.cur(principalPortion)}. Balance: ${fmt.cur(newBalance)}.${newBalance===0?" LOAN SETTLED.":""}`, "Servicing")],
      ...(newBalance === 0 ? { alerts: [...alerts, addAlert("Loan","info",`Loan Settled – ${loanId}`,`${loanId} fully repaid. Balance: R0.00.`)] } : {})
    });
  };

