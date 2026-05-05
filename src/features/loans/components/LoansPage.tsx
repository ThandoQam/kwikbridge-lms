/**
 * LoansPage — loan book management with portfolio analytics.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Holds tab + view internal state; data via props.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useUI } from '../../../contexts/UIContext';

interface LoansPageProps {
  day: number;
  canDoAny: (mod: string, actions: string[]) => boolean;
  KPI: any;
  Tab: any;
  Table: any;
  Badge: any;
  Btn: any;
  cell: any;
  statusBadge: (s: string) => any;
  fmt: any;
  C: any;
}

export function LoansPage({
  day, canDoAny, KPI, Tab, Table, Badge, Btn, cell, statusBadge, fmt, C,
}: LoansPageProps) {
  // ═══ Context-driven dependencies (Phase 2 migration) ═══
  const { loans, products, settings, cust, prod } = useData();
  const { disburseLoan } = useActions();
  const { setDetail } = useUI();

  const [tab, setTab] = useState('all');
  const [view, setView] = useState('book'); // book | analytics

  const bookedLoans = loans.filter((l) => l.status === 'Booked');
  const activeLoans = loans.filter((l) => l.status === 'Active');
  const shown = tab === 'booked' ? bookedLoans : tab === 'active' ? activeLoans : loans;

  // ── Portfolio Analytics ──
  const openingBook = activeLoans.reduce((s, l) => s + l.amount, 0);
  const currentBook = activeLoans.reduce((s, l) => s + l.balance, 0);
  const newDisb = loans
    .filter((l) => l.disbursedAt && l.disbursedAt > Date.now() - 30 * day)
    .reduce((s, l) => s + l.amount, 0);
  const nplLoans = activeLoans.filter((l) => l.dpd > 90);
  const grossNPL = nplLoans.reduce((s, l) => s + l.balance, 0);
  const recoveryRate = 0.55;
  const recoveries = grossNPL * recoveryRate;
  const closingBook = currentBook - grossNPL + recoveries;
  const totalBorrowers = new Set(activeLoans.map((l) => l.custId)).size;
  const totalInterest = activeLoans.reduce((s, l) => s + (l.balance * (l.rate / 100)) / 12, 0);
  const totalFees = activeLoans.reduce(
    (s, l) => s + ((l.amount * ((l.arrangementFee || 0) / 100)) / Math.max(l.term, 1)),
    0
  );
  const portfolioYield = currentBook > 0 ? ((totalInterest + totalFees) * 12) / currentBook : 0;
  const effectiveNPL = currentBook > 0 ? grossNPL / currentBook : 0;
  const provisionExp = activeLoans.reduce((s, l) => {
    const p = products.find((x) => x.id === l.product);
    return s + l.balance * ((p?.ecl || 2) / 100);
  }, 0);
  const netCreditLoss = grossNPL * (1 - recoveryRate);
  const wacf = 8.5;
  const costOfFunds = (currentBook * (wacf / 100)) / 12;
  const netSpread = portfolioYield - wacf / 100;
  const fundingCap = (settings?.fundingCapacity || currentBook * 1.5) || currentBook * 1.5;
  const headroom = fundingCap - currentBook;
  const facilUtil = fundingCap > 0 ? currentBook / fundingCap : 0;

  const row = (label: string, value: any, indent = false, accent = false, divider = false) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: divider ? `2px solid ${C.text}` : `1px solid ${C.border}`,
        paddingLeft: indent ? 16 : 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: accent ? 700 : indent ? 400 : 600,
          color: accent ? C.text : indent ? C.textDim : C.text,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: accent ? 700 : 600,
          fontFamily: 'monospace',
          color: accent ? C.text : C.text,
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>Loans</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMuted }}>
        Booking, disbursement, portfolio monitoring & covenant tracking
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setView('book')}
          style={{
            background: view === 'book' ? C.accent : 'none',
            color: view === 'book' ? '#fff' : C.textDim,
            border: `1px solid ${view === 'book' ? C.text : C.border}`,
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Loan Book
        </button>
        <button
          onClick={() => setView('analytics')}
          style={{
            background: view === 'analytics' ? C.accent : 'none',
            color: view === 'analytics' ? '#fff' : C.textDim,
            border: `1px solid ${view === 'analytics' ? C.text : C.border}`,
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Portfolio Analytics
        </button>
      </div>

      {view === 'book' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 0,
              marginBottom: 16,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <KPI label="Total Portfolio" value={fmt.cur(currentBook)} />
            <KPI label="Active" value={activeLoans.length} />
            <KPI label="Booked (Awaiting Disbursement)" value={bookedLoans.length} />
            <KPI
              label="Total Monthly PMT"
              value={fmt.cur(activeLoans.reduce((s, l) => s + l.monthlyPmt, 0))}
            />
          </div>
          <Tab
            tabs={[
              { key: 'all', label: 'All', count: loans.length },
              { key: 'booked', label: 'Booked', count: bookedLoans.length },
              { key: 'active', label: 'Active', count: activeLoans.length },
            ]}
            active={tab}
            onChange={setTab}
          />
          <Table
            columns={[
              { label: 'Loan ID', render: (r: any) => cell.id(r.id) },
              { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
              {
                label: 'Product',
                render: (r: any) => {
                  const p = prod(r.product);
                  return <span style={{ fontSize: 11 }}>{p?.name || '—'}</span>;
                },
              },
              { label: 'Amount', render: (r: any) => cell.money(r.amount) },
              { label: 'Balance', render: (r: any) => cell.money(r.balance) },
              { label: 'Rate', render: (r: any) => cell.pct(r.rate) },
              { label: 'Status', render: (r: any) => statusBadge(r.status) },
              {
                label: 'DPD',
                render: (r: any) =>
                  r.status === 'Active' ? (
                    <span
                      style={{
                        fontWeight: 700,
                        color: r.dpd === 0 ? C.green : r.dpd <= 30 ? C.amber : C.red,
                      }}
                    >
                      {r.dpd}
                    </span>
                  ) : (
                    <span style={{ color: C.textMuted }}>—</span>
                  ),
              },
              {
                label: 'Stage',
                render: (r: any) =>
                  r.status === 'Active' ? (
                    <Badge color={r.stage === 1 ? 'green' : r.stage === 2 ? 'amber' : 'red'}>
                      Stage {r.stage}
                    </Badge>
                  ) : (
                    <span style={{ color: C.textMuted }}>—</span>
                  ),
              },
              {
                label: 'Actions',
                render: (r: any) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.status === 'Booked' && canDoAny('loans', ['update']) && (
                      <Btn
                        size="sm"
                        variant="secondary"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          disburseLoan(r.id);
                        }}
                      >
                        Disburse
                      </Btn>
                    )}
                  </div>
                ),
              },
            ]}
            rows={shown}
            onRowClick={(r: any) => setDetail({ type: 'loan', id: r.id })}
          />
        </div>
      )}

      {view === 'analytics' && (
        <div className="kb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>Loan Book Movement</div>
            {row('Opening loan book', fmt.cur(openingBook), false, true, true)}
            {row('New disbursements (30d)', fmt.cur(newDisb), true)}
            {row('Gross NPL amount', fmt.cur(grossNPL), true)}
            {row('Recoveries (55%)', fmt.cur(recoveries), true)}
            {row('Closing loan book', fmt.cur(closingBook), false, true, true)}
            <div style={{ height: 12 }} />
            {row('Total borrowers', totalBorrowers)}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>Yield & Income</div>
            {row('Portfolio yield (annualised)', fmt.pct(portfolioYield), false, true, true)}
            {row('Monthly interest income', fmt.cur(totalInterest), true)}
            {row('Monthly fee income', fmt.cur(totalFees), true)}
            <div style={{ height: 12 }} />
            {row('Effective NPL rate', fmt.pct(effectiveNPL))}
            {row('Provision expense', fmt.cur(provisionExp))}
            {row('Net credit loss', fmt.cur(netCreditLoss))}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>Funding & Spread</div>
            {row('WACF (weighted avg cost of funds)', `${wacf}%`, false, true, true)}
            {row('Cost of funds (monthly)', fmt.cur(costOfFunds), true)}
            <div style={{ height: 12 }} />
            {row('Net interest spread', fmt.pct(netSpread), false, true)}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>Funding Capacity</div>
            {row('Funding headroom', fmt.cur(headroom), false, true, true)}
            {row('Current book', fmt.cur(currentBook), true)}
            {row('Facility capacity', fmt.cur(fundingCap), true)}
            <div style={{ height: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Facility utilisation</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: facilUtil > 0.85 ? C.red : facilUtil > 0.7 ? C.amber : C.green,
                }}
              >
                {fmt.pct(facilUtil)}
              </span>
            </div>
            <div style={{ height: 6, background: C.surface2, borderRadius: 3, marginTop: 4 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: facilUtil > 0.85 ? C.red : facilUtil > 0.7 ? C.amber : C.green,
                  width: `${Math.min(facilUtil * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px', gridColumn: '1/-1' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>Portfolio by Product</div>
            <Table
              columns={[
                { label: 'Product', render: (r: any) => cell.name(r.name) },
                { label: 'Loans', render: (r: any) => r.count },
                { label: 'Book Value', render: (r: any) => cell.money(r.balance) },
                {
                  label: '% of Book',
                  render: (r: any) => (
                    <span style={{ fontFamily: 'monospace' }}>
                      {currentBook > 0 ? fmt.pct(r.balance / currentBook) : '—'}
                    </span>
                  ),
                },
                { label: 'Avg DPD', render: (r: any) => (r.count > 0 ? Math.round(r.dpd / r.count) : 0) },
                {
                  label: 'Risk Class',
                  render: (r: any) => (
                    <Badge
                      color={
                        r.riskClass === 'A' ? 'green' : r.riskClass === 'B' ? 'amber' : r.riskClass === 'C' ? 'red' : 'gray'
                      }
                    >
                      {r.riskClass || '—'}
                    </Badge>
                  ),
                },
                {
                  label: 'ECL Rate',
                  render: (r: any) => (
                    <span style={{ fontFamily: 'monospace' }}>{r.ecl != null ? `${r.ecl}%` : '—'}</span>
                  ),
                },
              ]}
              rows={products
                .filter((p) => p.status === 'Active')
                .map((p) => {
                  const pLoans = activeLoans.filter((l) => l.product === p.id);
                  return {
                    id: p.id,
                    name: p.name,
                    count: pLoans.length,
                    balance: pLoans.reduce((s, l) => s + l.balance, 0),
                    dpd: pLoans.reduce((s, l) => s + l.dpd, 0),
                    riskClass: p.riskClass,
                    ecl: p.ecl,
                  };
                })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
