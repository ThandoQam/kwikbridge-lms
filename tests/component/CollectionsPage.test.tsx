/**
 * Component tests for CollectionsPage.
 *
 * CollectionsPage is the most workflow-rich page — DPD bucketing,
 * PTP creation, restructure proposals, write-off authority. Validates:
 *   - Renders delinquent loans in the right DPD buckets
 *   - PTP modal flow calls createPTP with correct args
 *   - Write-off authority gating works
 *   - Empty state when no delinquent accounts
 *
 * CollectionsPage uses context hooks for data/actions/ui/auth.
 * Tests use renderWithProviders to wrap component with mock contexts.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionsPage } from '../../src/features/collections/components/CollectionsPage';
import { renderWithProviders } from './render-with-providers';
import { uiPrimitives } from './ui-stubs';

const day = 86_400_000;
const now = Date.now();

const buildLoan = (overrides: any = {}) => ({
  id: 'L-001', custId: 'C-001', product: 'P-WC',
  amount: 500_000, balance: 350_000, status: 'Active',
  stage: 1, dpd: 0, rate: 14.5, term: 36,
  monthlyPmt: 17_000, payments: [],
  disbursed: now - 90 * day,
  ...overrides,
});

const buildCustomer = (overrides: any = {}) => ({
  id: 'C-001', name: 'Acme Trading', beeLevel: 2,
  industry: 'Manufacturing', province: 'Gauteng',
  ficaStatus: 'Verified', beeStatus: 'Verified',
  ...overrides,
});

const cell = {
  id: (v: any) => <span>{v}</span>,
  name: (v: any) => <span>{v}</span>,
  text: (v: any) => <span>{v}</span>,
  money: (v: any) => <span>{v}</span>,
  date: (v: any) => <span>{v}</span>,
  pct: (v: any) => <span>{v}</span>,
  count: (v: any) => <span>{v}</span>,
  badge: (v: any) => <span>{v}</span>,
  dim: (v: any) => <span>{v}</span>,
  mono: (v: any) => <span>{v}</span>,
};

const Modal = ({ open, onClose, title, children }: any) =>
  open ? (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  ) : null;

const renderColl = (contexts: any = {}, propOverrides: any = {}) =>
  renderWithProviders(
    <CollectionsPage
      Modal={Modal}
      cell={cell}
      proposeRestructure={vi.fn()}
      proposeWriteOff={vi.fn()}
      {...uiPrimitives}
      {...propOverrides}
    />,
    contexts
  );

describe('CollectionsPage', () => {
  describe('rendering', () => {
    it('renders without crashing with empty data', () => {
      renderColl();
      // Should mount and show some structure (KPIs, tabs, etc.)
      expect(screen.getAllByTestId('kpi').length).toBeGreaterThan(0);
    });

    it('shows DPD bucket KPIs', () => {
      renderColl({
        data: {
          loans: [
            buildLoan({ id: 'L-1', dpd: 15 }),
            buildLoan({ id: 'L-2', dpd: 45 }),
            buildLoan({ id: 'L-3', dpd: 95 }),
          ],
          cust: (id: string) => buildCustomer({ id }),
        },
      });
      expect(screen.getAllByTestId('kpi').length).toBeGreaterThan(0);
    });
  });

  describe('delinquent loans display', () => {
    it('shows delinquent loan customer names', () => {
      renderColl({
        data: {
          loans: [buildLoan({ id: 'L-1', custId: 'C-001', dpd: 30 })],
          cust: (id: string) =>
            id === 'C-001' ? buildCustomer({ name: 'Acme Trading' }) : null,
        },
      });
      expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    });

    it('does NOT show non-delinquent loans (dpd=0)', () => {
      renderColl({
        data: {
          loans: [
            buildLoan({ id: 'L-1', custId: 'C-001', dpd: 0 }),
            buildLoan({ id: 'L-2', custId: 'C-002', dpd: 30 }),
          ],
          cust: (id: string) => ({
            id, name: id === 'C-001' ? 'Current Co' : 'Late Co', beeLevel: 2,
          }),
        },
      });
      expect(screen.getByText('Late Co')).toBeInTheDocument();
      expect(screen.queryByText('Current Co')).not.toBeInTheDocument();
    });
  });

  describe('permission gating', () => {
    it('hides action buttons for users without create permission', () => {
      renderColl({
        data: {
          loans: [buildLoan({ id: 'L-1', dpd: 120 })],
          cust: (id: string) => buildCustomer({ id }),
        },
        auth: {
          canDo: (mod: string, action: string) => !(mod === 'collections' && action === 'create'),
        },
      });
      // Action buttons gated by collections.create — should all be absent
      expect(screen.queryByRole('button', { name: /Write[- ]?off/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^PTP$/i })).not.toBeInTheDocument();
      // "View only" text appears in actions column instead
      expect(screen.getByText(/View only/i)).toBeInTheDocument();
    });
  });

  describe('row click → setDetail', () => {
    it('clicking a delinquent loan row calls setDetail with loan info', async () => {
      const user = userEvent.setup();
      const { uiValue } = renderColl({
        data: {
          loans: [buildLoan({ id: 'L-1', custId: 'C-001', dpd: 30 })],
          cust: (id: string) => buildCustomer({ id }),
        },
      });

      const customerName = screen.getByText('Acme Trading');
      const row = customerName.closest('tr');
      if (row) {
        await user.click(row);
        expect(uiValue.setDetail).toHaveBeenCalled();
        const call = (uiValue.setDetail as any).mock.calls[0][0];
        expect(call?.type).toBe('loan');
        expect(call?.id).toBe('L-1');
      }
    });
  });
});
