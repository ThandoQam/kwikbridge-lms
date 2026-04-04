// KwikBridge LMS — InfoGrid Component
import { C } from "../../lib/theme.js";

export function InfoGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 0, border: `1px solid ${C.border}` }}>
      {items.map(([l, v], i) => (
        <div key={i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
