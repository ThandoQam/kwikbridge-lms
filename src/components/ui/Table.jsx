// KwikBridge LMS — Table Component
import { C } from "../../lib/theme.js";

export function Table({ columns, rows, onRowClick, emptyMsg = "No records found" }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${C.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: C.surface2 }}>
          {columns.map((c, i) => <th key={i} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = C.surface2; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {columns.map((c, ci) => <td key={ci} style={{ padding: "8px 14px", color: C.text, whiteSpace: "nowrap" }}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 12 }}>{emptyMsg}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
