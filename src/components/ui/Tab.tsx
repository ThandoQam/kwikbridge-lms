/**
 * Tab — tablist with arrow-key keyboard navigation.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 495 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Tab
 *     tabs={[
 *       { key: 'overview', label: 'Overview' },
 *       { key: 'history', label: 'History', count: 12 },
 *       { key: 'docs', label: 'Documents', count: 4 },
 *     ]}
 *     active={activeTab}
 *     onChange={setActiveTab}
 *     label="Customer detail sections"
 *   />
 *
 * Accessibility:
 *   - role="tablist" with aria-label
 *   - Each tab is role="tab" with aria-selected
 *   - Arrow Left/Right cycle through tabs
 *   - Home/End jump to first/last tab
 */
import React from 'react';
import { ariaTab, ariaTablist } from '../../lib/accessibility';
import { C } from './tokens';

interface TabItem {
  key: string;
  label: string;
  count?: number | null;
}

interface TabProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  label?: string;
}

export function Tab({ tabs, active, onChange, label = 'Sections' }: TabProps) {
  const tablistProps = ariaTablist(label);
  return (
    <div
      {...tablistProps}
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 20,
      }}
    >
      {tabs.map((t, i) => {
        const tabProps = ariaTab({
          selected: active === t.key,
          controls: `panel-${t.key}`,
          id: `tab-${t.key}`,
        });
        return (
          <button
            key={t.key}
            {...tabProps}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                const next = tabs[(i + 1) % tabs.length];
                onChange(next.key);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prev = tabs[(i - 1 + tabs.length) % tabs.length];
                onChange(prev.key);
              } else if (e.key === 'Home') {
                e.preventDefault();
                onChange(tabs[0].key);
              } else if (e.key === 'End') {
                e.preventDefault();
                onChange(tabs[tabs.length - 1].key);
              }
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: active === t.key ? `2px solid ${C.text}` : '2px solid transparent',
              background: 'transparent',
              color: active === t.key ? C.text : C.textMuted,
              fontSize: 12,
              fontWeight: active === t.key ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: -1,
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{ marginLeft: 6, color: C.textMuted, fontWeight: 400 }}>
                ({t.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
