/**
 * Input — text input with consistent border, padding, and focus styling.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 485 of kwikbridge-lms-v2.jsx.
 *
 * All standard <input> props are forwarded. Custom styles can be merged
 * via the `style` prop.
 *
 * Usage:
 *   <Input value={x} onChange={(e) => setX(e.target.value)} />
 *   <Input type="email" placeholder="user@example.com" />
 *   <Input type="number" min={0} max={100} />
 */
import React from 'react';
import { C } from './tokens';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 2,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.text,
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}
