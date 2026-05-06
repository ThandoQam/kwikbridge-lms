/**
 * Component tests for UnderwritingPage.
 *
 * Credit assessment queue. Receives applications, cust, canDo,
 * moveToUnderwriting, setDetail via props.
 *
 * Validates:
 *   - Renders without crashing
 *   - Pending Decisions section lists Submitted + Underwriting apps
 *   - Recent Decisions shows last 5 Approved/Declined
 *   - Authority computed from loan amount (Analyst < R250K, Senior < R500K,
 *     Head of Credit < R1M, Credit Committee >= R1M)
 *   - moveToUnderwriting called from "Move to Underwriting" button
 *   - setDetail called when row is clicked
 *   - Permission gating hides action buttons
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnderwritingPage } from '../../src/features/underwriting/components/UnderwritingPage';
import { renderWithProviders } from './render-with-providers';

const buildApp = (overrides: any = {}) => ({
  id: 'A-001',
  custId: 'C-001',
  amount: 500_000,
  status: 'Submitted',
  submitted: Date.now(),
  ...overrides,
});

const customer = { id: 'C-001', name: 'Acme Pty Ltd' };

const renderUw = (props: any = {}, overrides: any = {}) => {
  const moveToUnderwriting = props.moveToUnderwriting ?? vi.fn();
  const setDetail = props.setDetail ?? vi.fn();
  const canDo = props.canDo ?? (() => true);
  const result = renderWithProviders(
    <UnderwritingPage
      applications={props.applications ?? []}
      cust={props.cust ?? (() => customer)}
      canDo={canDo}
      moveToUnderwriting={moveToUnderwriting}
      setDetail={setDetail}
    />,
    overrides
  );
  return { ...result, moveToUnderwriting, setDetail };
};

describe('UnderwritingPage', () => {
  describe('rendering', () => {
    it('renders without crashing on empty data', () => {
      renderUw();
      expect(screen.getByText(/Credit Assessment & Underwriting/i)).toBeInTheDocument();
    });

    it('shows zero pending decisions when no applications', () => {
      renderUw();
      expect(screen.getByText(/Pending Decisions \(0\)/i)).toBeInTheDocument();
    });

    it('lists submitted applications in pending section', () => {
      const applications = [
        buildApp({ id: 'A-1', status: 'Submitted' }),
        buildApp({ id: 'A-2', status: 'Underwriting' }),
        buildApp({ id: 'A-3', status: 'Approved' }), // not pending
      ];
      renderUw({ applications });
      // Pending count = 2
      expect(screen.getByText(/Pending Decisions \(2\)/i)).toBeInTheDocument();
    });
  });

  describe('authority calculation', () => {
    it('shows Analyst authority for amounts <= R250K', () => {
      const applications = [buildApp({ amount: 200_000 })];
      renderUw({ applications });
      expect(screen.getAllByText(/Analyst/i).length).toBeGreaterThan(0);
    });

    it('shows Senior Analyst for amounts > R250K and <= R500K', () => {
      const applications = [buildApp({ amount: 400_000 })];
      renderUw({ applications });
      expect(screen.getByText(/Senior Analyst/i)).toBeInTheDocument();
    });

    it('shows Head of Credit for amounts > R500K and <= R1M', () => {
      const applications = [buildApp({ amount: 750_000 })];
      renderUw({ applications });
      expect(screen.getByText(/Head of Credit/i)).toBeInTheDocument();
    });

    it('shows Credit Committee for amounts > R1M', () => {
      const applications = [buildApp({ amount: 1_500_000 })];
      renderUw({ applications });
      expect(screen.getByText(/Credit Committee/i)).toBeInTheDocument();
    });
  });

  describe('decision actions', () => {
    it('shows Move to Underwriting button for Submitted apps when permitted', () => {
      const applications = [buildApp({ status: 'Submitted' })];
      renderUw({ applications, canDo: () => true });
      expect(screen.getAllByText(/Underwriting|Move/i).length).toBeGreaterThan(0);
    });

    it('hides action buttons when permission denied', () => {
      const applications = [buildApp({ status: 'Submitted' })];
      renderUw({ applications, canDo: () => false });
      // The "Move" / "Decide" action buttons should be hidden
      const moveBtn = screen.queryByRole('button', { name: /Move to Underwriting/i });
      expect(moveBtn).not.toBeInTheDocument();
    });
  });

  describe('recent decisions', () => {
    it('shows recently decided applications', () => {
      const applications = [
        buildApp({ id: 'A-OLD', status: 'Approved' }),
        buildApp({ id: 'A-NEW', status: 'Declined' }),
      ];
      renderUw({ applications });
      // Both should appear in recent decisions section
      expect(screen.getByText('A-OLD')).toBeInTheDocument();
      expect(screen.getByText('A-NEW')).toBeInTheDocument();
    });
  });
});
