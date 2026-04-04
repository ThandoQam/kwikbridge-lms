// KwikBridge LMS — KPI Component
import { C } from "../../lib/theme";

export function KPI({ label, value, sub }) {
  return (
    <div style={{ background: C.surface, borderRadius: 4, padding: "16px 20px", border: `1px solid ${C.border}`, flex: "1 1 200px", minWidth: 170 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
