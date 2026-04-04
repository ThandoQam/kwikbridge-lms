// KwikBridge LMS — Badge Component
import { C } from "../../lib/theme";

export function Badge({ children, color = "slate" }) {
  const map = {
    green: { text: C.green },
    amber: { text: C.amber },
    red: { text: C.red },
    blue: { text: C.blue },
    purple: { text: C.purple },
    cyan: { text: C.textDim },
    slate: { text: C.textMuted },
  };
  const s = map[color] || map.slate;
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:3, fontSize:11, fontWeight:600, letterSpacing:0.2, background:"transparent", color:s.text, border:`1px solid ${C.border}`, whiteSpace:"nowrap", lineHeight:"16px" }}>{children}</span>;
}
