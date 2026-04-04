// KwikBridge LMS — Staff Back-Office Layout
// Collapsible sidebar + sticky header (search, notifications, role switcher) + main.

import React, { useState } from "react";
import { C, I } from "../../lib/theme.js";

export function StaffLayout({
  page, navTo, goBack, canGoBack, sideCollapsed, setSideCollapsed,
  staffNavItems, currentUser, sysUsers, setCurrentUser,
  search, setSearch, alerts, unread, markRead,
  notifOpen, setNotifOpen, handleSignOut, reset,
  authSession, children
}) {
  return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", display:"flex", height:"100vh", background:C.bg, color:C.text }}>
      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d4d4d4;border-radius:0}
        *{box-sizing:border-box}
        @media(max-width:768px){
          .kb-sidebar{display:none !important}
          .kb-main{width:100% !important}
          .kb-header-search{display:none !important}
          .kb-grid-2{grid-template-columns:1fr !important}
          .kb-grid-3{grid-template-columns:1fr !important}
          .kb-grid-4{grid-template-columns:1fr 1fr !important}
          .kb-kpi-row{flex-wrap:wrap !important}
          .kb-kpi-row>div{min-width:120px !important}
        }
        @media(max-width:480px){
          .kb-grid-4{grid-template-columns:1fr !important}
        }
      `}</style>

      {/* Sidebar */}
      <aside className="kb-sidebar" style={{ width:sideCollapsed?52:210, background:C.surface, borderRight:`1px solid ${C.border}`, transition:"width .15s", flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:sideCollapsed?"12px 8px":"14px 14px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={()=>setSideCollapsed(!sideCollapsed)}>
          {!sideCollapsed && <div><div style={{ fontSize:13, fontWeight:600, color:C.text, letterSpacing:-0.2 }}>KwikBridge</div><div style={{ fontSize:9, color:C.textMuted, letterSpacing:0.5 }}>LOAN MANAGEMENT</div></div>}
        </div>
        <div style={{ flex:1, padding:sideCollapsed?"4px":"4px 6px", overflow:"auto" }}>
          {(staffNavItems || []).map(n => {
            const active = page === n.key;
            return (
              <button key={n.key} onClick={()=>navTo(n.key)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:sideCollapsed?"7px 0":"6px 10px", justifyContent:sideCollapsed?"center":"flex-start", background:active?C.surface2:"transparent", color:active?C.text:C.textDim, border:"none", borderLeft:active?`2px solid ${C.text}`:"2px solid transparent", fontSize:12, fontWeight:active?600:400, cursor:"pointer", marginBottom:0, fontFamily:"inherit" }}>
                {n.icon}
                {!sideCollapsed && <span style={{ flex:1, textAlign:"left" }}>{n.label}</span>}
                {!sideCollapsed && n.count != null && n.count > 0 && <span style={{ fontSize:10, color:C.textMuted }}>{n.count}</span>}
              </button>
            );
          })}
        </div>
        {!sideCollapsed && <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}` }}>
          <button onClick={reset} style={{ background:"none", border:`1px solid ${C.border}`, color:C.textMuted, padding:"3px 8px", fontSize:9, cursor:"pointer", fontFamily:"inherit", width:"100%", marginBottom:4 }}>Reset Demo</button>
          <button onClick={handleSignOut} style={{ background:"none", border:`1px solid ${C.border}`, color:C.red, padding:"3px 8px", fontSize:9, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>Sign Out</button>
        </div>}
      </aside>

      {/* Main */}
      <div className="kb-main" style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {canGoBack && <button onClick={goBack} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:"4px 2px", display:"flex", alignItems:"center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>}
            <div className="kb-header-search" style={{ display:"flex", alignItems:"center", gap:6, background:C.surface2, padding:"5px 10px", width:250, border:`1px solid ${C.border}` }}>
              {I.search}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ border:"none", background:"transparent", outline:"none", fontSize:12, color:C.text, width:"100%", fontFamily:"inherit" }} />
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative" }}>
              <button onClick={()=>setNotifOpen(!notifOpen)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, position:"relative", padding:4 }}>
                {I.bell}
                {unread>0 && <span style={{ position:"absolute", top:-2, right:-2, width:14, height:14, borderRadius:7, background:C.red, color:C.white, fontSize:8, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>{unread}</span>}
              </button>
              {notifOpen && <div style={{ position:"absolute", right:0, top:34, width:340, background:C.surface, border:`1px solid ${C.border}`, boxShadow:"0 4px 16px rgba(0,0,0,0.06)", zIndex:100, maxHeight:380, overflow:"auto" }}>
                <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, fontSize:12, fontWeight:600, color:C.text }}>Notifications ({unread})</div>
                {(alerts || []).slice(0,8).map(a => (
                  <div key={a.id} style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, opacity:a.read?0.35:1, cursor:"pointer" }} onClick={()=>markRead(a.id)}>
                    <div style={{ fontSize:11, fontWeight:500, color:C.text }}>{a.title}</div>
                    <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{a.msg}</div>
                  </div>
                ))}
              </div>}
            </div>
            <div style={{ width:1, height:20, background:C.border }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:26, height:26, borderRadius:2, background:C.surface2, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:C.textDim }}>{currentUser?.initials}</div>
              <div>
                <select value={currentUser?.id} onChange={e=>{const u=sysUsers.find(u=>u.id===e.target.value);if(u)setCurrentUser(u)}} style={{ border:"none", background:"transparent", fontSize:11, fontWeight:500, color:C.text, fontFamily:"inherit", outline:"none", cursor:"pointer", maxWidth:160 }}>
                  {(sysUsers || []).filter(u=>(u.status||"Active")==="Active").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                {authSession?.user?.email && <div style={{ fontSize:9, color:C.textMuted }}>{authSession.user.email}</div>}
              </div>
            </div>
          </div>
        </header>
        <main style={{ flex:1, overflow:"auto", padding:16 }} onClick={()=>notifOpen&&setNotifOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}
