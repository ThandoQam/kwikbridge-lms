/**
 * InfoGrid — responsive grid of label/value pairs.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 528 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <InfoGrid items={[
 *     ['Customer ID', 'C-001'],
 *     ['Industry', 'Manufacturing'],
 *     ['BEE Level', '2'],
 *     ['Annual Revenue', fmt.cur(5_000_000)],
 *   ]} />
 *
 * Auto-responsive: columns adjust based on container width
 * (auto-fill, minmax(200px, 1fr)).
 */
import React from 'react';
import { C } from './tokens';

interface InfoGridProps {
  items: Array<[label: string, value: React.ReactNode]>;
}

export function InfoGrid({ items }: InfoGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 0,
        border: `1px solid ${C.border}`,
      }}
    >
      {items.map(([l, v], i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {l}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
