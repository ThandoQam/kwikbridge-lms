/**
 * AdministrationPage — system administration suite.
 *
 * Tabs: products, users, security policies, business rules, settings,
 * backup configuration, API keys, system info.
 *
 * EXTRACTED FROM MONOLITH (Sprint 4/5, May 2026).
 * Uses context hooks for shared dependencies. Page-local state for
 * forms (prodForm, userForm, etc.) lives inside this component now,
 * not in the monolith.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { Badge, Btn, C, Field, I, InfoGrid, Input, SectionCard, Select, Tab, Table, Textarea, statusBadge } from '../../../components/ui';
import { cell, fmt } from '../../../lib/format';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface AdministrationPageProps {
// Time constants
  now: number;
  day: number;
  // Helpers
  getProductSecurity: any;
  // UI primitives
  // Helpers + constants
  ROLES: any;
  PERMS: any;
  APPROVAL_LIMITS: any;
  SECURITY_INSTRUMENTS: any;
}

export function AdministrationPage({
  now,
  day,
  getProductSecurity,
  ROLES,
  PERMS,
  APPROVAL_LIMITS,
  SECURITY_INSTRUMENTS,
}: AdministrationPageProps) {
  // ═══ Context-driven dependencies ═══
  const {
    customers, applications, loans, products,
    documents, audit, comms, collections, settings,
    data, save, addAudit,
  } = useData();
  const { saveProduct, toggleProductStatus, reset } = useActions();
  const { showToast } = useUI();
  const { currentUser, role, canDo, sysUsers, setSysUsers, setCurrentUser } = useAuth();

    const [adminTab, setAdminTab] = useState("products");
    // ═══ Page-local state (was in monolith, now scoped to Admin) ═══
    const [prodEditing, setProdEditing] = useState(null);
    const [prodForm, setProdForm] = useState(null);
    const [userEditing, setUserEditing] = useState(null);
    const [userForm, setUserForm] = useState(null);
    const [policyEditing, setPolicyEditing] = useState(null);
    const [policyForm, setPolicyForm] = useState(null);
    const [settingsEditing, setSettingsEditing] = useState(false);
    const [settingsForm, setSettingsForm] = useState({});
    const [backupSchedule, setBackupSchedule] = useState({frequency:"Daily",time:"02:00",retention:30,lastBackup:null,autoEnabled:true});
    const [apiKeys, setApiKeys] = useState([{id:"ak1",name:"Supabase REST",key:"sb_pub...M",status:"Active",created:Date.now()-30*86400000,lastUsed:Date.now()},{id:"ak2",name:"Credit Bureau API",key:"cb_***...9f",status:"Active",created:Date.now()-90*86400000,lastUsed:Date.now()-2*86400000}]);
    const [businessRules, setBusinessRules] = useState([
      {id:"BR-001",name:"Max Single Exposure",category:"Credit",value:"R5,000,000",description:"Maximum loan amount to a single borrower",status:"Active",lastUpdated:Date.now()-60*86400000,updatedBy:"Chief Risk Officer"},
      {id:"BR-002",name:"Portfolio Loss Tolerance",category:"Credit",value:"3-5% annual",description:"Maximum acceptable annual portfolio loss rate",status:"Active",lastUpdated:Date.now()-60*86400000,updatedBy:"Board of Directors"},
      {id:"BR-003",name:"Min DSCR (Standard)",category:"Credit",value:"1.25x",description:"Minimum debt service coverage ratio for standard products",status:"Active",lastUpdated:Date.now()-60*86400000,updatedBy:"Credit Committee"},
      {id:"BR-004",name:"Draft Application Expiry",category:"Operations",value:"30 days",description:"Draft applications auto-expire after this period",status:"Active",lastUpdated:Date.now()-30*86400000,updatedBy:"Head of Operations"},
      {id:"BR-005",name:"Early Collections Trigger",category:"Collections",value:"1 DPD",description:"Automated SMS/email on first day past due",status:"Active",lastUpdated:Date.now()-45*86400000,updatedBy:"Head of Collections"},
      {id:"BR-006",name:"Legal Action Threshold",category:"Collections",value:"91+ DPD",description:"Accounts eligible for legal recovery proceedings",status:"Active",lastUpdated:Date.now()-45*86400000,updatedBy:"Credit Committee"},
      {id:"BR-007",name:"Dual Authorization Threshold",category:"Finance",value:"R500,000",description:"Disbursements above this amount require dual sign-off",status:"Active",lastUpdated:Date.now()-90*86400000,updatedBy:"CFO"},
      {id:"BR-008",name:"KYC Document Validity",category:"Compliance",value:"3 months",description:"Proof of address must be within this period",status:"Active",lastUpdated:Date.now()-120*86400000,updatedBy:"Compliance Officer"},
    ]);
    // Product management
    const blank = { name:"", description:"", idealFor:"", minAmount:100000, maxAmount:5000000, minTerm:3, maxTerm:12, baseRate:42.0, monthlyRate:3.5, repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0.5, gracePeriod:0, maxLTV:80, minDSCR:1.15, riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22, eligibleBEE:[1,2,3,4], eligibleIndustries:["All"], requiredSecurity:[], optionalSecurity:[], status:"Active" };
    const startEdit = (p) => { setProdForm({...p}); setProdEditing(p.id); };
    const startNew = () => { setProdForm({...blank}); setProdEditing("new"); };
    const cancelEdit = () => { setProdForm(null); setProdEditing(null); };
    const handleSaveProd = () => { if (!prodForm.name) return; if (prodEditing === "new") saveProduct(prodForm); else saveProduct({ ...prodForm, id: prodEditing }); cancelEdit(); };
    // User management
    const blankUser = {name:"",email:"",role:"LOAN_OFFICER",initials:"",password:"",status:"Active"};
    const startEditUser = u => { setUserForm({...u,password:""}); setUserEditing(u.id); };
    const startNewUser = () => { setUserForm({...blankUser}); setUserEditing("new"); };
    const cancelUserEdit = () => { setUserForm(null); setUserEditing(null); };
    const handleSaveUser = () => {
      if (!userForm.name||!userForm.email) return;
      const initials = userForm.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      if (userEditing === "new") {
        const u = { ...userForm, id:`U${String(sysUsers.length+1).padStart(3,"0")}`, initials, createdAt:Date.now() };
        setSysUsers([...sysUsers, u]);
        save({...data, audit:[...audit, addAudit("User Created",u.id,currentUser.name,`${u.name} (${ROLES[u.role]?.label}) created.`,"Configuration")]});
      } else {
        setSysUsers(sysUsers.map(u => u.id===userEditing ? {...u,...userForm,initials} : u));
        save({...data, audit:[...audit, addAudit("User Updated",userEditing,currentUser.name,`${userForm.name} profile updated.`,"Configuration")]});
      }
      cancelUserEdit();
    };
    const toggleUserStatus = id => {
      setSysUsers(sysUsers.map(u => u.id===id ? {...u,status:u.status==="Active"?"Suspended":"Active"} : u));
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit(u?.status==="Active"?"User Suspended":"User Reactivated",id,currentUser.name,`${u?.name} status changed.`,"Configuration")]});
    };
    const resetPassword = id => {
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit("Password Reset",id,currentUser.name,`Password reset initiated for ${u?.name}.`,"Configuration")]});
      showToast(`Password reset link sent to ${u?.email}`);
    };
    const revokeAccess = id => {
      setSysUsers(sysUsers.map(u => u.id===id ? {...u,status:"Revoked",role:"VIEWER"} : u));
      const u = sysUsers.find(x=>x.id===id);
      save({...data, audit:[...audit, addAudit("Access Revoked",id,currentUser.name,`All privileges revoked for ${u?.name}. Role set to Viewer.`,"Configuration")]});
    };
    // Settings
    const handleSaveSettings = () => {
      if (!canDo("settings","update")) { showToast("Permission denied."); return; }
      save({ ...data, settings: settingsForm, audit:[...audit, addAudit("Settings Updated", "System", currentUser.name, "Company settings modified.", "Configuration")] });
      setSettingsEditing(false);
    };
    // Business rules
    const startEditRule = r => { setPolicyForm({...r}); setPolicyEditing(r.id); };
    const startNewRule = () => { setPolicyForm({id:"",name:"",category:"Credit",value:"",description:"",status:"Active"}); setPolicyEditing("new"); };
    const handleSaveRule = () => {
      if (!policyForm.name||!policyForm.value) return;
      if (policyEditing==="new") {
        setBusinessRules([...businessRules, {...policyForm, id:`BR-${String(businessRules.length+1).padStart(3,"0")}`, lastUpdated:Date.now(), updatedBy:currentUser.name}]);
        save({...data, audit:[...audit, addAudit("Business Rule Created",policyForm.name,currentUser.name,`New rule: ${policyForm.name} = ${policyForm.value}`,"Configuration")]});
      } else {
        setBusinessRules(businessRules.map(r => r.id===policyEditing ? {...r,...policyForm, lastUpdated:Date.now(), updatedBy:currentUser.name} : r));
        save({...data, audit:[...audit, addAudit("Business Rule Updated",policyEditing,currentUser.name,`${policyForm.name} updated to ${policyForm.value}`,"Configuration")]});
      }
      setPolicyForm(null); setPolicyEditing(null);
    };
    const toggleRule = id => {
      setBusinessRules(businessRules.map(r => r.id===id ? {...r, status:r.status==="Active"?"Suspended":"Active", lastUpdated:Date.now(), updatedBy:currentUser.name} : r));
    };
    // Backup
    const runBackup = () => { setBackupSchedule({...backupSchedule, lastBackup:Date.now()}); save({...data, audit:[...audit, addAudit("Manual Backup","System",currentUser.name,"Manual database backup initiated.","Configuration")]}); };
    const addApiKey = () => { const k = {id:`ak${apiKeys.length+1}`,name:"New API Key",key:`key_${uid()}`,status:"Active",created:Date.now(),lastUsed:null}; setApiKeys([...apiKeys,k]); };
    const revokeApiKey = id => { setApiKeys(apiKeys.map(k=>k.id===id?{...k,status:"Revoked"}:k)); };
    // System health
    const uptime = Math.floor((Date.now() - (now - 30*day)) / 3600000);
    const dbSize = (customers.length*2 + applications.length*5 + loans.length*3 + documents.length + audit.length*0.5).toFixed(1);

    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:24, fontWeight:700, color:C.text }}>Administration</h2>
      <p style={{ margin:"0 0 16px", fontSize:13, color:C.textMuted }}>Product catalog, user management, system configuration & business rules</p>
      <Tab tabs={[
        { key:"products", label:"Product Management", count:products.length },
        { key:"users", label:"User Management", count:sysUsers.length },
        { key:"system", label:"System Admin & Support" },
        { key:"rules", label:"Business Rules & Policies", count:businessRules.length },
      ]} active={adminTab} onChange={setAdminTab} />

      {/* ── Product Management ── */}
      {adminTab === "products" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("products","create") && <Btn onClick={startNew} icon={I.plus}>New Product</Btn>}
        </div>
        {prodForm && (
          <SectionCard title={prodEditing === "new" ? "Create New Product" : `Edit: ${prodForm.name}`}>
            <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Product Name"><Input value={prodForm.name} onChange={e=>setProdForm({...prodForm,name:e.target.value})} /></Field>
              <Field label="Repayment Type"><Select value={prodForm.repaymentType} onChange={e=>setProdForm({...prodForm,repaymentType:e.target.value})} options={["Amortising","Bullet","Balloon","Seasonal"].map(v=>({value:v,label:v}))} /></Field>
              <Field label="Status"><Select value={prodForm.status} onChange={e=>setProdForm({...prodForm,status:e.target.value})} options={["Active","Suspended","Retired"].map(v=>({value:v,label:v}))} /></Field>
            </div>
            <Field label="Description"><Textarea value={prodForm.description} onChange={e=>setProdForm({...prodForm,description:e.target.value})} rows={2} /></Field>
            <Field label="Ideal For"><Input value={prodForm.idealFor||""} onChange={e=>setProdForm({...prodForm,idealFor:e.target.value})} placeholder="Target market description" /></Field>
            <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Min Amount (R)"><Input type="number" value={prodForm.minAmount} onChange={e=>setProdForm({...prodForm,minAmount:+e.target.value})} /></Field>
              <Field label="Max Amount (R)"><Input type="number" value={prodForm.maxAmount} onChange={e=>setProdForm({...prodForm,maxAmount:+e.target.value})} /></Field>
              <Field label="Min Term (m)"><Input type="number" value={prodForm.minTerm} onChange={e=>setProdForm({...prodForm,minTerm:+e.target.value})} /></Field>
              <Field label="Max Term (m)"><Input type="number" value={prodForm.maxTerm} onChange={e=>setProdForm({...prodForm,maxTerm:+e.target.value})} /></Field>
            </div>
            <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Base Rate % (ann.)"><Input type="number" value={prodForm.baseRate} onChange={e=>setProdForm({...prodForm,baseRate:+e.target.value})} /></Field>
              <Field label="Monthly Rate %"><Input type="number" value={prodForm.monthlyRate||""} onChange={e=>setProdForm({...prodForm,monthlyRate:+e.target.value})} /></Field>
              <Field label="Arrangement Fee %"><Input type="number" value={prodForm.arrangementFee} onChange={e=>setProdForm({...prodForm,arrangementFee:+e.target.value})} /></Field>
              <Field label="Commitment Fee %"><Input type="number" value={prodForm.commitmentFee} onChange={e=>setProdForm({...prodForm,commitmentFee:+e.target.value})} /></Field>
              <Field label="Grace Period (m)"><Input type="number" value={prodForm.gracePeriod} onChange={e=>setProdForm({...prodForm,gracePeriod:+e.target.value})} /></Field>
            </div>
            <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Max LTV %"><Input type="number" value={prodForm.maxLTV} onChange={e=>setProdForm({...prodForm,maxLTV:+e.target.value})} /></Field>
              <Field label="Min DSCR"><Input type="number" value={prodForm.minDSCR} onChange={e=>setProdForm({...prodForm,minDSCR:+e.target.value})} step="0.05" /></Field>
              <Field label="Risk Class"><Select value={prodForm.riskClass||"A"} onChange={e=>setProdForm({...prodForm,riskClass:e.target.value})} options={["A","B","C","D"].map(v=>({value:v,label:`Class ${v}`}))} /></Field>
              <Field label="ECL Rate %"><Input type="number" value={prodForm.ecl||""} onChange={e=>setProdForm({...prodForm,ecl:+e.target.value})} step="0.01" /></Field>
              <Field label="S1 PD"><Input type="number" value={prodForm.s1PD||""} onChange={e=>setProdForm({...prodForm,s1PD:+e.target.value})} step="0.001" /></Field>
            </div>
            <div className="kb-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="LGD"><Input type="number" value={prodForm.lgd||""} onChange={e=>setProdForm({...prodForm,lgd:+e.target.value})} step="0.01" /></Field>
              <Field label="Eligible BEE Levels (comma-sep)"><Input value={(prodForm.eligibleBEE||[]).join(",")} onChange={e=>setProdForm({...prodForm,eligibleBEE:e.target.value.split(",").map(Number).filter(Boolean)})} /></Field>
            </div>

            {/* Security Instruments */}
            <div style={{ marginTop:12, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.textDim, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Security Instruments</div>
              <div className="kb-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:8 }}>Required (mandatory for this product)</div>
                  {Object.values(SECURITY_INSTRUMENTS).map(inst => {
                    const isChecked = (prodForm.requiredSecurity||[]).includes(inst.id);
                    return (
                      <label key={inst.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"4px 0", cursor:"pointer", fontSize:12 }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const current = prodForm.requiredSecurity || [];
                          const next = isChecked ? current.filter(x=>x!==inst.id) : [...current, inst.id];
                          const optNext = (prodForm.optionalSecurity||[]).filter(x=>x!==inst.id);
                          setProdForm({...prodForm, requiredSecurity:next, optionalSecurity:optNext});
                        }} style={{ marginTop:2, accentColor:C.accent }} />
                        <div>
                          <div style={{ fontWeight:500, color:C.text }}>{inst.name}</div>
                          <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{inst.desc.split(".")[0]}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.text, marginBottom:8 }}>Optional (recommended, reduces risk)</div>
                  {Object.values(SECURITY_INSTRUMENTS).filter(inst => !(prodForm.requiredSecurity||[]).includes(inst.id)).map(inst => {
                    const isChecked = (prodForm.optionalSecurity||[]).includes(inst.id);
                    return (
                      <label key={inst.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"4px 0", cursor:"pointer", fontSize:12 }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const current = prodForm.optionalSecurity || [];
                          const next = isChecked ? current.filter(x=>x!==inst.id) : [...current, inst.id];
                          setProdForm({...prodForm, optionalSecurity:next});
                        }} style={{ marginTop:2, accentColor:C.accent }} />
                        <div>
                          <div style={{ fontWeight:500, color:C.textDim }}>{inst.name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:12 }}><Btn onClick={handleSaveProd}>Save Product</Btn><Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"Product", render:r=><div><div style={{ fontWeight:600, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.idealFor||r.description?.substring(0,60)}</div></div> },
          { label:"Type", render:r=>cell.text(r.repaymentType||"Amortising") },
          { label:"Rate", render:r=><span style={{ fontSize:12, fontWeight:600 }}>{r.monthlyRate||r.baseRate}%{r.monthlyRate?"/mo":""}</span> },
          { label:"Amount Range", render:r=><span style={{ fontSize:11 }}>{fmt.cur(r.minAmount)} – {fmt.cur(r.maxAmount)}</span> },
          { label:"Term", render:r=><span style={{ fontSize:11 }}>{r.minTerm<1?Math.round(r.minTerm*30)+"d":r.minTerm+"m"}–{r.maxTerm}m</span> },
          { label:"Class", render:r=><Badge color={r.riskClass==="A"?"green":r.riskClass==="B"?"amber":r.riskClass==="C"?"red":"gray"}>{r.riskClass||"—"}</Badge> },
          { label:"ECL", render:r=><span style={{ fontSize:11, fontFamily:"monospace" }}>{r.ecl!=null?`${r.ecl}%`:"—"}</span> },
          { label:"Security", render:r => {
            const sec = getProductSecurity(r.id);
            const reqNames = (sec.required||[]).map(id => SECURITY_INSTRUMENTS[id]?.name?.split(" ")[0]).filter(Boolean);
            const optCount = (sec.optional||[]).length;
            return <div style={{ fontSize:10 }}>
              {reqNames.length > 0 && <div style={{ color:C.text, fontWeight:500 }}>{reqNames.join(", ")}</div>}
              {optCount > 0 && <div style={{ color:C.textMuted }}>+{optCount} optional</div>}
              {reqNames.length === 0 && optCount === 0 && <span style={{ color:C.textMuted }}>None set</span>}
            </div>;
          }},
          { label:"Status", render:r=>statusBadge(r.status||"Active") },
          { label:"Actions", render:r=><div style={{ display:"flex", gap:4 }}>
            {canDo("products","update") && <Btn size="sm" variant="ghost" onClick={e=>{e.stopPropagation();startEdit(r)}}>Edit</Btn>}
            {canDo("products","update") && <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={e=>{e.stopPropagation();toggleProductStatus(r.id)}}>{r.status==="Active"?"Suspend":"Activate"}</Btn>}
          </div> },
        ]} rows={products} />
      </div>}

      {/* ── User Management ── */}
      {adminTab === "users" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("settings","create") && <Btn onClick={startNewUser} icon={I.plus}>Add User</Btn>}
        </div>
        {userForm && (
          <SectionCard title={userEditing==="new"?"Create New User":`Edit: ${userForm.name}`}>
            <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Full Name *"><Input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="e.g. Jane Doe" /></Field>
              <Field label="Email *"><Input value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="jane@tqacapital.co.za" /></Field>
              <Field label="Role"><Select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})} options={Object.entries(ROLES).map(([k,v])=>({value:k,label:v.label}))} /></Field>
            </div>
            {userEditing==="new" && <div className="kb-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Temporary Password"><Input type="password" value={userForm.password||""} onChange={e=>setUserForm({...userForm,password:e.target.value})} placeholder="Min 8 characters" /></Field>
              <Field label="Status"><Select value={userForm.status||"Active"} onChange={e=>setUserForm({...userForm,status:e.target.value})} options={["Active","Suspended"].map(v=>({value:v,label:v}))} /></Field>
            </div>}
            <div style={{ display:"flex", gap:8 }}><Btn onClick={handleSaveUser}>Save User</Btn><Btn variant="ghost" onClick={cancelUserEdit}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"User", render:r=><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:24, height:24, borderRadius:10, background:r.status==="Active"?C.surface2:C.red+"20", border:`1px solid ${r.status==="Active"?C.border:C.red}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:r.status==="Active"?C.textDim:C.red }}>{r.initials}</div><div><div style={{ fontWeight:500, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.email}</div></div></div> },
          { label:"Role", render:r=><Badge color={r.role==="ADMIN"?"purple":r.role==="EXEC"?"blue":"gray"}>{ROLES[r.role]?.label||r.role}</Badge> },
          { label:"Tier", render:r=>cell.text(ROLES[r.role]?.tier) },
          { label:"Approval Limit", render:r=>APPROVAL_LIMITS[r.role]?(APPROVAL_LIMITS[r.role]===Infinity?"Unlimited":fmt.cur(APPROVAL_LIMITS[r.role])):<span style={{ color:C.textMuted }}>—</span> },
          { label:"Status", render:r=><Badge color={r.status==="Active"?"green":r.status==="Suspended"?"amber":"red"}>{r.status||"Active"}</Badge> },
          { label:"Actions", render:r=>canDo("settings","update") && r.id!==currentUser.id ? <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            <Btn size="sm" variant="ghost" onClick={()=>startEditUser(r)}>Edit</Btn>
            <Btn size="sm" variant="ghost" onClick={()=>resetPassword(r.id)}>Reset Pwd</Btn>
            <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={()=>toggleUserStatus(r.id)}>{r.status==="Active"?"Suspend":"Activate"}</Btn>
            {r.status!=="Revoked" && <Btn size="sm" variant="danger" onClick={()=>{if(confirm(`Revoke all access for ${r.name}?`))revokeAccess(r.id)}}>Revoke</Btn>}
          </div> : <span style={{ fontSize:10, color:C.textMuted }}>{r.id===currentUser.id?"(You)":"View only"}</span> },
        ]} rows={sysUsers} />
        <SectionCard title="Approval Authority Matrix">
          <Table columns={[
            { label:"Role", render:r=>cell.name(ROLES[r.role]?.label) },
            { label:"Max Amount", render:r=>r.limit === Infinity ? "Unlimited" : r.limit > 0 ? fmt.cur(r.limit) : <span style={{ color:C.textMuted }}>No approval authority</span> },
            { label:"Tier", render:r=>String(ROLES[r.role]?.tier) },
            { label:"Active Users", render:r=>sysUsers.filter(u=>u.role===r.role&&(u.status||"Active")==="Active").length },
          ]} rows={Object.keys(ROLES).map(k => ({ role:k, limit: APPROVAL_LIMITS[k] || 0 }))} />
        </SectionCard>
      </div>}

      {/* ── System Admin & Support ── */}
      {adminTab === "system" && <div>
        <SectionCard title="Company Details" actions={canDo("settings","update") && !settingsEditing ? <Btn size="sm" variant="ghost" onClick={()=>{setSettingsForm({...(settings||{})});setSettingsEditing(true)}}>Edit</Btn> : null}>
          {!settingsEditing ? (
            <InfoGrid items={[["Company Name", settings?.companyName],["NCR Registration", settings?.ncrReg],["NCR Expiry", settings?.ncrExpiry],["Branch", settings?.branch],["Financial Year-End", settings?.yearEnd],["Address", settings?.address || "East London, Nahoon Valley"]]} />
          ) : (
            <div>
              <div className="kb-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <Field label="Company Name"><Input value={settingsForm.companyName||""} onChange={e=>setSettingsForm({...settingsForm,companyName:e.target.value})} /></Field>
                <Field label="NCR Registration"><Input value={settingsForm.ncrReg||""} onChange={e=>setSettingsForm({...settingsForm,ncrReg:e.target.value})} /></Field>
                <Field label="NCR Expiry"><Input value={settingsForm.ncrExpiry||""} onChange={e=>setSettingsForm({...settingsForm,ncrExpiry:e.target.value})} /></Field>
                <Field label="Branch"><Input value={settingsForm.branch||""} onChange={e=>setSettingsForm({...settingsForm,branch:e.target.value})} /></Field>
                <Field label="Year-End"><Input value={settingsForm.yearEnd||""} onChange={e=>setSettingsForm({...settingsForm,yearEnd:e.target.value})} /></Field>
                <Field label="Address"><Input value={settingsForm.address||""} onChange={e=>setSettingsForm({...settingsForm,address:e.target.value})} /></Field>
              </div>
              <div style={{ display:"flex", gap:8 }}><Btn onClick={handleSaveSettings}>Save</Btn><Btn variant="ghost" onClick={()=>setSettingsEditing(false)}>Cancel</Btn></div>
            </div>
          )}
        </SectionCard>
        <SectionCard title="System Health">
          <div className="kb-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            {[["Status","Operational",C.green],["Uptime",`${uptime}h`,C.accent],["DB Size",`~${dbSize} KB`,C.blue],["Active Sessions",sysUsers.filter(u=>(u.status||"Active")==="Active").length,C.purple]].map(([l,v,c],i)=>(
              <div key={i} style={{ background:C.surface2, padding:"12px 12px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Backup & Recovery" actions={canDo("settings","update") && <Btn size="sm" variant="secondary" onClick={runBackup}>Run Backup Now</Btn>}>
          <InfoGrid items={[
            ["Schedule", `${backupSchedule.frequency} at ${backupSchedule.time}`],
            ["Retention", `${backupSchedule.retention} days`],
            ["Last Backup", backupSchedule.lastBackup ? fmt.date(backupSchedule.lastBackup) + " " + new Date(backupSchedule.lastBackup).toLocaleTimeString() : "No backups yet"],
            ["Auto-Backup", backupSchedule.autoEnabled ? "Enabled" : "Disabled"],
            ["Storage", "Supabase PostgreSQL + localStorage fallback"],
          ]} />
          {canDo("settings","update") && <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:10 }}>
            <Field label="Frequency"><Select value={backupSchedule.frequency} onChange={e=>setBackupSchedule({...backupSchedule,frequency:e.target.value})} options={["Hourly","Daily","Weekly"].map(v=>({value:v,label:v}))} /></Field>
            <Field label="Time"><Input type="time" value={backupSchedule.time} onChange={e=>setBackupSchedule({...backupSchedule,time:e.target.value})} /></Field>
            <Field label="Retention (days)"><Input type="number" value={backupSchedule.retention} onChange={e=>setBackupSchedule({...backupSchedule,retention:+e.target.value})} /></Field>
          </div>}
        </SectionCard>
        <SectionCard title="API Key Management" actions={canDo("settings","create") && <Btn size="sm" variant="secondary" onClick={addApiKey} icon={I.plus}>Generate Key</Btn>}>
          <Table columns={[
            { label:"Name", render:r=>cell.name(r.name) },
            { label:"Key", render:r=><span style={{ fontFamily:"monospace", fontSize:10, color:C.textDim }}>{r.key}</span> },
            { label:"Status", render:r=><Badge color={r.status==="Active"?"green":"red"}>{r.status}</Badge> },
            { label:"Created", render:r=>fmt.date(r.created) },
            { label:"Last Used", render:r=>r.lastUsed?fmt.date(r.lastUsed):"Never" },
            { label:"Actions", render:r=>r.status==="Active" && canDo("settings","update") ? <Btn size="sm" variant="danger" onClick={()=>revokeApiKey(r.id)}>Revoke</Btn> : null },
          ]} rows={apiKeys} />
        </SectionCard>
        <SectionCard title="Data Management">
          <InfoGrid items={[["Customers",customers.length],["Applications",applications.length],["Active Loans",loans.length],["Documents",documents.length],["Audit Entries",audit.length],["Collections Records",collections.length],["Communications",comms.length],["Database","Supabase (yioqaluxgqxsifclydmd)"]]} />
        </SectionCard>
      </div>}

      {/* ── Business Rules & Policies ── */}
      {adminTab === "rules" && <div>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {canDo("settings","create") && <Btn onClick={startNewRule} icon={I.plus}>New Rule</Btn>}
        </div>
        {policyForm && (
          <SectionCard title={policyEditing==="new"?"Create Business Rule":`Edit: ${policyForm.name}`}>
            <div className="kb-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <Field label="Rule Name *"><Input value={policyForm.name} onChange={e=>setPolicyForm({...policyForm,name:e.target.value})} /></Field>
              <Field label="Category"><Select value={policyForm.category} onChange={e=>setPolicyForm({...policyForm,category:e.target.value})} options={["Credit","Collections","Finance","Compliance","Operations","Governance"].map(v=>({value:v,label:v}))} /></Field>
              <Field label="Value *"><Input value={policyForm.value} onChange={e=>setPolicyForm({...policyForm,value:e.target.value})} placeholder="e.g. 1.25x, 30 days, R500,000" /></Field>
            </div>
            <Field label="Description"><Textarea value={policyForm.description||""} onChange={e=>setPolicyForm({...policyForm,description:e.target.value})} rows={2} /></Field>
            <div style={{ display:"flex", gap:8, marginTop:10 }}><Btn onClick={handleSaveRule}>Save Rule</Btn><Btn variant="ghost" onClick={()=>{setPolicyForm(null);setPolicyEditing(null)}}>Cancel</Btn></div>
          </SectionCard>
        )}
        <Table columns={[
          { label:"Rule", render:r=><div><div style={{ fontWeight:600, fontSize:12 }}>{r.name}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.description}</div></div> },
          { label:"Category", render:r=><Badge color={r.category==="Credit"?"blue":r.category==="Collections"?"amber":r.category==="Compliance"?"purple":"gray"}>{r.category}</Badge> },
          { label:"Value", render:r=>cell.count(r.value) },
          { label:"Status", render:r=><Badge color={r.status==="Active"?"green":"red"}>{r.status}</Badge> },
          { label:"Updated", render:r=><div><div style={{ fontSize:10 }}>{fmt.date(r.lastUpdated)}</div><div style={{ fontSize:10, color:C.textMuted }}>{r.updatedBy}</div></div> },
          { label:"Actions", render:r=>canDo("settings","update") ? <div style={{ display:"flex", gap:4 }}>
            <Btn size="sm" variant="ghost" onClick={()=>startEditRule(r)}>Edit</Btn>
            <Btn size="sm" variant={r.status==="Active"?"ghost":"secondary"} onClick={()=>toggleRule(r.id)}>{r.status==="Active"?"Suspend":"Activate"}</Btn>
          </div> : null },
        ]} rows={businessRules} />
        <SectionCard title="RBAC Permission Matrix">
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ borderBottom:`2px solid ${C.border}` }}>
                <th style={{ textAlign:"left", padding:"4px 6px", fontWeight:600, color:C.text }}>Module</th>
                {Object.keys(ROLES).map(r=><th key={r} style={{ textAlign:"center", padding:"4px 3px", fontWeight:500, color:C.textDim, fontSize:10 }}>{r.replace("_"," ")}</th>)}
              </tr></thead>
              <tbody>{Object.keys(PERMS).map(mod=>(
                <tr key={mod} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"4px 6px", fontWeight:500, color:C.text }}>{mod}</td>
                  {Object.keys(ROLES).map(r=><td key={r} style={{ textAlign:"center", padding:"4px 2px", color:PERMS[mod]?.[r]?C.textDim:C.border, fontSize:10 }}>{PERMS[mod]?.[r]||"—"}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title="Regulatory Framework">
          <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>
            {[["National Credit Act (NCA)","Affordability assessments, pre-agreement disclosure, debt collection standards"],
              ["FICA / AML","KYC verification, sanctions screening, suspicious transaction reporting to FIC"],
              ["POPIA","Data minimisation, privacy notices, customer rights, secure processing"],
              ["BB-BEE Act","Empowerment verification, ownership tracking, development impact reporting"],
              ["IFRS 9","Expected credit loss provisioning, 3-stage impairment model"]
            ].map(([title,desc],i)=><div key={i} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}><span style={{ fontWeight:600, color:C.text }}>{title}:</span> {desc}</div>)}
          </div>
        </SectionCard>
      </div>}
    </div>);
}
