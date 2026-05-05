/**
 * Colour design tokens — single source of truth for all colours.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Was previously inlined as `const C = {...}` in kwikbridge-lms-v2.jsx
 * line 166.
 *
 * Naming convention:
 *   - Surfaces: bg (page), surface (cards), surface2/3 (subtle nesting)
 *   - Borders: border (default), borderLight (emphasised)
 *   - Text: text (primary), textDim (secondary), textMuted (tertiary)
 *   - Accent: accent (brand), accentDim (hover), accentGlow (subtle bg)
 *   - Semantic: green/amber/red/purple/blue with -Dim hover and -Bg
 *
 * To add a new colour, append it here and use via C.<name> everywhere.
 */
export const C = {
  bg: '#f8f9fb',
  surface: '#ffffff',
  surface2: '#f5f6f8',
  surface3: '#f3f4f6',

  border: '#e2e5ea',
  borderLight: '#d1d5db',

  text: '#111827',
  textDim: '#4b5563',
  textMuted: '#9ca3af',

  accent: '#1e3a5f',
  accentDim: '#2d5487',
  accentGlow: '#eef2f7',

  green: '#059669',
  greenDim: '#047857',
  greenBg: '#ecfdf5',

  amber: '#d97706',
  amberDim: '#b45309',
  amberBg: '#fffbeb',

  red: '#dc2626',
  redDim: '#b91c1c',
  redBg: '#fef2f2',

  purple: '#7c3aed',
  purpleBg: '#f5f3ff',

  blue: '#2563eb',
  blueBg: '#eff6ff',

  white: '#ffffff',
} as const;

export type ColorToken = keyof typeof C;
