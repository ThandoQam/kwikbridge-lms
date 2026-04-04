// KwikBridge LMS — SectionCard Component
import { C } from "../../lib/theme.js";

export function SectionCard({ title, children, actions }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, marginBottom: 16, overflow: "hidden" }}>
      {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h3>
        {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
      </div>}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
