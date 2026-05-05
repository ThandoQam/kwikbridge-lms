/**
 * SectionCard — section container with optional title and header actions.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 541 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <SectionCard
 *     title="Customer Profile"
 *     actions={<Btn size="sm" variant="ghost">Edit</Btn>}
 *   >
 *     <p>Card body content with optional actions in the header.</p>
 *   </SectionCard>
 *
 *   <SectionCard>Untitled card</SectionCard>
 */
import React from 'react';
import { C } from './tokens';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function SectionCard({ title, children, actions }: SectionCardProps) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px 8px',
            borderBottom: 'none',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              color: C.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            {title}
          </h3>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: title ? '4px 20px 16px' : '16px 20px' }}>{children}</div>
    </div>
  );
}
