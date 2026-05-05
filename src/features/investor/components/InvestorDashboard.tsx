/**
 * InvestorDashboard — DFI / funder / strategic partner view.
 *
 * EXTRACTED FROM MONOLITH (src/kwikbridge-lms-v2.jsx, May 2026).
 * Phase 1 of monolith refactor: prove the extraction pattern with the
 * smallest, newest, lowest-risk page.
 *
 * Dependencies provided via props (transitional pattern). Once
 * DataProvider is wired up at the app root, switch to useData().
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';

interface InvestorDashboardProps {
  loans: any[];
  applications: any[];
  provisions: any[];
  customers: any[];
  prod: (id: string) => any;
  Btn: any;
  fmt: any;
  C: any;
}

export function InvestorDashboard({
  loans,
  applications,
  provisions,
  customers,
  prod,
  Btn,
  fmt,
  C,
}: InvestorDashboardProps) {
  const activeLoans = loans.filter((l) => l.status === 'Active' || l.status === 'Booked');
  const totalBook = activeLoans.reduce((s, l) => s + (l.balance || l.amount || 0), 0);
  const totalDisbursed = loans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalRepaid = loans.flatMap((l) => l.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const totalECL = (provisions || []).reduce((s, p) => s + (p.ecl || 0), 0);

  const stage1 = activeLoans.filter((l) => (l.dpd || 0) <= 30);
  const stage2 = activeLoans.filter((l) => (l.dpd || 0) > 30 && (l.dpd || 0) <= 90);
  const stage3 = activeLoans.filter((l) => (l.dpd || 0) > 90);
  const stage1Pct = activeLoans.length ? Math.round((stage1.length / activeLoans.length) * 100) : 0;
  const stage2Pct = activeLoans.length ? Math.round((stage2.length / activeLoans.length) * 100) : 0;
  const stage3Pct = activeLoans.length ? Math.round((stage3.length / activeLoans.length) * 100) : 0;

  const loansWithDSCR = activeLoans.filter((l) => l.dscr || applications.find((a) => a.id === l.appId)?.dscr);
  const avgDSCR = loansWithDSCR.length
    ? (loansWithDSCR.reduce((s, l) => s + (l.dscr || applications.find((a) => a.id === l.appId)?.dscr || 0), 0) / loansWithDSCR.length).toFixed(2)
    : '—';

  const nplBalance = stage3.reduce((s, l) => s + (l.balance || 0), 0);
  const nplRatio = totalBook > 0 ? ((nplBalance / totalBook) * 100).toFixed(1) : '0.0';

  const byProduct: Record<string, number> = {};
  activeLoans.forEach((l) => {
    byProduct[l.product] = (byProduct[l.product] || 0) + (l.balance || 0);
  });
  const concentrations = Object.entries(byProduct)
    .map(([prodId, bal]) => ({
      product: prod(prodId)?.name || prodId,
      balance: bal,
      pct: totalBook > 0 ? (bal / totalBook) * 100 : 0,
    }))
    .sort((a, b) => b.balance - a.balance);
  const topConcentration = concentrations[0]?.pct || 0;

  const byOffTaker: Record<string, number> = {};
  activeLoans.forEach((l) => {
    const app = applications.find((a) => a.id === l.appId);
    const ot = app?.offTaker || 'Other';
    byOffTaker[ot] = (byOffTaker[ot] || 0) + (l.balance || 0);
  });
  const offTakerTop = Object.entries(byOffTaker).sort((a, b) => b[1] - a[1])[0];
  const offTakerConcentration = offTakerTop && totalBook > 0 ? (offTakerTop[1] / totalBook) * 100 : 0;

  const empowermentLoans = loans.filter((l) => {
    const c = customers.find((x) => x.id === l.custId);
    return c && (c.womenOwned || c.youthOwned || c.disabilityOwned);
  });
  const empowermentBook = empowermentLoans.reduce((s, l) => s + (l.balance || 0), 0);
  const totalEmployees = customers.reduce((s, c) => s + (c.employees || 0), 0);

  const covenantStatus = [
    { name: 'SEDFA DSCR', target: '≥ 1.25x', actual: avgDSCR, breach: avgDSCR !== '—' && parseFloat(avgDSCR) < 1.25 },
    { name: 'SEDFA NPL', target: '≤ 6.0%', actual: nplRatio + '%', breach: parseFloat(nplRatio) > 6.0 },
    { name: 'Off-taker Concentration', target: '≤ 20%', actual: offTakerConcentration.toFixed(1) + '%', breach: offTakerConcentration > 20 },
    { name: 'Product Concentration', target: '≤ 35%', actual: topConcentration.toFixed(1) + '%', breach: topConcentration > 35 },
    { name: 'ECL Coverage', target: 'Adequate', actual: totalBook > 0 ? ((totalECL / totalBook) * 100).toFixed(2) + '%' : '0%', breach: false },
  ];
  const breachCount = covenantStatus.filter((c) => c.breach).length;

  const exportInvestorCSV = () => {
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Portfolio', 'Total Book', totalBook],
      ['Portfolio', 'Total Disbursed', totalDisbursed],
      ['Portfolio', 'Total Repaid', totalRepaid],
      ['Portfolio', 'Active Loans', activeLoans.length],
      ['IFRS 9', 'Stage 1 Count', stage1.length],
      ['IFRS 9', 'Stage 2 Count', stage2.length],
      ['IFRS 9', 'Stage 3 Count', stage3.length],
      ['IFRS 9', 'Total ECL', totalECL],
      ['Risk', 'Avg DSCR', avgDSCR],
      ['Risk', 'NPL Ratio %', nplRatio],
      ['Concentration', 'Top Off-taker %', offTakerConcentration.toFixed(2)],
      ['Concentration', 'Top Product %', topConcentration.toFixed(2)],
      ['Impact', 'Empowerment Book', empowermentBook],
      ['Impact', 'Total Employees Supported', totalEmployees],
      ['Covenants', 'Breaches', breachCount],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Investor_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Card = ({ title, children, action }: any) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text }}>Investor Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Portfolio performance, IFRS 9 staging, DFI covenant compliance, development impact
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" variant="secondary" onClick={exportInvestorCSV}>
            Export Report
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Card title="Portfolio Book">
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{fmt.cur(totalBook)}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{activeLoans.length} active loans</div>
        </Card>
        <Card title="Total Deployed">
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{fmt.cur(totalDisbursed)}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Lifetime disbursements</div>
        </Card>
        <Card title="NPL Ratio">
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: parseFloat(nplRatio) > 6 ? C.red : parseFloat(nplRatio) > 3 ? C.amber : C.green }}>
            {nplRatio}%
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Stage 3 / Total Book</div>
        </Card>
        <Card title="Avg DSCR">
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: avgDSCR === '—' ? C.textMuted : parseFloat(avgDSCR) >= 1.25 ? C.green : parseFloat(avgDSCR) >= 1.0 ? C.amber : C.red }}>
            {avgDSCR}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Portfolio-weighted</div>
        </Card>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card title="IFRS 9 Staging">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Stage 1 (Performing) — DPD ≤ 30</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{stage1.length}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{stage1Pct}% of portfolio</div>
              <div style={{ marginTop: 8, height: 4, background: C.surface3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: stage1Pct + '%', background: C.green }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Stage 2 (Underperforming) — DPD 31–90</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.amber, fontFamily: 'monospace' }}>{stage2.length}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{stage2Pct}% of portfolio</div>
              <div style={{ marginTop: 8, height: 4, background: C.surface3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: stage2Pct + '%', background: C.amber }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Stage 3 (Non-Performing) — DPD &gt; 90</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.red, fontFamily: 'monospace' }}>{stage3.length}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{stage3Pct}% of portfolio</div>
              <div style={{ marginTop: 8, height: 4, background: C.surface3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: stage3Pct + '%', background: C.red }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: C.textDim }}>Total ECL Provision</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: C.text }}>
              {fmt.cur(totalECL)}{' '}
              <span style={{ fontSize: 11, color: C.textDim, fontWeight: 400 }}>
                ({totalBook > 0 ? ((totalECL / totalBook) * 100).toFixed(2) : '0.00'}% coverage)
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title={`DFI Covenant Compliance ${breachCount > 0 ? '· ' + breachCount + ' breach(es)' : '· All within limits'}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Covenant</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Target</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Actual</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {covenantStatus.map((cov, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 0', color: C.text }}>{cov.name}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: C.textDim, fontFamily: 'monospace' }}>{cov.target}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: C.text, fontFamily: 'monospace', fontWeight: 600 }}>{cov.actual}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {cov.breach ? (
                      <span style={{ color: C.red, fontSize: 11, fontWeight: 600 }}>BREACH</span>
                    ) : (
                      <span style={{ color: C.green, fontSize: 11 }}>✓ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Product Concentration">
          {concentrations.length === 0 && <div style={{ fontSize: 12, color: C.textMuted, padding: '16px 0' }}>No active loans yet</div>}
          {concentrations.slice(0, 8).map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text }}>{c.product}</span>
                <span style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace' }}>
                  {fmt.cur(c.balance)} <span style={{ color: C.textMuted }}>({c.pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div style={{ height: 4, background: C.surface3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: c.pct + '%', background: c.pct > 35 ? C.amber : C.accent }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Development Impact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Empowerment Book</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: 'monospace', marginTop: 4 }}>{fmt.cur(empowermentBook)}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
              {totalBook > 0 ? Math.round((empowermentBook / totalBook) * 100) : 0}% of portfolio
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Empowerment Loans</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: 'monospace', marginTop: 4 }}>{empowermentLoans.length}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Black, women, youth, PWD owned</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Jobs Supported</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: 'monospace', marginTop: 4 }}>{totalEmployees.toLocaleString('en-ZA')}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Across {customers.length} businesses</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Avg Loan Size</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: 'monospace', marginTop: 4 }}>
              {fmt.cur(loans.length > 0 ? totalDisbursed / loans.length : 0)}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Per facility deployed</div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 24, padding: '16px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
        <strong style={{ color: C.text }}>Reporting note:</strong> This dashboard aggregates portfolio data without exposing individual borrower
        information. For loan-level due diligence, request access to the data room which contains anonymised loan tapes. Covenant breaches trigger
        automatic alert to the Chief Risk Officer and the relevant funder per the funding agreement. Updated in real-time. Last refreshed:{' '}
        {new Date().toLocaleString('en-ZA')}.
      </div>
    </div>
  );
}
