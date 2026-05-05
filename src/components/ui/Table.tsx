/**
 * Table — data table with column-driven rendering, optional row click,
 * and accessible empty state.
 *
 * EXTRACTED FROM MONOLITH (UI Primitives sprint, May 2026).
 * Originally at line 395 of kwikbridge-lms-v2.jsx.
 *
 * Usage:
 *   <Table
 *     columns={[
 *       { label: 'ID', key: 'id' },
 *       { label: 'Customer', render: r => cell.name(r.name) },
 *       { label: 'Amount', render: r => cell.money(r.amount) },
 *     ]}
 *     rows={loans}
 *     onRowClick={r => setDetail({ type: 'loan', id: r.id })}
 *     caption="Active loans table"
 *   />
 *
 * Column object shape:
 *   { label: string, key?: string, render?: (row) => ReactNode }
 *   - If render is provided, it receives the row and returns JSX.
 *   - Otherwise the column reads row[key] directly.
 *
 * Accessibility:
 *   - Caption is visually hidden but read by screen readers.
 *   - Rows with onRowClick are tabIndex=0 and accept Enter/Space.
 *   - aria-rowcount on the table for screen-reader navigation.
 */
import React from 'react';
import { C } from './tokens';
import { T } from './tokens';

interface TableColumn {
  label: string;
  key?: string;
  render?: (row: any) => React.ReactNode;
}

interface TableProps {
  columns: TableColumn[];
  rows: any[];
  onRowClick?: (row: any) => void;
  emptyMsg?: string;
  caption?: string;
}

export function Table({
  columns,
  rows,
  onRowClick,
  emptyMsg = 'No records found',
  caption,
}: TableProps) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        aria-label={caption}
        aria-rowcount={rows.length}
      >
        {caption && (
          <caption
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr style={{ background: C.surface2 }}>
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                style={{
                  padding: '8px 14px',
                  textAlign: 'left',
                  fontWeight: 500,
                  color: C.textMuted,
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: 'nowrap',
                  fontSize: T.fontSize.sm,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                borderBottom: `1px solid ${C.border}`,
              }}
              tabIndex={onRowClick ? 0 : -1}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              onMouseEnter={(e) => {
                if (onRowClick) {
                  e.currentTarget.style.background = C.surface2;
                  e.currentTarget.style.transition = 'background .12s ease-out';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {columns.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '8px 14px',
                    color: C.text,
                    whiteSpace: 'nowrap',
                    fontSize: T.fontSize.base,
                  }}
                >
                  {c.render ? c.render(row) : c.key ? row[c.key] : null}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 12 }}
              >
                {emptyMsg}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
