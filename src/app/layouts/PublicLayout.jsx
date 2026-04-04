// KwikBridge LMS — Public Zone Layout
// Header with nav, main content area. No auth required.

import React from "react";
import { C } from "../../lib/theme.js";

export function PublicLayout({ page, setPage, setZone, setAuthForm, setAuthMode, children }) {
  return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      <style>{`*{box-sizing:border-box} input:focus,select:focus,textarea:focus{outline:none;border-color:#1a1a2e !important}
        @media(max-width:768px){.kb-pub-nav{gap:8px !important}.kb-pub-nav button{font-size:11px !important;padding:3px 0 !important}.kb-pub-hero h1{font-size:24px !important}.kb-pub-grid2{grid-template-columns:1fr !important}}
        @media(max-width:480px){.kb-pub-nav{flex-wrap:wrap}.kb-pub-cta{flex-direction:column !important}}
      `}</style>
      <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text, letterSpacing:-0.3 }}>KwikBridge</div>
          <div style={{ fontSize:9, color:C.textMuted, letterSpacing:1, textTransform:"uppercase" }}>Loan Management</div>
        </div>
        <nav className="kb-pub-nav" style={{ display:"flex", gap:16, alignItems:"center" }}>
          {[["public_home","Home"],["public_apply","Apply for Financing"],["public_track","Track Application"]].map(([k,label])=>(
            <button key={k} onClick={()=>setPage(k)} style={{ background:"none", border:"none", fontSize:13, fontWeight:page===k?600:400, color:page===k?C.text:C.textDim, cursor:"pointer", fontFamily:"inherit", padding:"4px 0", borderBottom:page===k?`2px solid ${C.text}`:"2px solid transparent" }}>{label}</button>
          ))}
          <div style={{ width:1, height:20, background:C.border, margin:"0 4px" }} />
          <button onClick={()=>{setAuthMode("login");setZone("auth");setAuthForm({email:"",password:"",name:"",error:""})}} style={{ background:"none", border:`1px solid ${C.border}`, padding:"6px 14px", fontSize:12, fontWeight:500, color:C.text, cursor:"pointer", fontFamily:"inherit" }}>Staff Login</button>
        </nav>
      </header>
      <main style={{ maxWidth:960, margin:"0 auto", padding:"32px 24px" }}>
        {children}
      </main>
      <footer style={{ textAlign:"center", padding:"32px 24px", fontSize:11, color:C.textMuted, borderTop:`1px solid ${C.border}` }}>
        TQA Capital (Pty) Ltd · Registered Credit Provider NCRCP22396 · East London, Nahoon Valley
      </footer>
    </div>
  );
}
