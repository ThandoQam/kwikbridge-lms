// @ts-nocheck
// KwikBridge LMS — Customer Hooks
// Business logic for customer creation and updates.

// createCustomer
export const createCustomer = (form) => {
    if (!canDo("customers","create")) { alert("Permission denied."); return; }
    const c = { ...form, id:`C${String(customers.length+1).padStart(3,"0")}`, ficaStatus:"Pending", ficaDate:null, riskCategory:"Medium", created:Date.now(), beeStatus:"Pending Review", beeExpiry:null, womenOwned:+form.womenOwned||0, youthOwned:+form.youthOwned||0, disabilityOwned:+form.disabilityOwned||0 };
    save({ ...data, customers:[...customers, c], audit:[...audit, addAudit("Customer Created", c.id, currentUser.name, `New customer: ${c.name}. Industry: ${c.industry}.`, "Onboarding")] });
    return c.id;
  };

// updateCustomer
export const updateCustomer = (custId, updates) => {
    if (!canDo("customers","update")) { alert("Permission denied."); return; }
    save({ ...data, customers: customers.map(c => c.id === custId ? { ...c, ...updates } : c), audit:[...audit, addAudit("Customer Updated", custId, currentUser.name, `Profile updated. Fields: ${Object.keys(updates).join(", ")}.`, "Onboarding")] });
  };

