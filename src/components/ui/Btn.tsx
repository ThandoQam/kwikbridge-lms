/**
 * Btn — primary button primitive with variants, sizes, and ARIA support.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 381 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Btn onClick={handleSave}>Save</Btn>
 *   <Btn variant="ghost" size="sm" icon={I.plus}>Add</Btn>
 *   <Btn variant="danger" disabled={!canDelete}>Delete</Btn>
 *
 * Variants: primary (default), secondary, danger, ghost
 * Sizes: sm, md (default), lg
 *
 * ARIA props (ariaPressed, ariaExpanded, ariaControls) thread through
 * to the underlying button via the ariaButton helper.
 */
import React from 'react';
import { ariaButton } from '../../lib/accessibility';
import { C } from './tokens';

interface BtnProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  ariaControls,
  type = 'button',
}: BtnProps) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    primary: { bg: C.accent, color: '#ffffff', border: 'none' },
    secondary: { bg: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    danger: { bg: 'transparent', color: C.red, border: `1px solid ${C.border}` },
    ghost: { bg: 'transparent', color: C.textDim, border: 'none' },
  };
  const s = styles[variant];
  const pad = size === 'sm' ? '5px 10px' : size === 'lg' ? '10px 20px' : '7px 14px';
  const fs = size === 'sm' ? 12 : 13;
  const aria = ariaButton({
    label: ariaLabel,
    pressed: ariaPressed,
    expanded: ariaExpanded,
    controls: ariaControls,
    disabled,
  });
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...aria}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: pad,
        background: s.bg,
        color: s.color,
        border: s.border,
        borderRadius: 3,
        fontSize: fs,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all .15s',
        fontFamily: 'inherit',
        letterSpacing: 0.1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
