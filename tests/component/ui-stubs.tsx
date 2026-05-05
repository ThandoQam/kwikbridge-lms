/**
 * ui-stubs.tsx — minimal test doubles for UI primitives.
 *
 * Components extracted from the monolith receive UI primitives (Btn,
 * Field, KPI, etc.) as props because they're imports, not state. In
 * production these come from the monolith. In tests, we use these
 * minimal stubs that render their key content and respect the same
 * prop contract.
 *
 * The stubs intentionally render simple semantic HTML so assertions
 * can use accessible queries (getByRole, getByLabelText) regardless
 * of the production component's styling.
 */
import type { ReactNode, MouseEvent } from 'react';

export const C = {
  bg: '#f5f5f7', surface: '#ffffff', surface2: '#f8f9fc',
  text: '#1a1a2e', textDim: '#6b7280', textMuted: '#9ca3af',
  border: '#e5e7eb', accent: '#4f46e5', accentDim: '#818cf8',
  green: '#10b981', greenBg: '#d1fae5',
  red: '#ef4444', redBg: '#fee2e2',
  amber: '#f59e0b', amberBg: '#fef3c7',
  blue: '#3b82f6', blueBg: '#dbeafe',
  purple: '#8b5cf6', purpleBg: '#ede9fe',
};

export const I = new Proxy(
  {},
  { get: (_t, p) => `[icon:${String(p)}]` }
) as Record<string, string>;

export const fmt = {
  cur: (n: number) => `R${(n ?? 0).toLocaleString()}`,
  num: (n: number) => (n ?? 0).toLocaleString(),
  pct: (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`,
  date: (ts: number) => new Date(ts).toLocaleDateString(),
  dt: (ts: number) => new Date(ts).toLocaleString(),
  short: (s: string, n = 30) => (s ?? '').slice(0, n),
};

export const statusBadge = (s: string) => s;

export const Btn = ({
  children, onClick, variant, size, icon, disabled, ariaLabel,
  ariaPressed, ariaExpanded, ariaControls, type = 'button',
}: any) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-pressed={ariaPressed}
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    data-variant={variant}
    data-size={size}
  >
    {icon}{children}
  </button>
);

export const Badge = ({ children, color }: any) => (
  <span data-color={color} role="status">{children}</span>
);

export const Field = ({ label, children, htmlFor, hint, error }: any) => (
  <label htmlFor={htmlFor}>
    <span>{label}</span>
    {children}
    {hint && <span role="note">{hint}</span>}
    {error && <span role="alert">{error}</span>}
  </label>
);

export const Input = (props: any) => <input {...props} />;

export const Textarea = (props: any) => <textarea {...props} />;

export const Select = ({ value, onChange, options }: any) => (
  <select value={value} onChange={onChange}>
    {(options || []).map((o: any) => (
      <option key={o.value ?? o} value={o.value ?? o}>
        {o.label ?? o}
      </option>
    ))}
  </select>
);

export const KPI = ({ label, value, sub, trend, color, accent, alert }: any) => (
  <div data-testid="kpi" data-label={label} role="figure" aria-label={label}>
    <div data-testid="kpi-label">{label}</div>
    <div data-testid="kpi-value">{value}</div>
    {sub && <div data-testid="kpi-sub">{sub}</div>}
    {trend !== undefined && <div data-testid="kpi-trend">{trend}</div>}
    {alert && <div data-testid="kpi-alert">{alert}</div>}
  </div>
);

export const SectionCard = ({ title, children, actions }: any) => (
  <section aria-label={title}>
    <header>
      <h2>{title}</h2>
      {actions && <div>{actions}</div>}
    </header>
    {children}
  </section>
);

export const ProgressBar = ({ value, max = 100 }: any) => (
  <div role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0} />
);

export const Tab = ({ tabs, active, onChange, label = 'Sections' }: any) => (
  <div role="tablist" aria-label={label}>
    {(tabs || []).map((t: any) => (
      <button
        key={t.key ?? t}
        role="tab"
        aria-selected={active === (t.key ?? t)}
        onClick={() => onChange(t.key ?? t)}
      >
        {t.label ?? t}
      </button>
    ))}
  </div>
);

export const Table = ({ columns, rows, onRowClick, emptyMsg = 'No records found', caption }: any) => (
  <table>
    {caption && <caption>{caption}</caption>}
    <thead>
      <tr>
        {(columns || []).map((c: any) => (
          <th key={c.key ?? c} scope="col">{c.label ?? c}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {!rows?.length ? (
        <tr><td colSpan={columns?.length ?? 1}>{emptyMsg}</td></tr>
      ) : rows.map((row: any, i: number) => (
        <tr
          key={row.id ?? i}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          tabIndex={onRowClick ? 0 : -1}
        >
          {(columns || []).map((c: any) => (
            <td key={c.key ?? c}>
              {typeof c.render === 'function' ? c.render(row) : row[c.key]}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export const InfoGrid = ({ items }: any) => (
  <dl>
    {(items || []).map(([k, v]: [string, any], i: number) => (
      <div key={i}>
        <dt>{k}</dt>
        <dd>{v}</dd>
      </div>
    ))}
  </dl>
);

// Bundle for spreading into props in tests
export const uiPrimitives = {
  Btn, Badge, Field, Input, Textarea, Select,
  KPI, SectionCard, ProgressBar, Tab, Table, InfoGrid,
  I, C, fmt, statusBadge,
};
