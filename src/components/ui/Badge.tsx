/**
 * Badge — small inline status pill.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 340 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Badge color="green">Active</Badge>
 *   <Badge color="red">Failed</Badge>
 *
 * Available colours: green, amber, red, blue, purple, cyan, slate (default).
 * For semantic status strings (Approved, Pending, etc.) use `statusBadge`
 * which maps strings to colours automatically.
 */
import React from 'react';
import { C } from './tokens';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'cyan' | 'slate';
}

export function Badge({ children, color = 'slate' }: BadgeProps) {
  const map: Record<string, { text: string; bg: string }> = {
    green: { text: C.green, bg: C.greenBg },
    amber: { text: C.amber, bg: C.amberBg },
    red: { text: C.red, bg: C.redBg },
    blue: { text: C.blue, bg: C.blueBg },
    purple: { text: C.purple, bg: C.purpleBg },
    cyan: { text: C.textDim, bg: C.surface3 },
    slate: { text: C.textMuted, bg: C.surface3 },
  };
  const s = map[color] || map.slate;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.2,
        background: s.bg,
        color: s.text,
        whiteSpace: 'nowrap',
        lineHeight: '16px',
      }}
    >
      {children}
    </span>
  );
}

/**
 * statusBadge — convenience wrapper that maps status strings to badge colours.
 * Centralises the workflow → colour mapping so it's consistent across the app.
 */
export function statusBadge(s: string) {
  const m: Record<string, BadgeProps['color']> = {
    Approved: 'green', Active: 'green', Disbursed: 'green', Verified: 'green',
    Compliant: 'green', Cleared: 'green', Settled: 'green',
    Submitted: 'blue', Underwriting: 'cyan', Booked: 'purple',
    'Pre-Approval': 'cyan', 'Pending Approval': 'purple',
    Pending: 'amber', 'Pending Review': 'amber', Due: 'amber',
    Draft: 'slate', Overdue: 'red', Early: 'amber', Mid: 'amber',
    Late: 'red', Declined: 'red', Breach: 'red', 'Written Off': 'red',
    Expired: 'red', Withdrawn: 'slate', Received: 'blue', 'Under Review': 'cyan',
  };
  return <Badge color={m[s] || 'slate'}>{s}</Badge>;
}
