// KwikBridge LMS — Documents Page
// Document registry — KYC/KYB, financial, legal, compliance
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Documents() {
    const docs = documents || [];
    const [tab, setTab] = useState("all");
    const [catFilter, setCatFilter] = useState("All");
    const categories = ["All", "KYC", "KYB", "Financial", "Legal", "Collateral", "Compliance", "Collections"];
    const filtered = docs
      .filter(d => tab === "all" ? true : tab === "pending" ? ["Pending","Received","Under Review"].includes(d.status) : tab === "expiring" ? (d.expiryDate && d.expiryDate < now + 90*day) : tab === "verified" ? d.status === "Verified" : true)
      .filter(d => catFilter === "All" || d.category === catFilter)
      .filter(d => !search || [d.name, d.custId, d.type, cust(d.custId)?.name].some(f => f?.toLowerCase().includes(search.toLowerCase())));
    const pending = docs.filter(d => ["Pending","Received","Under Review"].includes(d.status));
    const expiring = docs.filter(d => d.expiryDate && d.expiryDate < now + 90*day && d.status === "Verified");
    const verified = docs.filter(d => d.status === "Verified");

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Document Management</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Centralised document registry — KYC/KYB, financial, legal, collateral & compliance</p>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Total Documents" value={docs.length} />
        <KPI label="Verified" value={verified.length} sub={`${Math.round(verified.length/docs.length*100)}% complete`} />
        <KPI label="Pending Action" value={pending.length} sub={pending.length > 0 ? `${pending.filter(d=>d.status==="Pending").length} outstanding` : "All received"} />
        <KPI label="Expiring (90d)" value={expiring.length} sub={expiring.length > 0 ? `Earliest: ${Math.ceil((Math.min(...expiring.map(d=>d.expiryDate)) - now) / day)}d` : "None"} />
      </div>

      <Tab tabs={[
        { key:"all", label:"All Documents", count:docs.length },
        { key:"pending", label:"Pending Action", count:pending.length },
        { key:"expiring", label:"Expiring Soon", count:expiring.length },
        { key:"verified", label:"Verified", count:verified.length },
      ]} active={tab} onChange={setTab} />

      {/* Category filter */}
      <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:`1px solid ${C.border}` }}>
        {categories.map(c => (
          <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:"5px 12px", border:"none", borderBottom: catFilter===c?`2px solid ${C.textDim}`:"2px solid transparent", background:"transparent", color:catFilter===c?C.text:C.textMuted, fontSize:11, fontWeight:catFilter===c?600:400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }}>{c}</button>
        ))}
      </div>

      <Table columns={[
        { label:"Doc ID", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.id}</span> },
        { label:"Document Name", render:r=><span style={{ fontWeight:500 }}>{r.name}</span> },
        { label:"Category", render:r=><span style={{ fontSize:11 }}>{r.category}</span> },
        { label:"Type", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.type}</span> },
        { label:"Customer", render:r=><span style={{ fontSize:12 }}>{cust(r.custId)?.name}</span> },
        { label:"Linked To", render:r=><span style={{ fontFamily:"monospace", fontSize:10, color:C.textDim }}>{[r.appId, r.loanId].filter(Boolean).join(" / ") || "—"}</span> },
        { label:"Status", render:r=>statusBadge(r.status) },
        { label:"Uploaded", render:r=>r.uploadedAt ? fmt.date(r.uploadedAt) : "—" },
        { label:"Verified By", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.verifiedBy || "—"}</span> },
        { label:"Expiry", render:r=>{
          if (!r.expiryDate) return <span style={{ color:C.textMuted, fontSize:11 }}>N/A</span>;
          const d = Math.ceil((r.expiryDate - now) / day);
          return <span style={{ fontSize:11, fontWeight:d<=30?600:400, color:d<=30?C.red:d<=90?C.amber:C.textDim }}>{fmt.date(r.expiryDate)} ({d}d)</span>;
        }},
        { label:"Req", render:r=>r.required ? <span style={{ fontSize:10, fontWeight:500 }}>Yes</span> : <span style={{ fontSize:10, color:C.textMuted }}>No</span> },
      ]} rows={filtered} />

      {/* Document checklist by customer */}
      {tab === "pending" && pending.length > 0 && (
        <div style={{ marginTop:20 }}>
          <SectionCard title="Outstanding Documents by Customer">
            {Object.entries(pending.reduce((acc, d) => { const n = cust(d.custId)?.name || d.custId; (acc[n] = acc[n] || []).push(d); return acc; }, {})).map(([name, docs], i) => (
              <div key={i} style={{ marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{name}</div>
                {docs.map((d, j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:C.textDim, width:60, fontSize:10 }}>{d.category}</span>
                      <span>{d.name}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {statusBadge(d.status)}
                      {d.notes && <span style={{ fontSize:10, color:C.textMuted, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"inline-block" }}>{d.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* Expiry schedule */}
      {tab === "expiring" && expiring.length > 0 && (
        <div style={{ marginTop:20 }}>
          <SectionCard title="Document Expiry Schedule">
            {expiring.sort((a,b)=>a.expiryDate-b.expiryDate).map((d, i) => {
              const daysLeft = Math.ceil((d.expiryDate - now) / day);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{d.name}</div>
                    <div style={{ fontSize:11, color:C.textMuted }}>{cust(d.custId)?.name} · {d.type}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:daysLeft<=30?C.red:C.amber }}>{daysLeft} days</div>
                    <div style={{ fontSize:10, color:C.textMuted }}>Expires {fmt.date(d.expiryDate)}</div>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      )}
    </div>);
  }
