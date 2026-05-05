/**
 * NewAppModal — staff-side application creation form.
 *
 * Displayed when 'newApp' modal is opened from the Origination page.
 * Validates BEE eligibility, amount/term bounds, and product fit
 * before allowing submission.
 *
 * EXTRACTED FROM MONOLITH (Phase 1, May 2026).
 */

// @ts-nocheck — transitional during monolith extraction.

import React, { useState } from 'react';

interface NewAppModalProps {
  modal: string | null;
  setModal: (m: string | null) => void;
  customers: any[];
  products: any[];
  cust: (id: string) => any;
  prod: (id: string) => any;
  submitApp: (form: any) => void;
  Modal: any;
  Field: any;
  Select: any;
  Input: any;
  Textarea: any;
  Btn: any;
  fmt: any;
  C: any;
}

export function NewAppModal({
  modal,
  setModal,
  customers,
  products,
  cust,
  prod,
  submitApp,
  Modal,
  Field,
  Select,
  Input,
  Textarea,
  Btn,
  fmt,
  C,
}: NewAppModalProps) {
  const [form, setForm] = useState({
    custId: customers[0]?.id || '',
    product: products.find((p) => p.status === 'Active')?.id || products[0]?.id || '',
    amount: '',
    term: '36',
    purpose: '',
  });

  const p = prod(form.product);
  const c = cust(form.custId);
  const activeProducts = products.filter((pr) => pr.status === 'Active');
  const amt = +form.amount;
  const trm = +form.term;
  const errors: string[] = [];

  if (p && amt) {
    if (amt < p.minAmount) errors.push(`Below minimum (${fmt.cur(p.minAmount)})`);
    if (amt > p.maxAmount) errors.push(`Exceeds maximum (${fmt.cur(p.maxAmount)})`);
  }
  if (p && trm) {
    if (trm < p.minTerm) errors.push(`Term below minimum (${p.minTerm}m)`);
    if (trm > p.maxTerm) errors.push(`Term exceeds maximum (${p.maxTerm}m)`);
  }
  if (
    p &&
    c &&
    p.eligibleBEE &&
    !p.eligibleBEE.includes(0) &&
    !(p.eligibleIndustries || []).includes('All')
  ) {
    if (c.beeLevel && !p.eligibleBEE.includes(c.beeLevel))
      errors.push(
        `Customer BEE Level ${c.beeLevel} not eligible (requires ${p.eligibleBEE.join(',')})`
      );
  }
  if (
    p &&
    p.eligibleBEE &&
    !(p.eligibleBEE.length === 4) &&
    c?.beeLevel &&
    !p.eligibleBEE.includes(c.beeLevel)
  ) {
    errors.push(
      `BEE Level ${c.beeLevel} not eligible for ${p.name} (requires Level ${p.eligibleBEE.join(',')})`
    );
  }

  const canSubmit = form.amount && form.purpose && errors.length === 0;

  return (
    <Modal open={modal === 'newApp'} onClose={() => setModal(null)} title="New Loan Application" width={560}>
      <Field label="Customer">
        <Select
          value={form.custId}
          onChange={(e: any) => setForm({ ...form, custId: e.target.value })}
          options={customers.map((c) => ({ value: c.id, label: `${c.name} (BEE ${c.beeLevel})` }))}
        />
      </Field>
      <Field label="Loan Product">
        <Select
          value={form.product}
          onChange={(e: any) => setForm({ ...form, product: e.target.value })}
          options={activeProducts.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.baseRate}%, ${p.repaymentType || 'Amortising'})`,
          }))}
        />
      </Field>
      {p && (
        <div
          style={{
            background: C.surface2,
            padding: 12,
            marginBottom: 12,
            fontSize: 11,
            color: C.textDim,
            border: `1px solid ${C.border}`,
            lineHeight: 1.6,
          }}
        >
          {p.description}
          <br />
          Range: {fmt.cur(p.minAmount)} – {fmt.cur(p.maxAmount)} · Term: {p.minTerm}–{p.maxTerm}m · Grace:{' '}
          {p.gracePeriod || 0}m<br />
          Fees: Arrangement {p.arrangementFee || 0}% · Commitment {p.commitmentFee || 0}% · Max LTV:{' '}
          {p.maxLTV || 80}% · Min DSCR: {p.minDSCR || 1.2}x<br />
          BEE Eligibility: Level {(p.eligibleBEE || []).join(', ')}
        </div>
      )}
      <div className="kb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Amount (R)">
          <Input
            type="number"
            value={form.amount}
            onChange={(e: any) => setForm({ ...form, amount: e.target.value })}
            placeholder={p ? `${fmt.cur(p.minAmount)} – ${fmt.cur(p.maxAmount)}` : 'e.g. 500000'}
          />
        </Field>
        <Field label="Term (months)">
          <Input
            type="number"
            value={form.term}
            onChange={(e: any) => setForm({ ...form, term: e.target.value })}
            placeholder={p ? `${p.minTerm} – ${p.maxTerm}` : 'e.g. 36'}
          />
        </Field>
      </div>
      {errors.length > 0 && (
        <div
          style={{
            background: C.redBg,
            border: `1px solid ${C.red}`,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: 11,
            color: C.red,
          }}
        >
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      <Field label="Purpose of Loan">
        <Textarea
          value={form.purpose}
          onChange={(e: any) => setForm({ ...form, purpose: e.target.value })}
          placeholder="Describe the purpose..."
          rows={3}
        />
      </Field>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Btn variant="ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>
          Cancel
        </Btn>
        <Btn
          onClick={() => {
            if (canSubmit) {
              submitApp(form);
              setModal(null);
            }
          }}
          disabled={!canSubmit}
        >
          Submit Application
        </Btn>
      </div>
    </Modal>
  );
}
