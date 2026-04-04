// KwikBridge LMS — Select Component
import { C } from "../../lib/theme.js";

export function Select({ value, onChange, options, ...rest }) {
  return <select value={value} onChange={onChange} {...rest} style={{ width: "100%", padding: "8px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
