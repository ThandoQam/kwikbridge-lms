/**
 * ReportsPage — staff reports and analytics view.
 *
 * EXTRACTED FROM MONOLITH (src/kwikbridge-lms-v2.jsx, May 2026).
 * Phase 1 monolith refactor — second extraction after InvestorDashboard.
 *
 * Same transitional pattern: dependencies via props, switch to
 * useData() hook once DataProvider lives at app root.
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';

interface ReportsPageProps {
  loans: any[];
  applications: any[];
  customers: any[];
  collections: any[];
  provisions: any[];
  audit: any[];
  cust: (id: string) => any;
  canDo: (mod: string, action: string) => boolean;
  Btn: any;
  SectionCard: any;
  ProgressBar: any;
  statusBadge: (status: string) => any;
  fmt: any;
  C: any;
}

export function ReportsPage({
  loans,
  applications,
  customers,
  collections,
  provisions,
  audit,
  cust,
  canDo,
  Btn,
  SectionCard,
  ProgressBar,
  statusBadge,
  fmt,
  C,
}: ReportsPageProps) {
  const activeLoans = loans.filter((l) => l.status === 'Active');
  const totalBook = activeLoans.reduce((s, l) => s + l.balance, 0);
  const totalECL = provisions.reduce((s, p) => s + p.ecl, 0);
  const allPmts = loans.flatMap((l) => l.payments.map((p: any) => ({ ...p, loanId: l.id })));
  const delinquent = activeLoans.filter((l) => l.dpd > 0);

  const exportCSV = (title: string, headers: string[], rows: any[][]) => {
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text }}>Reports & Analytics</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Portfolio performance, risk analysis, collections, servicing & impact reporting
          </p>
        </div>
        {canDo('reports', 'export') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              size="sm"
              variant="secondary"
              onClick={() =>
                exportCSV(
                  'Portfolio_Report',
                  ['Loan ID', 'Borrower', 'Amount', 'Balance', 'Rate', 'DPD', 'Stage', 'Status'],
                  loans.map((l) => [l.id, cust(l.custId)?.name, l.amount, l.balance, l.rate, l.dpd, l.stage, l.status])
                )
              }
            >
              Export Portfolio
            </Btn>
            <Btn
              size="sm"
              variant="secondary"
              onClick={() =>
                exportCSV(
                  'Audit_Trail',
                  ['Timestamp', 'Category', 'Action', 'Entity', 'User', 'Detail'],
                  audit.map((a) => [fmt.dateTime(a.ts), a.category, a.action, a.entity, a.user, a.detail])
                )
              }
            >
              Export Audit
            </Btn>
          </div>
        )}
      </div>
      <div className="kb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Portfolio Summary">
          {[
            ['Total Loan Book', fmt.cur(totalBook)],
            ['Active Loans', activeLoans.length],
            ['Booked (Awaiting Disbursement)', loans.filter((l) => l.status === 'Booked').length],
            ['Settled', loans.filter((l) => l.status === 'Settled').length],
            ['Written Off', loans.filter((l) => l.status === 'Written Off').length],
            ['Total Disbursed', fmt.cur(loans.reduce((s, l) => s + l.amount, 0))],
            ['Weighted Avg Rate', `${activeLoans.length ? (activeLoans.reduce((s, l) => s + l.rate, 0) / activeLoans.length).toFixed(1) : 0}%`],
            ['Total ECL', fmt.cur(totalECL)],
            ['ECL Coverage', totalBook > 0 ? fmt.pct(totalECL / totalBook) : '0%'],
          ].map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Concentration by Industry">
          {Object.entries(
            activeLoans.reduce((acc: Record<string, number>, l) => {
              const ind = cust(l.custId)?.industry || 'Unknown';
              acc[ind] = (acc[ind] || 0) + l.balance;
              return acc;
            }, {})
          )
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([ind, bal], i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textDim, marginBottom: 3 }}>
                  <span>{ind}</span>
                  <span>
                    {fmt.cur(bal)} ({totalBook > 0 ? fmt.pct((bal as number) / totalBook, 0) : '0%'})
                  </span>
                </div>
                <ProgressBar value={bal} max={totalBook || 1} color={C.accent} />
              </div>
            ))}
        </SectionCard>
        <SectionCard title="Collections Summary">
          {[
            ['Delinquent Accounts', delinquent.length],
            ['Total Arrears', fmt.cur(delinquent.reduce((s, l) => s + l.balance, 0))],
            ['Early (1-30 DPD)', delinquent.filter((l) => l.dpd <= 30).length],
            ['Mid (31-90 DPD)', delinquent.filter((l) => l.dpd > 30 && l.dpd <= 90).length],
            ['Late (91+ DPD)', delinquent.filter((l) => l.dpd > 90).length],
            ['Collection Actions (Total)', collections.length],
            ['Active PTPs', collections.filter((c) => c.ptpDate && c.ptpDate > Date.now()).length],
            ['Write-Off Proposals', collections.filter((c) => c.writeOff).length],
          ].map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: typeof v === 'number' && v > 0 ? C.red : C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Servicing Summary">
          {[
            ['Payments Processed', allPmts.length],
            ['Total Collected', fmt.cur(allPmts.reduce((s: number, p: any) => s + p.amount, 0))],
            ['Interest Collected', fmt.cur(allPmts.reduce((s: number, p: any) => s + (p.interest || 0), 0))],
            ['Principal Collected', fmt.cur(allPmts.reduce((s: number, p: any) => s + (p.principal || 0), 0))],
            ['Monthly Receivable', fmt.cur(activeLoans.reduce((s, l) => s + l.monthlyPmt, 0))],
            ['Overdue Accounts', delinquent.length],
          ].map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Application Outcomes">
          {['Approved', 'Declined', 'Submitted', 'Underwriting', 'Booked', 'Withdrawn'].map((s) => {
            const count = applications.filter((a) => a.status === s).length;
            if (count === 0) return null;
            return (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                {statusBadge(s)}
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{count}</span>
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
                    ({applications.length > 0 ? fmt.pct(count / applications.length, 0) : '0%'})
                  </span>
                </div>
              </div>
            );
          })}
        </SectionCard>
        <SectionCard title="Development Impact">
          {[
            ['Total Jobs Supported', fmt.num(customers.reduce((s, c) => s + c.employees, 0))],
            ['BEE Level 1 Clients', customers.filter((c) => c.beeLevel === 1).length],
            ['BEE Level 1-2 Exposure', fmt.cur(activeLoans.filter((l) => cust(l.custId)?.beeLevel <= 2).reduce((s, l) => s + l.balance, 0))],
            ['Women-Owned (>50%)', customers.filter((c) => (c.womenOwned || 0) > 50).length],
            ['Youth-Owned (>50%)', customers.filter((c) => (c.youthOwned || 0) > 50).length],
            ['Disability-Owned (>50%)', customers.filter((c) => (c.disabilityOwned || 0) > 50).length],
            [
              'Avg Social Impact Score',
              applications.filter((a) => a.socialScore).length > 0
                ? Math.round(applications.filter((a) => a.socialScore).reduce((s, a) => s + a.socialScore, 0) / applications.filter((a) => a.socialScore).length)
                : '—',
            ],
            ['Provinces Covered', new Set(customers.map((c) => c.province)).size],
            ['Industries Covered', new Set(customers.map((c) => c.industry)).size],
          ].map(([l, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
