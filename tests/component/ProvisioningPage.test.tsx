/**
 * Component tests for ProvisioningPage.
 *
 * IFRS 9 ECL view. Pulls loans + provisions + cust(id) from context.
 * Validates:
 *   - Renders KPIs from provision aggregates
 *   - Renders ECL-by-loan table
 *   - Stage distribution rendered for stages 1, 2, 3
 *   - Divide-by-zero edge case (empty provisions) handled
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { ProvisioningPage } from '../../src/features/provisioning/components/ProvisioningPage';
import { renderWithProviders } from './render-with-providers';

const buildLoan = (overrides: any = {}) => ({
  id: 'L-001',
  custId: 'C-001',
  product: 'P-WC',
  amount: 1_000_000,
  balance: 800_000,
  status: 'Active',
  stage: 1,
  ...overrides,
});

const buildProvision = (overrides: any = {}) => ({
  loanId: 'L-001',
  stage: 1,
  ead: 800_000,
  pd: 0.02,
  lgd: 0.45,
  ecl: 7_200,
  method: '12m PD × LGD × EAD',
  ...overrides,
});

const customer = { id: 'C-001', name: 'Acme Pty Ltd', email: 'acme@test.co.za' };

const renderProv = (overrides: any = {}) =>
  renderWithProviders(<ProvisioningPage />, overrides);

describe('ProvisioningPage', () => {
  describe('rendering', () => {
    it('renders without crashing on empty data', () => {
      renderProv();
      expect(screen.getByText(/IFRS 9 Impairment & Provisioning/i)).toBeInTheDocument();
    });

    it('renders all four KPI cards', () => {
      renderProv();
      const kpis = screen.getAllByTestId('kpi');
      expect(kpis.length).toBe(4);
    });

    it('renders KPI labels', () => {
      renderProv();
      expect(screen.getByText('Total ECL Provision')).toBeInTheDocument();
      expect(screen.getByText('Total EAD')).toBeInTheDocument();
      expect(screen.getByText('Coverage Ratio')).toBeInTheDocument();
      expect(screen.getByText('Stage 2+3 Exposure')).toBeInTheDocument();
    });

    it('renders ECL by Loan section', () => {
      renderProv();
      expect(screen.getByText(/ECL by Loan/i)).toBeInTheDocument();
    });

    it('renders stage distribution section', () => {
      renderProv();
      expect(screen.getByText(/IFRS 9 Stage Distribution/i)).toBeInTheDocument();
    });
  });

  describe('with provisions data', () => {
    it('aggregates ECL across provisions', () => {
      const provisions = [
        buildProvision({ loanId: 'L-1', ecl: 10_000, ead: 500_000 }),
        buildProvision({ loanId: 'L-2', ecl: 25_000, ead: 1_000_000 }),
      ];
      const loans = [buildLoan({ id: 'L-1' }), buildLoan({ id: 'L-2' })];
      renderProv({
        data: {
          loans,
          provisions,
          cust: () => customer,
        },
      });
      // Total ECL appears twice — once in KPI, once in section footer
      // en-ZA locale: 'R 35 000,00' (uses NBSP separator and comma decimal)
      // Tolerant matcher: just look for '35' followed somewhere by '000'
      expect(screen.getAllByText(/35[\s,.]?000/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders provision rows with stage badges', () => {
      const provisions = [
        buildProvision({ loanId: 'L-1', stage: 1 }),
        buildProvision({ loanId: 'L-2', stage: 2 }),
        buildProvision({ loanId: 'L-3', stage: 3 }),
      ];
      const loans = [
        buildLoan({ id: 'L-1' }),
        buildLoan({ id: 'L-2' }),
        buildLoan({ id: 'L-3' }),
      ];
      renderProv({
        data: {
          loans,
          provisions,
          cust: () => customer,
        },
      });
      // Stage badges rendered (one per provision)
      const stage1 = screen.getAllByText(/Stage 1/i);
      const stage2 = screen.getAllByText(/Stage 2/i);
      const stage3 = screen.getAllByText(/Stage 3/i);
      expect(stage1.length).toBeGreaterThan(0);
      expect(stage2.length).toBeGreaterThan(0);
      expect(stage3.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty provisions without divide-by-zero crash', () => {
      // Coverage Ratio is totalECL / totalEAD — both 0 with empty data.
      // The component should render even if coverage is NaN%.
      renderProv({ data: { provisions: [], loans: [] } });
      expect(screen.getByText(/IFRS 9 Impairment/i)).toBeInTheDocument();
      // KPIs render
      expect(screen.getAllByTestId('kpi').length).toBe(4);
    });
  });
});
