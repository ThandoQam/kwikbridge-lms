/**
 * ServicingPage — payment processing, schedules, overdue management.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Internal state: tab + selected schedule loan.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';

interface ServicingPageProps {
  loans: any[];
  day: number;
  cust: (id: string) => any;
  canDo: (mod: string, action: string) => boolean;
  setDetail: (d: any) => void;
  recordPayment: (loanId: string, amount: number) => void;
  KPI: any;
  Tab: any;
  Table: any;
  Field: any;
  Select: any;
  Btn: any;
  cell: any;
  statusBadge: (s: string) => any;
  fmt: any;
  C: any;
}

export function ServicingPage({
  loans,
  day,
  cust,
  canDo,
  setDetail,
  recordPayment,
  KPI,
  Tab,
  Table,
  Field,
  Select,
  Btn,
  cell,
  statusBadge,
  fmt,
  C,
}: ServicingPageProps) {
  const [tab, setTab] = useState('upcoming');
  const [schedLoan, setSchedLoan] = useState<string | null>(null);

  const activeLoans = loans.filter((l) => l.status === 'Active');
  const overdue = activeLoans.filter((l) => l.dpd > 0);
  const allPmts = loans
    .flatMap((l) => l.payments.map((p: any) => ({ ...p, loanId: l.id })))
    .sort((a: any, b: any) => b.date - a.date);
  const totalCollected = allPmts.reduce((s: number, p: any) => s + p.amount, 0);
  const totalInterest = allPmts.reduce((s: number, p: any) => s + (p.interest || 0), 0);
  const totalPrincipal = allPmts.reduce((s: number, p: any) => s + (p.principal || 0), 0);

  const genSchedule = (l: any) => {
    const rows = [];
    let bal = l.amount;
    const r = l.rate / 100 / 12;
    for (let m = 1; m <= l.term; m++) {
      const interest = Math.round(bal * r);
      const principal = Math.max(0, l.monthlyPmt - interest);
      bal = Math.max(0, bal - principal);
      const paid = l.payments[m - 1];
      rows.push({
        month: m,
        pmt: l.monthlyPmt,
        interest,
        principal,
        balance: bal,
        status: paid ? 'Paid' : m <= l.payments.length ? 'Paid' : bal <= 0 ? '—' : 'Pending',
      });
    }
    return rows;
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>Loan Servicing</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMuted }}>
        Payment processing, amortization schedules, statements & account management
      </p>

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
        <KPI label="Active Loans" value={activeLoans.length} />
        <KPI label="Total Collected" value={fmt.cur(totalCollected)} />
        <KPI label="Interest Collected" value={fmt.cur(totalInterest)} />
        <KPI label="Principal Collected" value={fmt.cur(totalPrincipal)} />
        <KPI
          label="Overdue"
          value={overdue.length}
          sub={fmt.cur(overdue.reduce((s, l) => s + l.monthlyPmt, 0))}
        />
        <KPI
          label="Monthly Receivable"
          value={fmt.cur(activeLoans.reduce((s, l) => s + l.monthlyPmt, 0))}
        />
      </div>

      <Tab
        tabs={[
          { key: 'upcoming', label: 'Upcoming Payments', count: activeLoans.length },
          { key: 'recent', label: 'Payment History', count: allPmts.length },
          { key: 'schedule', label: 'Amortization Schedules' },
          { key: 'overdue', label: 'Overdue', count: overdue.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'upcoming' && (
        <Table
          columns={[
            {
              label: 'Due Date',
              render: (r: any) => {
                const d = Math.ceil((r.nextDue - Date.now()) / day);
                return (
                  <span
                    style={{
                      fontWeight: d < 0 ? 700 : 400,
                      color: d < 0 ? C.red : d <= 7 ? C.amber : C.textDim,
                    }}
                  >
                    {fmt.date(r.nextDue)}
                    {d < 0 ? ` (${Math.abs(d)}d overdue)` : ''}
                  </span>
                );
              },
            },
            { label: 'Loan', render: (r: any) => cell.id(r.id) },
            { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
            { label: 'Instalment', render: (r: any) => fmt.cur(r.monthlyPmt) },
            { label: 'Balance', render: (r: any) => cell.money(r.balance) },
            {
              label: 'DPD',
              render: (r: any) => (
                <span style={{ fontWeight: 700, color: r.dpd === 0 ? C.green : C.amber }}>{r.dpd}</span>
              ),
            },
            {
              label: 'Action',
              render: (r: any) =>
                canDo('servicing', 'create') ? (
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={(e: any) => {
                      e.stopPropagation();
                      recordPayment(r.id, r.monthlyPmt);
                    }}
                  >
                    Record Payment
                  </Btn>
                ) : (
                  <span style={{ fontSize: 10, color: C.textMuted }}>View only</span>
                ),
            },
          ]}
          rows={[...activeLoans].sort((a: any, b: any) => a.nextDue - b.nextDue)}
          onRowClick={(r: any) => setDetail({ type: 'loan', id: r.id })}
        />
      )}

      {tab === 'recent' && (
        <Table
          columns={[
            { label: 'Date', render: (r: any) => fmt.date(r.date) },
            { label: 'Loan', key: 'loanId' },
            { label: 'Borrower', render: (r: any) => cust(loans.find((l) => l.id === r.loanId)?.custId)?.name },
            { label: 'Total', render: (r: any) => cell.money(r.amount) },
            { label: 'Interest', render: (r: any) => cell.money(r.interest || 0) },
            { label: 'Principal', render: (r: any) => cell.money(r.principal || 0) },
            { label: 'Type', key: 'type' },
            { label: 'Status', render: (r: any) => statusBadge(r.status) },
          ]}
          rows={allPmts.slice(0, 20)}
        />
      )}

      {tab === 'schedule' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Field label="Select Loan">
              <Select
                value={schedLoan || ''}
                onChange={(e: any) => setSchedLoan(e.target.value)}
                options={[
                  { value: '', label: '— Select —' },
                  ...activeLoans.map((l) => ({
                    value: l.id,
                    label: `${l.id} – ${cust(l.custId)?.name} – ${fmt.cur(l.amount)} @ ${l.rate}%`,
                  })),
                ]}
              />
            </Field>
          </div>
          {schedLoan &&
            (() => {
              const l = loans.find((x) => x.id === schedLoan);
              if (!l) return null;
              const sched = genSchedule(l);
              return (
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
                    {cust(l.custId)?.name} · {fmt.cur(l.amount)} @ {l.rate}% over {l.term}m · Monthly:{' '}
                    {fmt.cur(l.monthlyPmt)} · Total interest:{' '}
                    {fmt.cur(sched.reduce((s, r) => s + r.interest, 0))} · Total cost:{' '}
                    {fmt.cur(sched.reduce((s, r) => s + r.pmt, 0))}
                  </div>
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table
                      columns={[
                        { label: '#', render: (r: any) => r.month },
                        { label: 'Payment', render: (r: any) => fmt.cur(r.pmt) },
                        { label: 'Interest', render: (r: any) => cell.money(r.interest) },
                        { label: 'Principal', render: (r: any) => cell.money(r.principal) },
                        { label: 'Balance', render: (r: any) => cell.money(r.balance) },
                        { label: 'Status', render: (r: any) => statusBadge(r.status) },
                      ]}
                      rows={sched}
                    />
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {tab === 'overdue' && (
        <Table
          columns={[
            { label: 'Loan', render: (r: any) => cell.id(r.id) },
            { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
            { label: 'Balance', render: (r: any) => cell.money(r.balance) },
            { label: 'Instalment', render: (r: any) => fmt.cur(r.monthlyPmt) },
            {
              label: 'DPD',
              render: (r: any) => (
                <span style={{ fontSize: 18, fontWeight: 700, color: r.dpd <= 30 ? C.amber : C.red }}>
                  {r.dpd}
                </span>
              ),
            },
            {
              label: 'Last Payment',
              render: (r: any) =>
                r.lastPmt ? fmt.date(r.lastPmt) : <span style={{ color: C.textMuted }}>None</span>,
            },
            {
              label: 'Action',
              render: (r: any) =>
                canDo('servicing', 'create') ? (
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={(e: any) => {
                      e.stopPropagation();
                      recordPayment(r.id, r.monthlyPmt);
                    }}
                  >
                    Record Payment
                  </Btn>
                ) : (
                  <span style={{ fontSize: 10, color: C.textMuted }}>View only</span>
                ),
            },
          ]}
          rows={overdue.sort((a: any, b: any) => b.dpd - a.dpd)}
          onRowClick={(r: any) => setDetail({ type: 'loan', id: r.id })}
        />
      )}
    </div>
  );
}
