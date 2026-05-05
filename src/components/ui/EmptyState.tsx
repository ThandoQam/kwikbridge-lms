/**
 * EmptyState — placeholder for empty data with optional CTA.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 578 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <EmptyState
 *     icon="📋"
 *     title="No applications yet"
 *     message="Get started by clicking the button below"
 *     action="New Application"
 *     onAction={() => setShowNewApp(true)}
 *   />
 *
 * All props are optional. Defaults provide a generic empty state.
 */
import React from 'react';
import { C } from './tokens';
import { Btn } from './Btn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, action, onAction }: EmptyStateProps) {
  return (
    <div className="kb-animate" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>{icon || '📋'}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {title || 'Nothing here yet'}
      </div>
      <div
        style={{
          fontSize: 12,
          color: C.textMuted,
          maxWidth: 300,
          margin: '0 auto',
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        {message || ''}
      </div>
      {action && onAction && (
        <Btn onClick={onAction} size="sm">
          {action}
        </Btn>
      )}
    </div>
  );
}
