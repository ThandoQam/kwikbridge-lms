/**
 * CollectionsPage — delinquency management with PTP, restructure,
 * write-off workflows.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Internal state: tab, action modal, ptp/restructure/writeoff forms.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useActions } from '../../../contexts/ActionsContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface CollectionsPageProps {
  KPI: any;
  Tab: any;
  Table: any;
  Badge: any;
  Btn: any;
  Modal: any;
  Field: any;
  Input: any;
  Textarea: any;
  Select: any;
  cell: any;
  statusBadge: (s: string) => any;
  fmt: any;
  C: any;
}

export function CollectionsPage({
  KPI, Tab, Table, Badge, Btn, Modal, Field, Input, Textarea, Select, cell, statusBadge, fmt, C,
}: CollectionsPageProps) {
  // ═══ Context-driven dependencies (Phase 2 migration) ═══
  const { loans, collections, cust } = useData();
  const { addCollectionAction, createPTP, proposeRestructure, proposeWriteOff, approveWriteOff } = useActions();
  const { setDetail } = useUI();
  const { canDo } = useAuth();

  const [tab, setTab] = useState('accounts');
  const [actionModal, setActionModal] = useState<any>(null);
  const [ptpForm, setPtpForm] = useState({ date: '', amount: '', notes: '' });
  const [restructForm, setRestructForm] = useState({
    type: 'Term Extension',
    detail: '',
    approver: 'Credit Committee',
  });
  const [writeOffReason, setWriteOffReason] = useState('');

  const activeLoans = loans.filter((l) => l.status === 'Active');
  const delinquent = activeLoans.filter((l) => l.dpd > 0);
  const ptps = collections.filter((c) => c.ptpDate);
  const pendingWriteOffs = collections.filter((c) => c.writeOff);
  const early = delinquent.filter((l) => l.dpd <= 30);
  const mid = delinquent.filter((l) => l.dpd > 30 && l.dpd <= 90);
  const late = delinquent.filter((l) => l.dpd > 90);

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text }}>
        Collections & Recovery
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.textMuted }}>
        NCA-compliant delinquency management, PTP tracking, restructuring & legal recovery
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
        <KPI label="Early (1-30)" value={early.length} sub={fmt.cur(early.reduce((s, l) => s + l.balance, 0))} />
        <KPI label="Mid (31-90)" value={mid.length} sub={fmt.cur(mid.reduce((s, l) => s + l.balance, 0))} />
        <KPI label="Late (91+)" value={late.length} sub={fmt.cur(late.reduce((s, l) => s + l.balance, 0))} />
        <KPI label="Total Arrears" value={fmt.cur(delinquent.reduce((s, l) => s + l.balance, 0))} />
        <KPI label="Active PTPs" value={ptps.filter((p) => p.ptpDate > Date.now()).length} />
        <KPI label="Write-Off Proposals" value={pendingWriteOffs.length} />
      </div>

      <Tab
        tabs={[
          { key: 'accounts', label: 'Delinquent Accounts', count: delinquent.length },
          { key: 'activity', label: 'Activity Log', count: collections.length },
          { key: 'ptp', label: 'Promise-to-Pay', count: ptps.length },
          { key: 'writeoff', label: 'Write-Offs', count: pendingWriteOffs.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'accounts' && (
        <Table
          columns={[
            { label: 'Loan', render: (r: any) => cell.id(r.id) },
            { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
            { label: 'Balance', render: (r: any) => cell.money(r.balance) },
            {
              label: 'DPD',
              render: (r: any) => (
                <span style={{ fontSize: 18, fontWeight: 700, color: r.dpd <= 30 ? C.amber : C.red }}>
                  {r.dpd}
                </span>
              ),
            },
            {
              label: 'Stage',
              render: (r: any) => (
                <Badge color={r.dpd <= 30 ? 'amber' : r.dpd <= 90 ? 'red' : 'red'}>
                  {r.dpd <= 30 ? 'Early' : r.dpd <= 90 ? 'Mid' : 'Late'}
                </Badge>
              ),
            },
            {
              label: 'Last Action',
              render: (r: any) => {
                const last = collections
                  .filter((c) => c.loanId === r.id)
                  .sort((a, b) => b.created - a.created)[0];
                return last ? (
                  <span style={{ fontSize: 10, color: C.textDim }}>
                    {last.action} ({fmt.date(last.created)})
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: C.textMuted }}>None</span>
                );
              },
            },
            {
              label: 'Actions',
              render: (r: any) =>
                canDo('collections', 'create') ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        addCollectionAction(r.id, 'Phone Call', 'Outbound call.', { channel: 'Phone' });
                      }}
                    >
                      Call
                    </Btn>
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        setActionModal({ loanId: r.id, type: 'ptp' });
                      }}
                    >
                      PTP
                    </Btn>
                    {r.dpd > 30 && (
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          addCollectionAction(r.id, 'Letter of Demand', 'Formal NCA demand issued.', {
                            channel: 'Letter',
                          });
                        }}
                      >
                        Demand
                      </Btn>
                    )}
                    {r.dpd > 30 && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setActionModal({ loanId: r.id, type: 'restructure' });
                        }}
                      >
                        Restructure
                      </Btn>
                    )}
                    {r.dpd > 90 && (
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          addCollectionAction(r.id, 'Legal Handover', 'Referred to Legal Department for recovery.', {
                            channel: 'Legal',
                          });
                        }}
                      >
                        Legal
                      </Btn>
                    )}
                    {r.dpd > 90 && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setActionModal({ loanId: r.id, type: 'writeoff' });
                        }}
                      >
                        Write-Off
                      </Btn>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 10, color: C.textMuted }}>View only</span>
                ),
            },
          ]}
          rows={delinquent.sort((a, b) => b.dpd - a.dpd)}
          onRowClick={(r: any) => setDetail({ type: 'loan', id: r.id })}
        />
      )}

      {tab === 'activity' && (
        <Table
          columns={[
            { label: 'Date', render: (r: any) => fmt.date(r.created) },
            { label: 'Loan', key: 'loanId' },
            { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
            { label: 'Stage', render: (r: any) => statusBadge(r.stage) },
            { label: 'Action', render: (r: any) => cell.name(r.action) },
            { label: 'Channel', key: 'channel' },
            { label: 'Officer', key: 'officer' },
            {
              label: 'Notes',
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
                  {r.notes}
                </span>
              ),
            },
          ]}
          rows={[...collections].sort((a, b) => b.created - a.created)}
        />
      )}

      {tab === 'ptp' && (
        <div>
          <Table
            columns={[
              { label: 'Loan', key: 'loanId' },
              { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
              { label: 'PTP Date', render: (r: any) => fmt.date(r.ptpDate) },
              { label: 'PTP Amount', render: (r: any) => fmt.cur(r.ptpAmount) },
              {
                label: 'Status',
                render: (r: any) => {
                  if (!r.ptpDate) return <span style={{ color: C.textMuted }}>—</span>;
                  const met = loans
                    .find((l) => l.id === r.loanId)
                    ?.payments?.some((p: any) => p.date >= r.created && p.amount >= r.ptpAmount);
                  return met ? (
                    <Badge color="green">Honoured</Badge>
                  ) : r.ptpDate > Date.now() ? (
                    <Badge color="amber">Pending</Badge>
                  ) : (
                    <Badge color="red">Broken</Badge>
                  );
                },
              },
              { label: 'Officer', key: 'officer' },
              { label: 'Created', render: (r: any) => fmt.date(r.created) },
            ]}
            rows={ptps.sort((a, b) => b.created - a.created)}
          />
        </div>
      )}

      {tab === 'writeoff' && (
        <div>
          <Table
            columns={[
              { label: 'Loan', key: 'loanId' },
              { label: 'Borrower', render: (r: any) => cust(r.custId)?.name },
              { label: 'Balance', render: (r: any) => fmt.cur(loans.find((l) => l.id === r.loanId)?.balance || 0) },
              { label: 'DPD', render: (r: any) => cell.count(r.dpd) },
              { label: 'Reason', render: (r: any) => cell.dim(r.notes) },
              { label: 'Proposed By', key: 'officer' },
              { label: 'Date', render: (r: any) => fmt.date(r.created) },
              {
                label: 'Action',
                render: (r: any) => {
                  const l = loans.find((x) => x.id === r.loanId);
                  if (l?.status === 'Written Off') return <Badge color="red">Written Off</Badge>;
                  return canDo('collections', 'approve') ? (
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        approveWriteOff(r.loanId);
                      }}
                    >
                      Approve Write-Off
                    </Btn>
                  ) : (
                    <Badge color="amber">Pending Approval</Badge>
                  );
                },
              },
            ]}
            rows={pendingWriteOffs.sort((a, b) => b.created - a.created)}
          />
        </div>
      )}

      {/* PTP Modal */}
      <Modal
        open={actionModal?.type === 'ptp'}
        onClose={() => setActionModal(null)}
        title={`Promise-to-Pay — ${actionModal?.loanId}`}
        width={440}
      >
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
          Record a payment commitment from the customer.
        </div>
        <div className="kb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="PTP Date">
            <Input
              type="date"
              value={ptpForm.date}
              onChange={(e: any) => setPtpForm({ ...ptpForm, date: e.target.value })}
            />
          </Field>
          <Field label="PTP Amount (R)">
            <Input
              type="number"
              value={ptpForm.amount}
              onChange={(e: any) => setPtpForm({ ...ptpForm, amount: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={ptpForm.notes}
            onChange={(e: any) => setPtpForm({ ...ptpForm, notes: e.target.value })}
            rows={2}
            placeholder="Context from call..."
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn
            onClick={() => {
              if (ptpForm.date && ptpForm.amount) {
                createPTP(actionModal.loanId, ptpForm.date, ptpForm.amount, ptpForm.notes);
                setActionModal(null);
                setPtpForm({ date: '', amount: '', notes: '' });
              }
            }}
            disabled={!ptpForm.date || !ptpForm.amount}
          >
            Record PTP
          </Btn>
          <Btn variant="ghost" onClick={() => setActionModal(null)}>
            Cancel
          </Btn>
        </div>
      </Modal>

      {/* Restructure Modal */}
      <Modal
        open={actionModal?.type === 'restructure'}
        onClose={() => setActionModal(null)}
        title={`Restructuring Proposal — ${actionModal?.loanId}`}
        width={480}
      >
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
          Propose a restructuring plan. Requires Credit Committee or Head of Credit approval.
        </div>
        <Field label="Restructure Type">
          <Select
            value={restructForm.type}
            onChange={(e: any) => setRestructForm({ ...restructForm, type: e.target.value })}
            options={['Term Extension', 'Payment Holiday', 'Rate Reduction', 'Reduced Instalments', 'Combined'].map(
              (v) => ({ value: v, label: v })
            )}
          />
        </Field>
        <Field label="Proposal Detail">
          <Textarea
            value={restructForm.detail}
            onChange={(e: any) => setRestructForm({ ...restructForm, detail: e.target.value })}
            rows={3}
            placeholder="e.g. Extend term by 6 months with 3-month reduced payment plan..."
          />
        </Field>
        <Field label="Approval Required From">
          <Select
            value={restructForm.approver}
            onChange={(e: any) => setRestructForm({ ...restructForm, approver: e.target.value })}
            options={['Collections Manager', 'Head of Credit', 'Credit Committee'].map((v) => ({
              value: v,
              label: v,
            }))}
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn
            onClick={() => {
              if (restructForm.detail) {
                proposeRestructure(actionModal.loanId, restructForm);
                setActionModal(null);
                setRestructForm({ type: 'Term Extension', detail: '', approver: 'Credit Committee' });
              }
            }}
            disabled={!restructForm.detail}
          >
            Submit Proposal
          </Btn>
          <Btn variant="ghost" onClick={() => setActionModal(null)}>
            Cancel
          </Btn>
        </div>
      </Modal>

      {/* Write-Off Modal */}
      <Modal
        open={actionModal?.type === 'writeoff'}
        onClose={() => setActionModal(null)}
        title={`Write-Off Proposal — ${actionModal?.loanId}`}
        width={440}
      >
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
          Propose this loan for write-off. Requires Credit Committee approval.
        </div>
        <Field label="Reason / Justification">
          <Textarea
            value={writeOffReason}
            onChange={(e: any) => setWriteOffReason(e.target.value)}
            rows={3}
            placeholder="e.g. Debtor absconded, no assets, recovery unviable..."
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn
            variant="danger"
            onClick={() => {
              if (writeOffReason) {
                proposeWriteOff(actionModal.loanId, writeOffReason);
                setActionModal(null);
                setWriteOffReason('');
              }
            }}
            disabled={!writeOffReason}
          >
            Submit Write-Off Proposal
          </Btn>
          <Btn variant="ghost" onClick={() => setActionModal(null)}>
            Cancel
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
