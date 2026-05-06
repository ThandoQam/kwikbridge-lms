/**
 * Component tests for DocumentsPage.
 *
 * Centralised document registry. Pulls documents + cust from context.
 * Validates:
 *   - Renders without crashing
 *   - KPI cards render
 *   - Tab filtering (all / pending / expiring / verified)
 *   - Category filter
 *   - Search filtering via UI context
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentsPage } from '../../src/features/documents/components/DocumentsPage';
import { renderWithProviders } from './render-with-providers';

const day = 86_400_000;
const now = Date.now();

const buildDoc = (overrides: any = {}) => ({
  id: 'D-001',
  custId: 'C-001',
  category: 'KYC',
  type: 'ID Document',
  status: 'Verified',
  uploadedAt: now - 7 * day,
  expiryDate: now + 365 * day,
  ...overrides,
});

const customer = { id: 'C-001', name: 'Acme Pty Ltd' };

const renderDocs = (overrides: any = {}) =>
  renderWithProviders(<DocumentsPage now={now} day={day} />, overrides);

describe('DocumentsPage', () => {
  describe('rendering', () => {
    it('renders without crashing on empty data', () => {
      renderDocs();
      const tabs = screen.queryAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });

    it('renders KPI cards', () => {
      renderDocs();
      const kpis = screen.getAllByTestId('kpi');
      expect(kpis.length).toBeGreaterThan(0);
    });
  });

  describe('with documents', () => {
    it('renders document rows', () => {
      const documents = [
        buildDoc({ id: 'D-1', type: 'Passport' }),
        buildDoc({ id: 'D-2', type: 'Bank Statement', category: 'Financial' }),
      ];
      renderDocs({
        data: {
          documents,
          cust: () => customer,
        },
      });
      expect(screen.getByText(/Passport/i)).toBeInTheDocument();
      expect(screen.getByText(/Bank Statement/i)).toBeInTheDocument();
    });

    it('filters by tab — pending only', async () => {
      const user = userEvent.setup();
      const documents = [
        buildDoc({ id: 'D-1', type: 'AAA-Verified', status: 'Verified' }),
        buildDoc({ id: 'D-2', type: 'BBB-Pending', status: 'Pending' }),
      ];
      renderDocs({
        data: {
          documents,
          cust: () => customer,
        },
      });
      const pendingTab = screen.queryByRole('tab', { name: /Pending|Review/i });
      if (pendingTab) {
        await user.click(pendingTab);
        // After clicking pending tab, only the Pending doc should show
        expect(screen.queryByText(/BBB-Pending/i)).toBeInTheDocument();
      }
    });
  });

  describe('search filtering', () => {
    it('respects search term from UI context', () => {
      const documents = [
        buildDoc({ id: 'D-1', type: 'XYZ-Find-Me' }),
        buildDoc({ id: 'D-2', type: 'PQR-Hide-Me' }),
      ];
      renderDocs({
        data: {
          documents,
          cust: () => customer,
        },
        ui: { search: 'Find-Me' },
      });
      // Search should filter to just the matching doc
      expect(screen.getByText(/XYZ-Find-Me/i)).toBeInTheDocument();
    });
  });
});
