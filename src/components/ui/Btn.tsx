// KwikBridge LMS — Btn Component
import { C } from "../../lib/theme";

export function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled }) {
  const styles = {
    primary: { bg: C.accent, color: "#ffffff", border: "none" },
    secondary: { bg: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { bg: "transparent", color: C.red, border: `1px solid ${C.border}` },
    ghost: { bg: "transparent", color: C.textDim, border: "none" },
  };
  const s = styles[variant];
  const pad = size === "sm" ? "5px 10px" : size === "lg" ? "10px 20px" : "7px 14px";
  const fs = size === "sm" ? 12 : 13;
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:pad, background:s.bg, color:s.color, border:s.border, borderRadius:3, fontSize:fs, fontWeight:500, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, transition:"all .15s", fontFamily:"inherit", letterSpacing:0.1 }}>{icon}{children}</button>;
}
