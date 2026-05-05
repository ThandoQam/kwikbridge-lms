/**
 * Textarea — multi-line text input with consistent border, padding, and resize behavior.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 491 of kwikbridge-lms-v2.jsx.
 *
 * All standard <textarea> props are forwarded. Vertical-only resize.
 *
 * Usage:
 *   <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
 */
import React from 'react';
import { C } from './tokens';

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
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
        resize: 'vertical',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}
