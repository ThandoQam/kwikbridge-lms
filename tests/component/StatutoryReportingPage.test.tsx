/**
 * Component tests for StatutoryReportingPage.
 *
 * NCR regulatory reporting calendar (NCRCP22396). Pulls statutoryReports
 * + loans + settings from context, calls updateStatutoryStatus action.
 * Validates:
 *   - Renders without crashing on empty data
 *   - Form 39 frequency is determined by disbursement total (>R15M = Quarterly)
 *   - Upcoming/Submitted tabs render the correct rows
 *   - Status badges render
 *   - Critical deadline banner shows for the next upcoming report
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatutoryReportingPage } from '../../src/features/statutory/components/StatutoryReportingPage';
import { renderWithProviders } from './render-with-providers';

const day = 86_400_000;
const now = Date.now();

const buildReport = (overrides: any = {}) => ({
  id: 'STAT-001',
  name: 'Form 39 Q1 2026',
  dueDate: new Date(now + 30 * day).toISOString(),
  period: 'Q1 2026',
  submitTo: 'NCR',
  status: 'Not Started',
  ...overrides,
});

const buildLoan = (overrides: any = {}) => ({
  id: 'L-001',
  custId: 'C-001',
  amount: 5_000_000,
  status: 'Active',
  ...overrides,
});

const renderStat = (overrides: any = {}) =>
  renderWithProviders(<StatutoryReportingPage />, overrides);

describe('StatutoryReportingPage', () => {
  describe('rendering', () => {
    it('renders without crashing on empty data', () => {
      renderStat();
      expect(screen.getByText(/NCR Statutory Reporting/i)).toBeInTheDocument();
    });

    it('renders KPI cards', () => {
      renderStat();
      const kpis = screen.getAllByTestId('kpi');
      expect(kpis.length).toBe(4);
    });

    it('renders the page header with NCRCP22396', () => {
      renderStat();
      expect(screen.getByText(/NCRCP22396/i)).toBeInTheDocument();
    });
  });

  describe('Form 39 frequency calculation', () => {
    it('shows "Annual" when disbursements <= R15M', () => {
      const loans = [buildLoan({ amount: 10_000_000 })];
      renderStat({ data: { loans, statutoryReports: [] } });
      // Annual frequency
      expect(screen.getByText('Annual')).toBeInTheDocument();
    });

    it('shows "Quarterly" when disbursements > R15M', () => {
      const loans = [
        buildLoan({ id: 'L-1', amount: 10_000_000 }),
        buildLoan({ id: 'L-2', amount: 10_000_000 }),
      ];
      renderStat({ data: { loans, statutoryReports: [] } });
      expect(screen.getByText('Quarterly')).toBeInTheDocument();
    });
  });

  describe('upcoming reports', () => {
    it('shows critical deadline banner when there is an upcoming report', () => {
      const reports = [
        buildReport({
          name: 'Form 39 Q2 2026',
          dueDate: new Date(now + 14 * day).toISOString(),
          status: 'Not Started',
        }),
      ];
      renderStat({ data: { statutoryReports: reports } });
      expect(screen.getByText(/Next Deadline/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Form 39 Q2 2026/i).length).toBeGreaterThan(0);
    });

    it('shows "OVERDUE" when due date has passed', () => {
      const reports = [
        buildReport({
          name: 'Late report',
          dueDate: new Date(now - 5 * day).toISOString(),
          status: 'Not Started',
        }),
      ];
      renderStat({ data: { statutoryReports: reports } });
      expect(screen.getAllByText(/OVERDUE/i).length).toBeGreaterThan(0);
    });

    it('lists upcoming reports in the table', () => {
      const reports = [
        buildReport({ id: 'R-1', name: 'Upcoming Q1', status: 'Not Started' }),
        buildReport({ id: 'R-2', name: 'Upcoming Q2', status: 'In Progress' }),
      ];
      renderStat({ data: { statutoryReports: reports } });
      expect(screen.getAllByText(/Upcoming Q1/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Upcoming Q2/i)).toBeInTheDocument();
    });
  });

  describe('submitted reports tab', () => {
    it('switches to submitted tab', async () => {
      const user = userEvent.setup();
      const reports = [
        buildReport({ id: 'R-1', name: 'Pending', status: 'Not Started' }),
        buildReport({ id: 'R-2', name: 'Done', status: 'Submitted' }),
      ];
      renderStat({ data: { statutoryReports: reports } });

      // Click the Submitted tab
      const submittedTab = screen.getByRole('tab', { name: /Submitted/i });
      await user.click(submittedTab);
      expect(screen.getByText(/Done/i)).toBeInTheDocument();
    });
  });
});
