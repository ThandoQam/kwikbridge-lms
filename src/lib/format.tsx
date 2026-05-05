/**
 * Format helpers — value formatters and table cell renderers.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint Step 2, May 2026).
 * Was inlined as `const fmt = {...}` and `const cell = {...}` in
 * kwikbridge-lms-v2.jsx around lines 155 and 171.
 *
 * Two related modules in one file because `cell` depends on `fmt`,
 * and they're conceptually a pair (raw value → formatted string,
 * formatted string → styled JSX).
 *
 * `fmt` produces strings — safe for use anywhere (including outside React).
 * `cell` produces JSX — only usable inside React render trees.
 */
import React from 'react';
import { C, T } from '../components/ui';

/**
 * fmt — pure-string value formatters using South African locale.
 *
 * Examples:
 *   fmt.cur(1500000)          → "R 1,500,000.00"
 *   fmt.date(Date.now())      → "05 May 2026"
 *   fmt.dateTime(Date.now())  → "05 May 2026, 14:30"
 *   fmt.pct(0.125)            → "12.5%"
 *   fmt.pct(0.125, 2)         → "12.50%"
 *   fmt.num(1234567)          → "1,234,567"
 *
 * All formatters tolerate null/undefined input and produce sensible defaults.
 */
export const fmt = {
  date: (d: number | string | Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString('en-ZA', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—',
  dateTime: (d: number | string | Date | null | undefined) =>
    d
      ? new Date(d).toLocaleString('en-ZA', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—',
  cur: (n: number | string | null | undefined) =>
    'R ' +
    Number(n || 0).toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  pct: (n: number | null | undefined, d = 1) => ((n ?? 0) * 100).toFixed(d) + '%',
  num: (n: number | string | null | undefined) =>
    Number(n || 0).toLocaleString('en-ZA'),
};

/**
 * cell — table cell renderers that produce styled JSX from raw values.
 *
 * Each cell renderer takes a value and returns a styled <span>. Used
 * with the Table component's `render` callback in column definitions:
 *
 *   columns={[
 *     { label: 'ID',     render: r => cell.id(r.id) },
 *     { label: 'Name',   render: r => cell.name(r.name) },
 *     { label: 'Amount', render: r => cell.money(r.amount) },
 *     { label: 'Date',   render: r => cell.date(r.createdAt) },
 *   ]}
 *
 * Renderers:
 *   id    — monospace, semi-bold (for IDs and short codes)
 *   name  — medium weight (for proper nouns)
 *   text  — base size, dim color (general text)
 *   money — monospace, formatted with fmt.cur
 *   date  — formatted with fmt.date, dim color
 *   pct   — monospace, one decimal place
 *   count — semi-bold (for numeric counts)
 *   dim   — small, muted (for de-emphasized text)
 *   mono  — monospace (for codes/IDs without weight)
 *   badge — placeholder helper for null badge values
 */
export const cell = {
  id: (v: any) => (
    <span
      style={{
        fontFamily: 'monospace',
        fontWeight: T.fontWeight.semi,
        fontSize: T.fontSize.base,
      }}
    >
      {v}
    </span>
  ),
  name: (v: any) => (
    <span style={{ fontWeight: T.fontWeight.medium, fontSize: T.fontSize.md }}>{v}</span>
  ),
  text: (v: any) => (
    <span style={{ fontSize: T.fontSize.base, color: C.textDim }}>{v}</span>
  ),
  money: (v: any) => (
    <span style={{ fontFamily: 'monospace', fontSize: T.fontSize.base }}>
      {typeof v === 'number' ? fmt.cur(v) : v}
    </span>
  ),
  date: (v: any) => (
    <span style={{ fontSize: T.fontSize.base, color: C.textDim }}>
      {v ? fmt.date(v) : '—'}
    </span>
  ),
  pct: (v: any) => (
    <span style={{ fontFamily: 'monospace', fontSize: T.fontSize.base }}>
      {typeof v === 'number' ? v.toFixed(1) + '%' : v}
    </span>
  ),
  count: (v: any) => (
    <span style={{ fontWeight: T.fontWeight.semi, fontSize: T.fontSize.md }}>{v}</span>
  ),
  badge: (v: any) => {
    if (!v)
      return (
        <span style={{ fontSize: T.fontSize.xs, color: C.textMuted }}>—</span>
      );
    return null;
  },
  dim: (v: any) => (
    <span style={{ fontSize: T.fontSize.sm, color: C.textMuted }}>{v || '—'}</span>
  ),
  mono: (v: any) => (
    <span style={{ fontFamily: 'monospace', fontSize: T.fontSize.base }}>{v}</span>
  ),
};
