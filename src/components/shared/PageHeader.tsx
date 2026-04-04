// KwikBridge LMS — Page Header
import { C } from "../../lib/theme";

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
      <div>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:700, color:C.text }}>{title}</h2>
        {subtitle && <p style={{ margin:0, fontSize:13, color:C.textMuted }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display:"flex", gap:8 }}>{actions}</div>}
      {children}
    </div>
  );
}
