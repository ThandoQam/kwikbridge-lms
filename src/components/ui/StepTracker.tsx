/**
 * StepTracker — vertical step list with done/current/pending states.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 553 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <StepTracker
 *     current={2}
 *     steps={[
 *       { label: 'Application submitted', detail: '5 days ago' },
 *       { label: 'KYC verification', detail: 'Completed' },
 *       { label: 'Underwriting in progress' },
 *       { label: 'Decision' },
 *       { label: 'Disbursement' },
 *     ]}
 *   />
 *
 * Steps with index < current are marked done with a check icon.
 * The step at index === current is the active step.
 * Subsequent steps are pending (greyed).
 */
import React from 'react';
import { C, I } from './tokens';

interface StepTrackerStep {
  label: string;
  detail?: string;
}

interface StepTrackerProps {
  steps: StepTrackerStep[];
  current: number;
}

export function StepTracker({ steps, current }: StepTrackerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: done ? C.accent : 'transparent',
                  color: done ? '#fff' : active ? C.text : C.textMuted,
                  fontSize: 10,
                  fontWeight: 600,
                  border: `1px solid ${done ? C.accent : C.border}`,
                }}
              >
                {done ? I.check : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 1, height: 20, background: C.border }} />
              )}
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: done ? C.text : active ? C.text : C.textMuted,
                }}
              >
                {s.label}
              </div>
              {s.detail && (
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{s.detail}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
