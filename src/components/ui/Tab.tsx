// KwikBridge LMS — Tab Component
import { C } from "../../lib/theme";

export function Tab({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{ padding: "8px 16px", border: "none", borderBottom: active === t.key ? `2px solid ${C.text}` : "2px solid transparent", background: "transparent", color: active === t.key ? C.text : C.textMuted, fontSize: 12, fontWeight: active === t.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>{t.label}{t.count != null && <span style={{ marginLeft: 6, color: C.textMuted, fontWeight: 400 }}>({t.count})</span>}</button>
      ))}
    </div>
  );
}
