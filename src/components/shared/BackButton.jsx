// KwikBridge LMS — Back Button
import { C } from "../../lib/theme.js";

export function BackButton({ onClick, label = "Back" }) {
  return (
    <button onClick={onClick} style={{
      background:"none", border:"none", color:C.accent, fontSize:13,
      fontWeight:600, cursor:"pointer", marginBottom:16, display:"flex",
      alignItems:"center", gap:4, fontFamily:"inherit"
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      {label}
    </button>
  );
}
