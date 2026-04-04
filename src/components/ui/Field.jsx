// KwikBridge LMS — Field Component
import { C } from "../../lib/theme.js";

export function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>{children}</div>;
}
