/**
 * CommsPage — Communication Center, omnichannel log.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';

interface CommsPageProps {
  comms: any[];
  cust: (id: string) => any;
  Table: any;
  Badge: any;
  cell: any;
  fmt: any;
  C: any;
}

export function CommsPage({ comms, cust, Table, Badge, cell, fmt, C }: CommsPageProps) {
  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>
        Communication Center
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textMuted }}>
        Omnichannel communication log — Phone, Email, SMS, Letters, Meetings
      </p>
      <Table
        columns={[
          { label: 'Date', render: (r: any) => fmt.dateTime(r.ts) },
          { label: 'Customer', render: (r: any) => cust(r.custId)?.name },
          {
            label: 'Channel',
            render: (r: any) => (
              <Badge
                color={
                  r.channel === 'Phone'
                    ? 'blue'
                    : r.channel === 'Email'
                    ? 'cyan'
                    : r.channel === 'Letter'
                    ? 'amber'
                    : r.channel === 'In-Person'
                    ? 'green'
                    : 'slate'
                }
              >
                {r.channel || '—'}
              </Badge>
            ),
          },
          {
            label: 'Direction',
            render: (r: any) => (
              <Badge color={r.direction === 'Inbound' ? 'purple' : 'slate'}>{r.direction}</Badge>
            ),
          },
          { label: 'Subject', render: (r: any) => cell.name(r.subject) },
          { label: 'From/By', key: 'from' },
          {
            label: 'Summary',
            render: (r: any) => (
              <span
                style={{
                  fontSize: 11,
                  color: C.textDim,
                  maxWidth: 250,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.body}
              </span>
            ),
          },
        ]}
        rows={[...comms].sort((a: any, b: any) => b.ts - a.ts)}
      />
    </div>
  );
}
