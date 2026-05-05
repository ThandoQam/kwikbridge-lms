/**
 * ProvisioningPage — IFRS 9 Impairment & ECL view.
 *
 * EXTRACTED FROM MONOLITH (May 2026, Phase 1 monolith refactor).
 * Third extraction after InvestorDashboard and ReportsPage.
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';
import { useData } from '../../../contexts/DataContext';

interface ProvisioningPageProps {
  KPI: any;
  SectionCard: any;
  Table: any;
  Badge: any;
  cell: any;
  fmt: any;
  C: any;
}

export function ProvisioningPage({
  KPI, SectionCard, Table, Badge, cell, fmt, C,
}: ProvisioningPageProps) {
  // ═══ Context-driven dependencies (Phase 2 migration) ═══
  const { loans, provisions, cust } = useData();

  const totalECL = provisions.reduce((s, p) => s + p.ecl, 0);
  const totalEAD = provisions.reduce((s, p) => s + p.ead, 0);

  const stageColors: Record<number, string> = { 1: C.green, 2: C.amber, 3: C.red };
  const stageLabels: Record<number, string> = {
    1: 'Performing (12-month ECL)',
    2: 'Underperforming (Lifetime ECL)',
    3: 'Credit-impaired (Lifetime ECL)',
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>
        IFRS 9 Impairment & Provisioning
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textMuted }}>
        Expected Credit Loss calculation, staging & forward-looking ECL models
      </p>
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <KPI label="Total ECL Provision" value={fmt.cur(totalECL)} accent={C.purple} />
        <KPI label="Total EAD" value={fmt.cur(totalEAD)} accent={C.blue} />
        <KPI label="Coverage Ratio" value={fmt.pct(totalECL / totalEAD)} accent={C.amber} />
        <KPI
          label="Stage 2+3 Exposure"
          value={fmt.cur(provisions.filter((p) => p.stage >= 2).reduce((s, p) => s + p.ead, 0))}
          accent={C.red}
        />
      </div>
      <SectionCard title="ECL by Loan">
        <Table
          columns={[
            { label: 'Loan ID', render: (r: any) => cell.id(r.loanId) },
            { label: 'Borrower', render: (r: any) => cust(loans.find((l) => l.id === r.loanId)?.custId)?.name },
            {
              label: 'Stage',
              render: (r: any) => (
                <Badge color={r.stage === 1 ? 'green' : r.stage === 2 ? 'amber' : 'red'}>Stage {r.stage}</Badge>
              ),
            },
            { label: 'EAD', render: (r: any) => fmt.cur(r.ead) },
            { label: 'PD', render: (r: any) => fmt.pct(r.pd) },
            { label: 'LGD', render: (r: any) => fmt.pct(r.lgd, 0) },
            { label: 'ECL', render: (r: any) => cell.money(r.ecl) },
            { label: 'Method', render: (r: any) => cell.dim(r.method) },
          ]}
          rows={provisions}
        />
        <div style={{ textAlign: 'right', marginTop: 14, fontSize: 14, fontWeight: 700, color: C.text }}>
          Total ECL: <span style={{ color: C.purple }}>{fmt.cur(totalECL)}</span>
        </div>
      </SectionCard>
      <SectionCard title="IFRS 9 Stage Distribution">
        {[1, 2, 3].map((s) => {
          const sp = provisions.filter((p) => p.stage === s);
          const ead = sp.reduce((sum, p) => sum + p.ead, 0);
          const ecl = sp.reduce((sum, p) => sum + p.ecl, 0);
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div>
                <Badge color={s === 1 ? 'green' : s === 2 ? 'amber' : 'red'}>Stage {s}</Badge>
                <span style={{ fontSize: 12, color: C.textDim, marginLeft: 10 }}>{stageLabels[s]}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>EAD: {fmt.cur(ead)}</div>
                <div style={{ fontSize: 12, color: stageColors[s] }}>ECL: {fmt.cur(ecl)}</div>
              </div>
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
}
