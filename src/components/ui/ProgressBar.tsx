/**
 * ProgressBar — minimal horizontal progress indicator.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 519 of kwikbridge-lms-v2.jsx.
 *
 * BUG FIX: The original had a typo — `background: "C.surface3"` was a
 * literal string instead of a token reference. Now correctly uses
 * `background: C.surface3`.
 *
 * Usage:
 *   <ProgressBar value={50} />
 *   <ProgressBar value={apiCalls} max={1000} color={C.green} />
 */
import React from 'react';
import { C } from './tokens';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({
  value,
  max = 100,
  color = C.textMuted,
  height = 4,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{ height, borderRadius: 0, background: C.surface3, overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 0,
          background: color,
          width: `${pct}%`,
          transition: 'width .5s ease',
        }}
      />
    </div>
  );
}
