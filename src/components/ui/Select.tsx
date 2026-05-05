/**
 * Select — dropdown with options array.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 488 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Select
 *     value={industry}
 *     onChange={(e) => setIndustry(e.target.value)}
 *     options={[
 *       { value: 'mfg', label: 'Manufacturing' },
 *       { value: 'agri', label: 'Agriculture' },
 *     ]}
 *   />
 */
import React from 'react';
import { C } from './tokens';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
}

export function Select({ value, onChange, options, ...rest }: SelectProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      {...rest}
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
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
