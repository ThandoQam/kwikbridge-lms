// KwikBridge LMS — Modal Component
import { C, I } from "../../lib/theme";

export function Modal({ open, onClose, title, width = 520, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 2, padding: 0, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", border: `1px solid ${C.borderLight}`, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>{I.x}</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(90vh - 60px)" }}>{children}</div>
      </div>
    </div>
  );
}
