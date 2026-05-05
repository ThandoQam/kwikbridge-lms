/**
 * Modal — focus-trapping dialog with ESC-to-close and backdrop dismiss.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 420 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Modal open={isOpen} onClose={() => setOpen(false)} title="Confirm">
 *     <p>Body content</p>
 *     <Btn onClick={handleConfirm}>Confirm</Btn>
 *   </Modal>
 *
 * Accessibility:
 *   - role="dialog" + aria-modal="true" via ariaDialog helper
 *   - Focus moves into the dialog on open, restores on close
 *   - Tab key trapped inside the dialog (focus trap)
 *   - ESC key closes the dialog
 *   - Backdrop click closes the dialog (clicks inside the dialog do not)
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { ariaDialog, trapFocus } from '../../lib/accessibility';
import { C } from './tokens';
import { I } from './tokens';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, width = 520, children }: ModalProps) {
  const titleId = useMemo(
    () => `kb-modal-title-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    // Save focus origin and set focus inside the dialog
    previousFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog) {
      // Focus first focusable element or the dialog itself
      const focusable = dialog.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      (focusable || dialog).focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      } else if (e.key === 'Tab' && dialog) {
        trapFocus(dialog, e);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      // Restore focus to the trigger element
      if (previousFocus.current && (previousFocus.current as HTMLElement).focus) {
        (previousFocus.current as HTMLElement).focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;
  const dialogProps = ariaDialog(titleId);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        {...dialogProps}
        tabIndex={-1}
        style={{
          background: C.surface,
          borderRadius: 2,
          padding: 0,
          width,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          border: `1px solid ${C.borderLight}`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <h3 id={titleId} style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              color: C.textMuted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            {I.x}
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
