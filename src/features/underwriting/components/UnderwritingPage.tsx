/**
 * UnderwritingPage — credit assessment queue and decision history.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Dependencies via props during transition; will switch to useData().
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';
import { Btn, C, SectionCard, Table, statusBadge } from '../../../components/ui';
import { cell } from '../../../lib/format';

interface UnderwritingPageProps {
applications: any[];
  cust: (id: string) => any;
  canDo: (mod: string, action: string) => boolean;
  moveToUnderwriting: (appId: string) => void;
  setDetail: (d: any) => void;
}

export function UnderwritingPage({
  applications,
  cust,
  canDo,
  moveToUnderwriting,
  setDetail,
}: UnderwritingPageProps) {
  const pending = applications.filter((a) => ['Submitted', 'Underwriting'].includes(a.status));
  const decided = applications.filter((a) => ['Approved', 'Declined'].includes(a.status)).slice(-5);

  const authorityFor = (amount: number) => {
    if (amount > 1_000_000) return 'Credit Committee';
    if (amount > 500_000) return 'Head of Credit';
    if (amount > 250_000) return 'Senior Analyst';
    return 'Analyst';
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>
        Credit Assessment & Underwriting
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textMuted }}>
        Risk analysis, affordability, scoring & credit decisions
      </p>
      <SectionCard title={`Pending Decisions (${pending.length})`}>
        <Table
          columns={[
            { label: 'App ID', render: (r: any) => cell.id(r.id) },
            { label: 'Applicant', render: (r: any) => cell.name(cust(r.custId)?.name) },
            { label: 'Amount', render: (r: any) => cell.money(r.amount) },
            { label: 'Authority', render: (r: any) => authorityFor(r.amount) },
            { label: 'Status', render: (r: any) => statusBadge(r.status) },
            {
              label: 'Actions',
              render: (r: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  {r.status === 'Submitted' && canDo('underwriting', 'update') && (
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        moveToUnderwriting(r.id);
                      }}
                    >
                      Start DD
                    </Btn>
                  )}
                  {r.status === 'Underwriting' && canDo('underwriting', 'view') && (
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        setDetail({ type: 'application', id: r.id });
                      }}
                    >
                      Open Workflow
                    </Btn>
                  )}
                </div>
              ),
            },
          ]}
          rows={pending}
          onRowClick={(r: any) => setDetail({ type: 'application', id: r.id })}
        />
      </SectionCard>
      <SectionCard title="Recent Decisions">
        <Table
          columns={[
            { label: 'App ID', render: (r: any) => cell.id(r.id) },
            { label: 'Applicant', render: (r: any) => cust(r.custId)?.name },
            { label: 'Amount', render: (r: any) => cell.money(r.amount) },
            {
              label: 'Risk Score',
              render: (r: any) =>
                r.riskScore != null ? (
                  <span style={{ fontWeight: 700, color: r.riskScore >= 70 ? C.green : r.riskScore >= 50 ? C.amber : C.red }}>
                    {r.riskScore}
                  </span>
                ) : (
                  '—'
                ),
            },
            { label: 'DSCR', render: (r: any) => r.dscr || '—' },
            { label: 'Decision', render: (r: any) => statusBadge(r.status) },
            { label: 'Approver', key: 'approver' },
          ]}
          rows={decided}
          onRowClick={(r: any) => setDetail({ type: 'application', id: r.id })}
        />
      </SectionCard>
    </div>
  );
}
