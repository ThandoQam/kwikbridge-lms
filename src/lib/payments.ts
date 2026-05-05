/**
 * Payment Integration Adapter (TD-6 foundation)
 *
 * Defines the interface for payment providers. Real providers (Stitch,
 * Peach Payments, DebiCheck via NAEDO) are swapped in by replacing
 * MockPaymentProvider with a real implementation.
 *
 * This adapter pattern means:
 *   1. The LMS code (disbursement, collection) calls the same API
 *      regardless of which provider is active
 *   2. We can develop and test the full flow without provider integration
 *   3. Switching providers (or running multiple) is a config change
 *
 * Real-world South African providers and their use cases:
 *   - Stitch: payment initiation (PSD2-style instant EFT)
 *   - Peach Payments: card + EFT + DebiCheck collections
 *   - NAEDO/DebiCheck via banks: scheduled debit orders for repayments
 *   - PayShap: low-value real-time bank transfers
 *
 * Production deployment requires:
 *   - Provider contracts and PCI-DSS compliance review
 *   - Sandbox testing with each provider
 *   - Reconciliation against bank statements
 */

import { log, timing } from './observability';

export interface PaymentProvider {
  name: string;

  // Outbound: disburse loan to borrower's bank
  disburse(req: DisburseRequest): Promise<PaymentResult>;

  // Set up recurring debit order for loan repayments
  createDebitOrderMandate(req: DebitOrderRequest): Promise<MandateResult>;

  // Collect a single repayment via active mandate
  collectPayment(req: CollectRequest): Promise<PaymentResult>;

  // Cancel debit order mandate
  cancelDebitOrder(mandateId: string): Promise<{ success: boolean; error?: string }>;

  // Look up payment status (for reconciliation)
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}

export interface DisburseRequest {
  loanId: string;
  borrowerName: string;
  borrowerIdNumber?: string;
  bankCode: string;       // e.g. "FNB", "STANDARD_BANK"
  accountNumber: string;
  accountType: 'cheque' | 'savings' | 'transmission';
  amount: number;         // in ZAR cents (avoid float)
  reference: string;      // appears on borrower's statement
}

export interface DebitOrderRequest {
  loanId: string;
  borrowerName: string;
  borrowerIdNumber: string;
  bankCode: string;
  accountNumber: string;
  accountType: 'cheque' | 'savings' | 'transmission';
  monthlyAmount: number;  // in ZAR cents
  startDate: string;      // ISO date
  termMonths: number;
  collectionDay: number;  // 1-31
  type: 'NAEDO' | 'DebiCheck' | 'AC';
}

export interface MandateResult {
  success: boolean;
  mandateId?: string;
  authenticationUrl?: string;  // for DebiCheck SMS authorisation
  error?: string;
  errorCode?: string;
}

export interface CollectRequest {
  loanId: string;
  mandateId: string;
  amount: number;
  reference: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  amount: number;
  fee?: number;
  error?: string;
  errorCode?: string;
  rawResponse?: unknown;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'unknown';
  amount: number;
  reference?: string;
  failureReason?: string;
  completedAt?: number;
}

// ═══ Mock Provider — for development and testing ═══

class MockPaymentProvider implements PaymentProvider {
  name = 'MockProvider';

  async disburse(req: DisburseRequest): Promise<PaymentResult> {
    return timing(
      'payment.mock.disburse',
      async () => {
        log.info('Mock disbursement initiated', {
          loanId: req.loanId,
          amount_cents: req.amount,
        });
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 250));
        return {
          success: true,
          paymentId: `MOCK-DIS-${Date.now()}`,
          status: 'completed',
          amount: req.amount,
          fee: 50,
          rawResponse: { mock: true, message: 'Disbursement simulated' },
        };
      },
      { loanId: req.loanId }
    );
  }

  async createDebitOrderMandate(req: DebitOrderRequest): Promise<MandateResult> {
    log.info('Mock debit order mandate created', {
      loanId: req.loanId,
      type: req.type,
      monthlyAmount_cents: req.monthlyAmount,
    });
    await new Promise((r) => setTimeout(r, 250));
    return {
      success: true,
      mandateId: `MOCK-MAND-${Date.now()}`,
      authenticationUrl: req.type === 'DebiCheck'
        ? 'https://mock-debicheck.example.com/authorise/mock'
        : undefined,
    };
  }

  async collectPayment(req: CollectRequest): Promise<PaymentResult> {
    return timing(
      'payment.mock.collect',
      async () => {
        log.info('Mock payment collection', {
          loanId: req.loanId,
          mandateId: req.mandateId,
          amount_cents: req.amount,
        });
        await new Promise((r) => setTimeout(r, 250));
        // Simulate 5% failure rate
        const failed = Math.random() < 0.05;
        return {
          success: !failed,
          paymentId: `MOCK-COL-${Date.now()}`,
          status: failed ? 'failed' : 'completed',
          amount: req.amount,
          error: failed ? 'Insufficient funds' : undefined,
          errorCode: failed ? 'NSF' : undefined,
        };
      },
      { loanId: req.loanId }
    );
  }

  async cancelDebitOrder(mandateId: string): Promise<{ success: boolean; error?: string }> {
    log.info('Mock debit order cancelled', { mandateId });
    return { success: true };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    return {
      paymentId,
      status: 'completed',
      amount: 0,
      completedAt: Date.now(),
    };
  }
}

// ═══ Real Provider Stubs — to be implemented when contracts are signed ═══
// These exist as placeholders so the integration path is explicit. Calling
// any method throws a NotImplementedError with the action items required to
// complete the integration.

class NotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(
      `${provider} provider not yet implemented. ` +
      `To enable: (1) sign commercial agreement, (2) obtain API credentials, ` +
      `(3) implement ${method}() against vendor docs, (4) add credentials to ` +
      `environment via VITE_${provider.toUpperCase()}_API_KEY etc., ` +
      `(5) call setPaymentProvider(new ${provider}Provider()) in app bootstrap.`
    );
    this.name = 'NotImplementedError';
  }
}

/**
 * Stitch Money (https://stitch.money) — South African payments aggregator.
 * Capabilities: EFT disbursements, DebiCheck mandates, debit order collections.
 * Status: NOT YET CONTRACTED. This stub fails fast to surface the gap.
 */
export class StitchPaymentProvider implements PaymentProvider {
  name = 'StitchProvider';

  async disburse(_req: DisburseRequest): Promise<PaymentResult> {
    throw new NotImplementedError('Stitch', 'disburse');
  }

  async createDebitOrderMandate(_req: DebitOrderRequest): Promise<MandateResult> {
    throw new NotImplementedError('Stitch', 'createDebitOrderMandate');
  }

  async collectPayment(_req: CollectRequest): Promise<PaymentResult> {
    throw new NotImplementedError('Stitch', 'collectPayment');
  }

  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    throw new NotImplementedError('Stitch', 'getPaymentStatus');
  }
}

/**
 * Peach Payments (https://www.peachpayments.com) — Card + EFT processor.
 * Capabilities: card disbursements (rare), debit order rails, Authenticated
 * Collections (DebiCheck). Used as fallback if Stitch coverage is insufficient.
 * Status: NOT YET CONTRACTED. This stub fails fast to surface the gap.
 */
export class PeachPaymentProvider implements PaymentProvider {
  name = 'PeachProvider';

  async disburse(_req: DisburseRequest): Promise<PaymentResult> {
    throw new NotImplementedError('Peach', 'disburse');
  }

  async createDebitOrderMandate(_req: DebitOrderRequest): Promise<MandateResult> {
    throw new NotImplementedError('Peach', 'createDebitOrderMandate');
  }

  async collectPayment(_req: CollectRequest): Promise<PaymentResult> {
    throw new NotImplementedError('Peach', 'collectPayment');
  }

  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    throw new NotImplementedError('Peach', 'getPaymentStatus');
  }
}

// ═══ Provider Registry ═══

let activeProvider: PaymentProvider = new MockPaymentProvider();

export const setPaymentProvider = (provider: PaymentProvider): void => {
  log.info('Payment provider switched', { from: activeProvider.name, to: provider.name });
  activeProvider = provider;
};

export const getPaymentProvider = (): PaymentProvider => activeProvider;

// ═══ Public API ─ all LMS code calls these ═══

export const disburseLoan = async (req: DisburseRequest): Promise<PaymentResult> => {
  // Validate before sending to provider
  if (req.amount <= 0) throw new Error('Disbursement amount must be positive');
  if (req.amount > 50_000_000_00) throw new Error('Disbursement exceeds R50m policy cap');
  if (!req.bankCode || !req.accountNumber) throw new Error('Bank account required');
  if (!/^[A-Z0-9_]+$/.test(req.bankCode)) throw new Error('Invalid bank code format');
  if (!/^\d+$/.test(req.accountNumber)) throw new Error('Account number must be digits only');

  return activeProvider.disburse(req);
};

export const setupRepaymentMandate = async (req: DebitOrderRequest): Promise<MandateResult> => {
  if (req.monthlyAmount <= 0) throw new Error('Monthly amount must be positive');
  if (req.collectionDay < 1 || req.collectionDay > 31) {
    throw new Error('Collection day must be 1-31');
  }
  if (req.termMonths < 1) throw new Error('Term must be at least 1 month');

  return activeProvider.createDebitOrderMandate(req);
};

export const collectRepayment = async (req: CollectRequest): Promise<PaymentResult> => {
  if (req.amount <= 0) throw new Error('Collection amount must be positive');
  return activeProvider.collectPayment(req);
};

export const reconcilePayment = async (paymentId: string): Promise<PaymentStatus> => {
  return activeProvider.getPaymentStatus(paymentId);
};

// ═══ Reconciliation Helpers ═══

/**
 * Match expected vs actual payments for end-of-day reconciliation.
 * In production: pulls bank statement via Stitch/PSD2 and matches
 * against expected_payments table. Variances flagged for finance review.
 */
export interface ReconciliationItem {
  loanId: string;
  expected: number;
  actual: number;
  variance: number;
  status: 'matched' | 'over' | 'under' | 'missing' | 'unexpected';
}

export const reconcilePayments = (
  expected: Array<{ loanId: string; amount: number; reference: string }>,
  actual: Array<{ loanId?: string; amount: number; reference: string; date: number }>
): ReconciliationItem[] => {
  const result: ReconciliationItem[] = [];
  const actualByLoan = new Map<string, number>();
  const unmatchedActual = [...actual];

  for (const exp of expected) {
    const idx = unmatchedActual.findIndex(
      (a) => a.loanId === exp.loanId || a.reference === exp.reference
    );
    if (idx >= 0) {
      const act = unmatchedActual[idx];
      unmatchedActual.splice(idx, 1);
      const variance = act.amount - exp.amount;
      result.push({
        loanId: exp.loanId,
        expected: exp.amount,
        actual: act.amount,
        variance,
        status: variance === 0 ? 'matched' : variance > 0 ? 'over' : 'under',
      });
      actualByLoan.set(exp.loanId, act.amount);
    } else {
      result.push({
        loanId: exp.loanId,
        expected: exp.amount,
        actual: 0,
        variance: -exp.amount,
        status: 'missing',
      });
    }
  }

  // Unmatched actuals are unexpected payments
  for (const act of unmatchedActual) {
    result.push({
      loanId: act.loanId || 'UNKNOWN',
      expected: 0,
      actual: act.amount,
      variance: act.amount,
      status: 'unexpected',
    });
  }

  return result;
};
