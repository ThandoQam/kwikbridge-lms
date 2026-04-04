// KwikBridge LMS — Governance Page
// Audit trail, alert management, compliance monitoring
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Governance() {
    const [tab, setTab] = useState("audit");
    const categories = [...new Set(audit.map(a=>a.category).filter(Boolean))].sort();
    const users = [...new Set(audit.map(a=>a.user).filter(Boolean))].sort();
    let filteredAudit = [...audit].sort((a,b)=>b.ts-a.ts);
    if (auditFilter.category) filteredAudit = filteredAudit.filter(a=>a.category===auditFilter.category);
    if (auditFilter.user) filteredAudit = filteredAudit.filter(a=>a.user===auditFilter.user);
    if (auditFilter.entity) filteredAudit = filteredAudit.filter(a=>a.entity?.toLowerCase().includes(auditFilter.entity.toLowerCase()));

    const controlPoints = [
      { control:"FICA Verification", module:"Onboarding", status: customers.every(c=>c.ficaStatus==="Verified") ? "All Verified" : `${customers.filter(c=>c.ficaStatus!=="Verified").length} pending`, ok: customers.filter(c=>c.ficaStatus!=="Verified").length === 0 },
      { control:"Approval Authority Limits", module:"Underwriting", status:"Enforced in code", ok:true },
      { control:"Separation of Duties", module:"Underwriting", status:"Creator ≠ Approver enforced", ok:true },
      { control:"Dual Disbursement Auth", module:"Disbursement", status:"Booker ≠ Disburser enforced", ok:true },
      { control:"Sanctions Screening", module:"Origination", status: applications.some(a=>a.sanctionsFlag) ? "HITS DETECTED" : "All clear", ok: !applications.some(a=>a.sanctionsFlag) },
      { control:"BEE Certificate Monitoring", module:"Compliance", status: `${customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length} expiring within 90 days`, ok: customers.filter(c=>c.beeExpiry&&c.beeExpiry<now+90*day).length === 0 },
      { control:"RBAC Enforcement", module:"System-wide", status:`${Object.keys(PERMS).length} modules × ${Object.keys(ROLES).length} roles`, ok:true },
      { control:"Immutable Audit Trail", module:"System-wide", status:`${audit.length} entries recorded`, ok:true },
      { control:"NCR Statutory Reporting", module:"Compliance", status: `${(statutoryReports||[]).filter(r=>r.status!=="Submitted").length} pending`, ok: (statutoryReports||[]).filter(r=>r.status!=="Submitted"&&new Date(r.dueDate)<new Date()).length === 0 },
      { control:"IFRS 9 Provisioning", module:"Finance", status: `${provisions.length} loans provisioned. ECL: ${fmt.cur(provisions.reduce((s,p)=>s+p.ecl,0))}`, ok:true },
    ];

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Governance, Risk & Compliance</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Audit trail, control points, approval authorities, regulatory compliance & alerts</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <KPI label="Audit Entries" value={audit.length} />
        <KPI label="Controls Active" value={controlPoints.filter(c=>c.ok).length} sub={`of ${controlPoints.length}`} />
        <KPI label="Unread Alerts" value={alerts.filter(a=>!a.read).length} />
        <KPI label="Critical Alerts" value={alerts.filter(a=>a.severity==="critical"&&!a.read).length} />
      </div>
      <Tab tabs={[
        {key:"audit",label:"Audit Trail",count:audit.length},
        {key:"controls",label:"Control Points",count:controlPoints.length},
        {key:"authority",label:"Approval Matrix"},
        {key:"regulatory",label:"Regulatory Framework"},
        {key:"alerts",label:"All Alerts",count:alerts.length},
      ]} active={tab} onChange={setTab} />

      {tab==="audit" && <div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <select value={auditFilter.category} onChange={e=>setAuditFilter({...auditFilter,category:e.target.value})} style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit" }}>
            <option value="">All Categories</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={auditFilter.user} onChange={e=>setAuditFilter({...auditFilter,user:e.target.value})} style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit" }}>
            <option value="">All Users</option>
            {users.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
          <input value={auditFilter.entity} onChange={e=>setAuditFilter({...auditFilter,entity:e.target.value})} placeholder="Filter by entity ID..." style={{ padding:"4px 6px", border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:11, fontFamily:"inherit", width:160 }} />
          {(auditFilter.category||auditFilter.user||auditFilter.entity) && <Btn size="sm" variant="ghost" onClick={()=>setAuditFilter({category:"",user:"",entity:""})}>Clear</Btn>}
          <span style={{ fontSize:10, color:C.textMuted, alignSelf:"center" }}>{filteredAudit.length} of {audit.length} entries</span>
        </div>
        <Table columns={[
          { label:"Timestamp", render:r=>fmt.dateTime(r.ts) },
          { label:"Category", render:r=><Badge color={r.category==="Risk"||r.category==="Collections"?"red":r.category==="Compliance"?"amber":r.category==="Decision"?"purple":"cyan"}>{r.category}</Badge> },
          { label:"Action", render:r=><span style={{ fontWeight:600 }}>{r.action}</span> },
          { label:"Entity", render:r=><span style={{ fontFamily:"monospace", fontSize:11 }}>{r.entity}</span> },
          { label:"User", key:"user" },
          { label:"Detail", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.detail}</span> },
        ]} rows={filteredAudit.slice(0,50)} />
        {filteredAudit.length > 50 && <div style={{ fontSize:11, color:C.textMuted, marginTop:8 }}>Showing 50 of {filteredAudit.length} entries. Use filters to narrow.</div>}
      </div>}

      {tab==="controls" && <div>
        <Table columns={[
          { label:"Control", render:r=><span style={{ fontWeight:600 }}>{r.control}</span> },
          { label:"Module", render:r=><span style={{ fontSize:11, color:C.textDim }}>{r.module}</span> },
          { label:"Status", render:r=><span style={{ fontSize:12, color:r.ok?C.green:C.red, fontWeight:500 }}>{r.status}</span> },
          { label:"Health", render:r=>r.ok ? <Badge color="green">OK</Badge> : <Badge color="red">Attention</Badge> },
        ]} rows={controlPoints} />
      </div>}

      {tab==="authority" && <SectionCard title="Credit Approval Authority Matrix (Live)">
        <Table columns={[
          { label:"Role", render:r=><span style={{ fontWeight:500 }}>{ROLES[r.role]?.label}</span> },
          { label:"Approval Limit", render:r=>r.limit===Infinity ? "Unlimited" : r.limit > 0 ? fmt.cur(r.limit) : <span style={{ color:C.textMuted }}>No approval authority</span> },
          { label:"Current Users", render:r=>SYSTEM_USERS.filter(u=>u.role===r.role).map(u=>u.name).join(", ") || <span style={{ color:C.textMuted }}>—</span> },
          { label:"Tier", render:r=>ROLES[r.role]?.tier },
        ]} rows={Object.keys(ROLES).map(k=>({role:k,limit:APPROVAL_LIMITS[k]||0}))} />
      </SectionCard>}

      {tab==="regulatory" && <div>
        <SectionCard title="Regulatory Status">
          <InfoGrid items={[
            ["NCR Registration", settings?.ncrReg],
            ["NCR Expiry", settings?.ncrExpiry],
            ["FICA Compliance", customers.every(c=>c.ficaStatus==="Verified") ? "Fully Compliant" : `${customers.filter(c=>c.ficaStatus!=="Verified").length} customers pending`],
            ["POPIA Compliance", "Active"],
            ["NCA Registration", "Active – Section 40"],
            ["BEE Monitoring", `${customers.filter(c=>c.beeStatus==="Verified").length}/${customers.length} verified`],
            ["Last NCR Submission", (statutoryReports||[]).filter(r=>r.status==="Submitted").sort((a,b)=>new Date(b.submittedDate||0)-new Date(a.submittedDate||0))[0]?.name || "—"],
          ]} />
        </SectionCard>
        <SectionCard title="Regulatory Framework">
          {[
            ["National Credit Act (NCA) 34 of 2005","Governs credit agreements, affordability assessments, consumer protection. Enforced: affordability checks in underwriting, NCA demand letters in collections."],
            ["Financial Intelligence Centre Act (FICA) 38 of 2001","KYC/CDD, suspicious transaction reporting. Enforced: FICA status workflow on customers, sanctions screening on applications."],
            ["Protection of Personal Information Act (POPIA) 4 of 2013","Data privacy, consent. Enforced: data access via RBAC, audit trail on all data changes."],
            ["Companies Act 71 of 2008","Corporate governance, director responsibilities. Enforced: approval authority matrix, separation of duties."],
            ["BB-BEE Act 53 of 2003","Empowerment verification. Enforced: BEE verification workflow, eligibility checks in product selection."],
            ["Debt Collectors Act 114 of 1998","Collection conduct standards. Enforced: staged collections, NCA-compliant demand process."],
          ].map(([name, desc], i) => (
            <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.accent }}>{name}</div>
              <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>{desc}</div>
            </div>
          ))}
        </SectionCard>
      </div>}

      {tab==="alerts" && <div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <span style={{ fontSize:11, color:C.textMuted }}>{alerts.filter(a=>!a.read).length} unread of {alerts.length} total</span>
          {canDo("governance","update") && alerts.some(a=>!a.read) && <Btn size="sm" variant="ghost" onClick={()=>save({...data,alerts:alerts.map(a=>({...a,read:true}))})}>Mark All Read</Btn>}
        </div>
        <Table columns={[
          { label:"Date", render:r=>fmt.dateTime(r.ts) },
          { label:"Severity", render:r=><Badge color={r.severity==="critical"?"red":r.severity==="warning"?"amber":"blue"}>{r.severity}</Badge> },
          { label:"Type", render:r=><Badge color="cyan">{r.type}</Badge> },
          { label:"Title", render:r=><span style={{ fontWeight:600 }}>{r.title}</span> },
          { label:"Message", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.msg}</span> },
          { label:"Status", render:r=>r.read?<Badge color="slate">Read</Badge>:<Badge color="amber">Unread</Badge> },
          { label:"", render:r=>!r.read && canDo("governance","update") ? <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();markRead(r.id)}}>Dismiss</Btn> : null },
        ]} rows={[...alerts].sort((a,b)=>b.ts-a.ts)} />
      </div>}
    </div>);
  }
