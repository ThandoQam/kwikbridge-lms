/**
 * Typography design tokens — font sizes, weights, spacing scale, radius, shadows.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Was previously inlined as `const T = {...}` in kwikbridge-lms-v2.jsx
 * line 180.
 *
 * Use via T.fontSize.md, T.fontWeight.semi, T.spacing.lg, etc.
 */
export const T = {
  fontSize: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 13,
    lg: 14,
    xl: 16,
    h3: 18,
    h2: 22,
    h1: 28,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semi: 600,
    bold: 700,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 2,
    md: 4,
    lg: 8,
    pill: 10,
  },
  shadow: {
    none: 'none',
    sm: '0 1px 3px rgba(0,0,0,0.04)',
    md: '0 2px 8px rgba(0,0,0,0.06)',
    lg: '0 4px 16px rgba(0,0,0,0.08)',
  },
} as const;
