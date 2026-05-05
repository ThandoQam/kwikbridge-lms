/**
 * OriginationPage — application intake and pipeline management.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 * Holds internal state (tab + withdraw modal); data via props.
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';

interface OriginationPageProps {
  SYSTEM_USERS: any[];
  assignApplication: (appId: string, userId: string) => void;
  qaSignOffApplication: (appId: string) => void;
  withdrawApplication: (appId: string, reason: string) => void;
  Btn: any;
  KPI: any;
  Tab: any;
  Table: any;
  Badge: any;
  Modal: any;
  Field: any;
  Textarea: any;
  cell: any;
  statusBadge: (s: string) => any;
  fmt: any;
  I: any;
  C: any;
}

export function OriginationPage({
  SYSTEM_USERS, assignApplication, qaSignOffApplication, withdrawApplication, Btn, KPI, Tab, Table, Badge, Modal, Field, Textarea, cell, statusBadge, fmt, I, C,
}: OriginationPageProps) {
  // ═══ Context-driven dependencies (Phase 2 migration) ═══
  const { applications, cust, prod } = useData();
  const { search, setModal, setDetail } = useUI();
  const { canDo } = useAuth();

  const [tab, setTab] = useState('all');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  const drafts = applications.filter((a) => a.status === 'Draft');
  const expiredDrafts = drafts.filter((a) => a.expiresAt && a.expiresAt < Date.now());
  const tabs = [
    { key: 'all', label: 'All', count: applications.length },
    { key: 'Draft', label: 'Draft (QA Pending)', count: drafts.length },
    { key: 'Submitted', label: 'Submitted', count: applications.filter((a) => a.status === 'Submitted').length },
    { key: 'Underwriting', label: 'Underwriting', count: applications.filter((a) => a.status === 'Underwriting').length },
    {
      key: 'Pending Approval',
      label: 'Pending Approval',
      count: applications.filter((a) => a.status === 'Pending Approval').length,
    },
    { key: 'Approved', label: 'Approved', count: applications.filter((a) => a.status === 'Approved').length },
    { key: 'Declined', label: 'Declined', count: applications.filter((a) => a.status === 'Declined').length },
    { key: 'Withdrawn', label: 'Withdrawn', count: applications.filter((a) => a.status === 'Withdrawn').length },
  ];
  const filtered = applications
    .filter((a) => tab === 'all' || a.status === tab)
    .filter(
      (a) =>
        !search ||
        [a.id, cust(a.custId)?.name, prod(a.product)?.name].some((f) =>
          f?.toLowerCase().includes(search.toLowerCase())
        )
    );
  const assignableUsers = SYSTEM_USERS.filter((u) =>
    ['LOAN_OFFICER', 'CREDIT', 'CREDIT_SNR', 'CREDIT_HEAD'].includes(u.role)
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.text }}>Loan Origination</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Application intake, QA & document validation, assignment & pipeline management
          </p>
        </div>
        {canDo('origination', 'create') && (
          <Btn onClick={() => setModal('newApp')} icon={I.plus}>
            New Application
          </Btn>
        )}
      </div>

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
        <KPI label="Drafts (QA Pending)" value={drafts.length} sub={expiredDrafts.length > 0 ? `${expiredDrafts.length} expired` : ''} />
        <KPI
          label="Submitted"
          value={applications.filter((a) => a.status === 'Submitted').length}
          sub="awaiting DD"
        />
        <KPI label="Underwriting" value={applications.filter((a) => a.status === 'Underwriting').length} />
        <KPI
          label="Pipeline Value"
          value={fmt.cur(
            applications
              .filter((a) => ['Draft', 'Submitted', 'Underwriting'].includes(a.status))
              .reduce((s, a) => s + a.amount, 0)
          )}
        />
        <KPI label="Approved" value={applications.filter((a) => a.status === 'Approved').length} />
        <KPI label="Declined" value={applications.filter((a) => a.status === 'Declined').length} />
      </div>

      <Tab tabs={tabs} active={tab} onChange={setTab} />
      <Table
        columns={[
          { label: 'App ID', render: (r: any) => cell.id(r.id) },
          { label: 'Applicant', render: (r: any) => cell.name(cust(r.custId)?.name) },
          { label: 'Product', render: (r: any) => cell.text(prod(r.product)?.name || r.product) },
          {
            label: 'DSCR',
            render: (r: any) =>
              r.roughDSCR ? (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: r.roughDSCR >= 1.25 ? C.green : r.roughDSCR >= 1.0 ? C.amber : C.red,
                  }}
                >
                  {r.roughDSCR}x
                </span>
              ) : (
                <span style={{ color: C.textMuted, fontSize: 11 }}>—</span>
              ),
          },
          { label: 'Amount', render: (r: any) => cell.money(r.amount) },
          { label: 'Term', render: (r: any) => cell.text(r.term + 'm') },
          { label: 'Date', render: (r: any) => cell.date(r.submitted || r.createdAt) },
          {
            label: 'Assigned To',
            render: (r: any) => {
              const u = SYSTEM_USERS.find((x: any) => x.id === r.assignedTo);
              if (u) return <span style={{ fontSize: 11 }}>{u.name}</span>;
              if (!['Submitted', 'Underwriting'].includes(r.status))
                return <span style={{ fontSize: 10, color: C.textMuted }}>—</span>;
              if (!canDo('origination', 'assign'))
                return <span style={{ fontSize: 10, color: C.amber }}>Unassigned</span>;
              return (
                <select
                  onChange={(e: any) => {
                    if (e.target.value) assignApplication(r.id, e.target.value);
                  }}
                  defaultValue=""
                  style={{
                    fontSize: 11,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.text,
                    fontFamily: 'inherit',
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}
                >
                  <option value="">Assign...</option>
                  {assignableUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              );
            },
          },
          {
            label: 'QA',
            render: (r: any) =>
              r.qaSignedOff ? (
                <Badge color="green">Passed</Badge>
              ) : r.qaFindings?.result === 'Failed' ? (
                <Badge color="red">Failed</Badge>
              ) : r.status === 'Draft' ? (
                <Badge color="amber">Pending</Badge>
              ) : (
                <span style={{ fontSize: 10, color: C.textMuted }}>—</span>
              ),
          },
          {
            label: 'Status',
            render: (r: any) => {
              if (r.status === 'Draft' && r.expiresAt && r.expiresAt < Date.now())
                return <Badge color="red">Expired</Badge>;
              return statusBadge(r.status);
            },
          },
          {
            label: 'Actions',
            render: (r: any) => (
              <div style={{ display: 'flex', gap: 4 }}>
                {r.status === 'Draft' &&
                  !(r.expiresAt && r.expiresAt < Date.now()) &&
                  canDo('origination', 'update') && (
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        qaSignOffApplication(r.id);
                      }}
                    >
                      QA & Submit
                    </Btn>
                  )}
                {['Draft', 'Submitted', 'Underwriting'].includes(r.status) &&
                  canDo('origination', 'update') && (
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        setWithdrawId(r.id);
                      }}
                    >
                      Withdraw
                    </Btn>
                  )}
              </div>
            ),
          },
        ]}
        rows={filtered}
        onRowClick={(r: any) => setDetail({ type: 'application', id: r.id })}
      />

      <Modal
        open={!!withdrawId}
        onClose={() => setWithdrawId(null)}
        title={`Withdraw Application ${withdrawId}`}
        width={420}
      >
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
          This will cancel the application. The customer can re-apply later.
        </div>
        <Field label="Reason for withdrawal">
          <Textarea
            value={withdrawReason}
            onChange={(e: any) => setWithdrawReason(e.target.value)}
            rows={3}
            placeholder="Customer request / Duplicate / Failed validation..."
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn
            variant="danger"
            onClick={() => {
              withdrawApplication(withdrawId!, withdrawReason);
              setWithdrawId(null);
              setWithdrawReason('');
            }}
          >
            Confirm Withdrawal
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setWithdrawId(null);
              setWithdrawReason('');
            }}
          >
            Cancel
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
