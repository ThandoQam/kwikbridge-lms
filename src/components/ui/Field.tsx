/**
 * Field — labelled form-field wrapper with hint and error states.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 470 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Field label="Business Name *">
 *     <Input value={name} onChange={(e) => setName(e.target.value)} />
 *   </Field>
 *
 *   <Field label="Email" hint="We'll never share your email">
 *     <Input type="email" />
 *   </Field>
 *
 *   <Field label="ID Number *" error="Invalid SA ID number">
 *     <Input value="123" />
 *   </Field>
 *
 * The label's `for` attribute is auto-derived from the label text if
 * htmlFor is not provided; pair this with the Input/Select/Textarea
 * primitives which accept an `id` prop matching the derived value.
 *
 * If both `hint` and `error` are present, only the error is shown.
 * The error is announced by screen readers via role="alert".
 */
import React from 'react';
import { C } from './tokens';

interface FieldProps {
  label?: string;
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  error?: string;
}

export function Field({ label, children, htmlFor, hint, error }: FieldProps) {
  const fieldId =
    htmlFor ||
    (label ? `kb-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: C.textMuted,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <div
          id={fieldId ? `${fieldId}-hint` : undefined}
          style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}
        >
          {hint}
        </div>
      )}
      {error && (
        <div
          id={fieldId ? `${fieldId}-err` : undefined}
          role="alert"
          style={{ fontSize: 11, color: C.red, marginTop: 4 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
