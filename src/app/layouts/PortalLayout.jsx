// KwikBridge LMS — Borrower Portal Layout
// Sidebar + sticky header + main content. Filtered by authenticated customer.

import React from "react";
import { C, I } from "../../lib/theme.js";

export function PortalLayout({ page, navTo, goBack, canGoBack, portalNav, handleSignOut, authSession, myCustomer, children }) {
  return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", display:"flex", height:"100vh", background:C.bg, color:C.text }}>
      {/* Sidebar */}
      <aside style={{ width:200, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"14px 14px 10px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.text }}>KwikBridge</div>
          <div style={{ fontSize:9, color:C.textMuted, letterSpacing:0.5 }}>BORROWER PORTAL</div>
        </div>
        <div style={{ flex:1, padding:"8px 6px", overflow:"auto" }}>
          {(portalNav || []).map(n => (
            <button key={n.key} onClick={()=>navTo(n.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 10px", marginBottom:1, background:page===n.key?C.surface2:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:page===n.key?600:400, color:page===n.key?C.text:C.textDim, textAlign:"left" }}>
              {n.icon}{n.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:10, fontWeight:500, color:C.text }}>{authSession?.user?.email}</div>
          <div style={{ fontSize:9, color:C.textMuted, marginBottom:4 }}>Borrower Account</div>
          <button onClick={handleSignOut} style={{ background:"none", border:`1px solid ${C.border}`, color:C.red, padding:"2px 6px", fontSize:9, cursor:"pointer", fontFamily:"inherit" }}>Sign Out</button>
        </div>
      </aside>
      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", height:48, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {canGoBack && <button onClick={goBack} style={{ background:"none", border:"none", cursor:"pointer", color:C.textDim, padding:"4px 2px", display:"flex", alignItems:"center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>}
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{(portalNav || []).find(n=>n.key===page)?.label || "Portal"}</div>
          </div>
          <div style={{ fontSize:11, color:C.textMuted }}>{myCustomer?.name || authSession?.user?.email}</div>
        </header>
        <main style={{ flex:1, overflow:"auto", padding:16 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
