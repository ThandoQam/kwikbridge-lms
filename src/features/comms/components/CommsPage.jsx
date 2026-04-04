// KwikBridge LMS — Comms Page
// Communication log — phone, email, SMS, letters, meetings
// Extracted from monolith Phase 3. Consumes shared state via props.

import React from "react";

export function Comms() {
    return (<div>
      <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>Communication Center</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:C.textMuted }}>Omnichannel communication log — Phone, Email, SMS, Letters, Meetings</p>
      <Table columns={[
        { label:"Date", render:r=>fmt.dateTime(r.ts) },
        { label:"Customer", render:r=>cust(r.custId)?.name },
        { label:"Channel", render:r=><Badge color={r.channel==="Phone"?"blue":r.channel==="Email"?"cyan":r.channel==="Letter"?"amber":r.channel==="In-Person"?"green":"slate"}>{r.channel||"—"}</Badge> },
        { label:"Direction", render:r=><Badge color={r.direction==="Inbound"?"purple":"slate"}>{r.direction}</Badge> },
        { label:"Subject", render:r=><span style={{ fontWeight:600 }}>{r.subject}</span> },
        { label:"From/By", key:"from" },
        { label:"Summary", render:r=><span style={{ fontSize:11, color:C.textDim, maxWidth:250, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", whiteSpace:"nowrap" }}>{r.body}</span> },
      ]} rows={[...comms].sort((a,b)=>b.ts-a.ts)} />
    </div>);
  }
