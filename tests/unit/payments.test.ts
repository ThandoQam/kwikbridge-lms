import { describe, it, expect } from 'vitest';
import {
  disburseLoan,
  setupRepaymentMandate,
  collectRepayment,
  reconcilePayments,
} from '../../src/lib/payments';

describe('disburseLoan', () => {
  const validReq = {
    loanId: 'L-001',
    borrowerName: 'Test Pty Ltd',
    bankCode: 'FNB',
    accountNumber: '62123456789',
    accountType: 'cheque' as const,
    amount: 5000000, // R50,000 in cents
    reference: 'KB-DIS-001',
  };

  it('disburses a valid request', async () => {
    const result = await disburseLoan(validReq);
    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();
    expect(result.amount).toBe(validReq.amount);
  });

  it('rejects zero amount', async () => {
    await expect(disburseLoan({ ...validReq, amount: 0 })).rejects.toThrow();
  });

  it('rejects negative amount', async () => {
    await expect(disburseLoan({ ...validReq, amount: -1000 })).rejects.toThrow();
  });

  it('rejects amount above R50m policy cap', async () => {
    await expect(disburseLoan({ ...validReq, amount: 60_000_000_00 })).rejects.toThrow(/policy/);
  });

  it('rejects missing bank account', async () => {
    await expect(disburseLoan({ ...validReq, accountNumber: '' })).rejects.toThrow();
  });

  it('rejects non-digit account number', async () => {
    await expect(disburseLoan({ ...validReq, accountNumber: 'ABC123' })).rejects.toThrow(/digits/);
  });
});

describe('setupRepaymentMandate', () => {
  const validReq = {
    loanId: 'L-001',
    borrowerName: 'Test Pty Ltd',
    borrowerIdNumber: '8001015009087',
    bankCode: 'FNB',
    accountNumber: '62123456789',
    accountType: 'cheque' as const,
    monthlyAmount: 500000, // R5,000
    startDate: '2026-01-01',
    termMonths: 12,
    collectionDay: 25,
    type: 'DebiCheck' as const,
  };

  it('creates a valid mandate', async () => {
    const result = await setupRepaymentMandate(validReq);
    expect(result.success).toBe(true);
    expect(result.mandateId).toBeDefined();
  });

  it('returns auth URL for DebiCheck mandates', async () => {
    const result = await setupRepaymentMandate({ ...validReq, type: 'DebiCheck' });
    expect(result.authenticationUrl).toBeDefined();
  });

  it('rejects collection day outside 1-31', async () => {
    await expect(
      setupRepaymentMandate({ ...validReq, collectionDay: 0 })
    ).rejects.toThrow();
    await expect(
      setupRepaymentMandate({ ...validReq, collectionDay: 32 })
    ).rejects.toThrow();
  });

  it('rejects negative monthly amount', async () => {
    await expect(
      setupRepaymentMandate({ ...validReq, monthlyAmount: -100 })
    ).rejects.toThrow();
  });
});

describe('reconcilePayments', () => {
  it('matches identical expected and actual', () => {
    const result = reconcilePayments(
      [{ loanId: 'L-001', amount: 5000, reference: 'REF-1' }],
      [{ loanId: 'L-001', amount: 5000, reference: 'REF-1', date: Date.now() }]
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('matched');
    expect(result[0].variance).toBe(0);
  });

  it('flags missing payments', () => {
    const result = reconcilePayments(
      [{ loanId: 'L-001', amount: 5000, reference: 'REF-1' }],
      []
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('missing');
    expect(result[0].variance).toBe(-5000);
  });

  it('flags overpayments', () => {
    const result = reconcilePayments(
      [{ loanId: 'L-001', amount: 5000, reference: 'REF-1' }],
      [{ loanId: 'L-001', amount: 6000, reference: 'REF-1', date: Date.now() }]
    );
    expect(result[0].status).toBe('over');
    expect(result[0].variance).toBe(1000);
  });

  it('flags underpayments', () => {
    const result = reconcilePayments(
      [{ loanId: 'L-001', amount: 5000, reference: 'REF-1' }],
      [{ loanId: 'L-001', amount: 4500, reference: 'REF-1', date: Date.now() }]
    );
    expect(result[0].status).toBe('under');
    expect(result[0].variance).toBe(-500);
  });

  it('flags unexpected payments', () => {
    const result = reconcilePayments(
      [],
      [{ loanId: 'L-999', amount: 1000, reference: 'UNKNOWN', date: Date.now() }]
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('unexpected');
  });

  it('matches by reference when loan ID missing on actual', () => {
    const result = reconcilePayments(
      [{ loanId: 'L-001', amount: 5000, reference: 'KB-COL-12345' }],
      [{ amount: 5000, reference: 'KB-COL-12345', date: Date.now() }]
    );
    expect(result[0].status).toBe('matched');
  });
});
