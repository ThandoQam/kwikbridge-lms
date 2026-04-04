// KwikBridge LMS — Input Component
import { C } from "../../lib/theme.js";

export function Input(props) {
  return <input {...props} style={{ width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...props.style }} />;
}
