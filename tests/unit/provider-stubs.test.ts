/**
 * Unit tests for real-provider stubs.
 *
 * The Stitch/Peach payment providers and TransUnion/Experian bureau
 * providers exist as compile-time stubs until commercial agreements
 * are signed. These tests verify they fail fast with clear, actionable
 * error messages so a wiring mistake surfaces immediately rather than
 * causing silent regressions.
 */

import { describe, it, expect } from 'vitest';
import {
  StitchPaymentProvider,
  PeachPaymentProvider,
} from '../../src/lib/payments';
import {
  TransUnionBureauProvider,
  ExperianBureauProvider,
} from '../../src/lib/bureau';

// ═══ Payment provider stubs ═══

describe('StitchPaymentProvider stub', () => {
  const provider = new StitchPaymentProvider();

  it('reports its name', () => {
    expect(provider.name).toBe('StitchProvider');
  });

  it('disburse() throws with action items', async () => {
    await expect(
      provider.disburse({
        loanId: 'L-1',
        amount: 100_000,
        bankCode: 'STANDARD',
        accountNumber: '123',
        accountHolder: 'Test',
        reference: 'X',
      } as any)
    ).rejects.toThrow(/Stitch.*not yet implemented/i);
  });

  it('createDebitOrderMandate() throws with action items', async () => {
    await expect(
      provider.createDebitOrderMandate({
        loanId: 'L-1',
        bankCode: 'STD',
        accountNumber: '123',
        accountHolder: 'X',
        monthlyAmount: 5000,
        collectionDay: 1,
        termMonths: 12,
        idNumber: '8501234567083',
      } as any)
    ).rejects.toThrow(/Stitch.*not yet implemented/i);
  });

  it('collectPayment() throws', async () => {
    await expect(
      provider.collectPayment({
        loanId: 'L-1',
        mandateId: 'M-1',
        amount: 5000,
        reference: 'X',
      })
    ).rejects.toThrow(/Stitch/);
  });

  it('getPaymentStatus() throws', async () => {
    await expect(provider.getPaymentStatus('P-1')).rejects.toThrow(/Stitch/);
  });

  it('error message includes setup steps', async () => {
    try {
      await provider.disburse({} as any);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('agreement');
      expect(msg).toContain('credentials');
      expect(msg).toContain('VITE_STITCH_API_KEY');
      expect(msg).toContain('setPaymentProvider');
    }
  });
});

describe('PeachPaymentProvider stub', () => {
  const provider = new PeachPaymentProvider();

  it('reports its name', () => {
    expect(provider.name).toBe('PeachProvider');
  });

  it('disburse() throws', async () => {
    await expect(provider.disburse({} as any)).rejects.toThrow(/Peach/);
  });

  it('error message includes Peach-specific setup', async () => {
    try {
      await provider.collectPayment({} as any);
    } catch (e) {
      expect((e as Error).message).toContain('VITE_PEACH_API_KEY');
    }
  });
});

// ═══ Bureau provider stubs ═══

describe('TransUnionBureauProvider stub', () => {
  const provider = new TransUnionBureauProvider();

  it('reports its name', () => {
    expect(provider.name).toBe('TransUnion');
  });

  it('pullCreditReport() throws with action items', async () => {
    await expect(
      provider.pullCreditReport({
        custId: 'C-1',
        idNumber: '8501234567083',
        consentRef: 'CONSENT-1',
      } as any)
    ).rejects.toThrow(/TransUnion.*not yet implemented/i);
  });

  it('pullCreditScore() throws', async () => {
    await expect(provider.pullCreditScore({} as any)).rejects.toThrow(/TransUnion/);
  });

  it('verifyIdentity() throws', async () => {
    await expect(
      provider.verifyIdentity({ idNumber: '8501234567083' })
    ).rejects.toThrow(/TransUnion/);
  });

  it('screenSanctions() throws', async () => {
    await expect(provider.screenSanctions({ name: 'X' })).rejects.toThrow(/TransUnion/);
  });

  it('error message references POPIA + bureau code of conduct', async () => {
    try {
      await provider.pullCreditReport({} as any);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('POPIA');
      expect(msg).toContain('bureau code of conduct');
    }
  });
});

describe('ExperianBureauProvider stub', () => {
  const provider = new ExperianBureauProvider();

  it('reports its name', () => {
    expect(provider.name).toBe('Experian');
  });

  it('all four methods throw', async () => {
    await expect(provider.pullCreditReport({} as any)).rejects.toThrow(/Experian/);
    await expect(provider.pullCreditScore({} as any)).rejects.toThrow(/Experian/);
    await expect(provider.verifyIdentity({ idNumber: 'X' })).rejects.toThrow(/Experian/);
    await expect(provider.screenSanctions({ name: 'X' })).rejects.toThrow(/Experian/);
  });
});
