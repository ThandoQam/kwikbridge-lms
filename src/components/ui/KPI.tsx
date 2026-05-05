/**
 * KPI — labelled numeric display card with optional trend indicator.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 358 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <KPI label="Total Loan Book" value={fmt.cur(125000000)}
 *        sub="42 active loans" trend="up" />
 *   <KPI label="Arrears" value={fmt.cur(8500000)}
 *        sub="7 accounts" alert={true} trend="down" />
 *
 * Props:
 *   - label:   uppercase eyebrow text
 *   - value:   the headline number/string (will use tabular-nums)
 *   - sub:     small grey subtitle
 *   - trend:   "up" | "down" — adds a colored arrow
 *   - alert:   boolean — colours the value red to flag a concern
 */
import React from 'react';
import { C } from './tokens';

interface KPIProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: 'up' | 'down' | null;
  color?: string;
  accent?: string;
  sparkData?: any;
  alert?: boolean;
}

export function KPI({ label, value, sub, trend, alert }: KPIProps) {
  const trendColor =
    trend === 'up' ? C.green : trend === 'down' ? C.red : C.textDim;
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  const valueColor = alert ? C.red : C.text;

  return (
    <div className="kb-kpi" data-testid="kpi" data-label={label} role="figure" aria-label={label} style={{ padding: '14px 0', transition: 'opacity .15s ease-out' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: valueColor,
            letterSpacing: -0.5,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {trendIcon && (
          <span style={{ fontSize: 11, fontWeight: 600, color: trendColor }}>{trendIcon}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
