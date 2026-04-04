// KwikBridge LMS — Admin Product Hooks
// Product CRUD, status toggle.

export const saveProduct = (prod) => {
    if (!canDo("products","create") && !canDo("products","update")) { alert("Permission denied."); return; }
    const isNew = !products.find(p => p.id === prod.id);
    if (isNew) {
      save({ ...data, products: [...products, { ...prod, id:`P${String(products.length+1).padStart(3,"0")}`, createdBy:currentUser.id, createdAt:Date.now() }], audit:[...audit, addAudit("Product Created", prod.name, currentUser.name, `New product: ${prod.name}. Rate: ${prod.baseRate}%. Range: ${fmt.cur(prod.minAmount)}-${fmt.cur(prod.maxAmount)}.`, "Configuration")] });
    } else {
      save({ ...data, products: products.map(p => p.id === prod.id ? { ...p, ...prod } : p), audit:[...audit, addAudit("Product Updated", prod.id, currentUser.name, `Product ${prod.name} updated.`, "Configuration")] });
    }
  };

export const toggleProductStatus = (prodId) => {
    if (!canDo("products","update")) { alert("Permission denied."); return; }
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    const newStatus = p.status === "Active" ? "Suspended" : "Active";
    save({ ...data, products: products.map(x => x.id === prodId ? { ...x, status: newStatus } : x), audit:[...audit, addAudit(`Product ${newStatus}`, prodId, currentUser.name, `${p.name} status changed to ${newStatus}.`, "Configuration")] });
  };

