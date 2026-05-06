/**
 * Component tests for CommsPage.
 *
 * The Comms page is the omnichannel communication log. It's a
 * read-only view that pulls comms + cust(id) from context. Validates:
 *   - Renders without crashing on empty state
 *   - Lists communication entries from context
 *   - Renders channel + direction badges
 *   - Resolves customer names via cust() lookup
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { CommsPage } from '../../src/features/comms/components/CommsPage';
import { renderWithProviders } from './render-with-providers';

const now = Date.now();
const day = 86_400_000;

const buildComm = (overrides: any = {}) => ({
  id: 'CM-001',
  ts: now - day,
  custId: 'C-001',
  channel: 'Phone',
  direction: 'Inbound',
  subject: 'Payment query',
  body: 'Customer called regarding payment.',
  agent: 'U-001',
  ...overrides,
});

const customer = { id: 'C-001', name: 'Acme Pty Ltd', email: 'acme@test.co.za' };

const renderComms = (overrides: any = {}) =>
  renderWithProviders(<CommsPage />, overrides);

describe('CommsPage', () => {
  describe('rendering', () => {
    it('renders without crashing on empty data', () => {
      renderComms();
      expect(screen.getByText(/Communication Center/i)).toBeInTheDocument();
    });

    it('renders the page header even with no comms', () => {
      renderComms();
      expect(screen.getByText(/Omnichannel communication log/i)).toBeInTheDocument();
    });

    it('shows empty state row when no comms exist', () => {
      renderComms();
      // Table component's emptyMsg
      expect(screen.getByText(/No records found/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    it('renders a comm entry from context', () => {
      const comms = [buildComm({ subject: 'Account update notice' })];
      renderComms({
        data: {
          comms,
          cust: (id: string) => (id === 'C-001' ? customer : null),
        },
      });
      // The customer name should resolve via cust() lookup
      expect(screen.getByText(/Acme Pty Ltd/i)).toBeInTheDocument();
    });

    it('renders channel badge for Phone', () => {
      const comms = [buildComm({ channel: 'Phone' })];
      renderComms({
        data: {
          comms,
          cust: () => customer,
        },
      });
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('renders direction badge', () => {
      const comms = [buildComm({ direction: 'Outbound' })];
      renderComms({
        data: {
          comms,
          cust: () => customer,
        },
      });
      expect(screen.getByText('Outbound')).toBeInTheDocument();
    });

    it('renders multiple comms across channels', () => {
      const comms = [
        buildComm({ id: 'CM-1', channel: 'Phone' }),
        buildComm({ id: 'CM-2', channel: 'Email' }),
        buildComm({ id: 'CM-3', channel: 'SMS' }),
      ];
      renderComms({
        data: {
          comms,
          cust: () => customer,
        },
      });
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('handles missing customer gracefully (cust returns null)', () => {
      const comms = [buildComm({ custId: 'GHOST-ID' })];
      renderComms({
        data: {
          comms,
          cust: () => null,
        },
      });
      // Should still render the row without crashing
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });
  });
});
