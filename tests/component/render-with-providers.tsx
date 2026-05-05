/**
 * render-with-providers.tsx — test helper that wraps a component in
 * the same four-layer Context stack the monolith provides.
 *
 * Usage:
 *   const result = renderWithProviders(<DashboardPage {...props} />, {
 *     data: { customers: [...], applications: [...] },
 *     actions: { createCustomer: vi.fn() },
 *     ui: { page: 'dashboard' },
 *     auth: { canDo: () => true },
 *   });
 *
 * Any context slice not provided is given a permissive default — every
 * action is a vi.fn(), every ui setter is a vi.fn(), data arrays are
 * empty, canDo returns true. This means tests can override only the
 * pieces that matter for the assertion under test.
 */
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { DataProvider } from '../../src/contexts/DataContext';
import { ActionsProvider } from '../../src/contexts/ActionsContext';
import { UIProvider } from '../../src/contexts/UIContext';
import { AuthProvider } from '../../src/contexts/AuthContext';

// ═══ Default mock data (empty but well-typed) ═══
export const buildDataValue = (overrides: any = {}) => ({
  customers: [],
  applications: [],
  loans: [],
  products: [],
  documents: [],
  audit: [],
  alerts: [],
  provisions: [],
  comms: [],
  collections: [],
  statutoryReports: [],
  settings: {},
  data: { customers: [], applications: [], loans: [], products: [], documents: [], audit: [], alerts: [], provisions: [], comms: [], collections: [], statutoryReports: [], settings: {} },
  save: vi.fn().mockResolvedValue(undefined),
  cust: (id: string) => null,
  prod: (id: string) => null,
  addAudit: vi.fn(),
  ...overrides,
});

// ═══ Default mock actions (every handler is a spy) ═══
export const buildActionsValue = (overrides: any = {}) => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  updateFicaStatus: vi.fn(),
  updateBeeStatus: vi.fn(),
  submitApp: vi.fn(),
  saveAnalystNotes: vi.fn(),
  updateFindingNote: vi.fn(),
  approveDocument: vi.fn(),
  saveSiteVisitNotes: vi.fn(),
  saveSiteVisitField: vi.fn(),
  saveSiteVisitRating: vi.fn(),
  saveCreditFinding: vi.fn(),
  runDDStep: vi.fn(),
  generateCreditMemo: vi.fn(),
  submitRecommendation: vi.fn(),
  decideLoan: vi.fn(),
  generateSecurityDoc: vi.fn(),
  generateLoanAgreement: vi.fn(),
  bookLoan: vi.fn(),
  disburseLoan: vi.fn(),
  recordPayment: vi.fn(),
  addCollectionAction: vi.fn(),
  createPTP: vi.fn(),
  approveWriteOff: vi.fn(),
  updateStatutoryStatus: vi.fn(),
  saveProduct: vi.fn(),
  toggleProductStatus: vi.fn(),
  markRead: vi.fn(),
  reset: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ═══ Default UI state (no modal, no detail, no toast) ═══
export const buildUIValue = (overrides: any = {}) => ({
  page: 'dashboard',
  setPage: vi.fn(),
  zone: 'staff' as const,
  setZone: vi.fn(),
  pageHistory: [],
  setPageHistory: vi.fn(),
  navTo: vi.fn(),
  navBack: vi.fn(),
  detail: null,
  setDetail: vi.fn(),
  modal: null,
  setModal: vi.fn(),
  toast: null,
  showToast: vi.fn(),
  search: '',
  setSearch: vi.fn(),
  notifOpen: false,
  setNotifOpen: vi.fn(),
  mobileMenuOpen: false,
  setMobileMenuOpen: vi.fn(),
  sideCollapsed: false,
  setSideCollapsed: vi.fn(),
  viewingDoc: null,
  setViewingDoc: vi.fn(),
  withdrawId: null,
  setWithdrawId: vi.fn(),
  withdrawReason: '',
  setWithdrawReason: vi.fn(),
  showWidgetPanel: false,
  setShowWidgetPanel: vi.fn(),
  securitySelections: {},
  setSecuritySelections: vi.fn(),
  ...overrides,
});

// ═══ Default auth (admin user, all permissions) ═══
export const buildAuthValue = (overrides: any = {}) => ({
  authSession: { token: 'test-token' },
  currentUser: {
    id: 'U-TEST',
    name: 'Test Admin',
    email: 'admin@test.tqacapital.co.za',
    role: 'ADMIN',
    initials: 'TA',
    status: 'Active',
  },
  setCurrentUser: vi.fn(),
  role: 'ADMIN',
  canDo: () => true,
  signOut: vi.fn(),
  sysUsers: [],
  setSysUsers: vi.fn(),
  ...overrides,
});

interface ProviderOverrides {
  data?: any;
  actions?: any;
  ui?: any;
  auth?: any;
}

export function renderWithProviders(
  ui: ReactElement,
  overrides: ProviderOverrides = {},
  renderOptions: Omit<RenderOptions, 'wrapper'> = {}
) {
  const dataValue = buildDataValue(overrides.data);
  const actionsValue = buildActionsValue(overrides.actions);
  const uiValue = buildUIValue(overrides.ui);
  const authValue = buildAuthValue(overrides.auth);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider value={authValue}>
      <DataProvider value={dataValue}>
        <ActionsProvider value={actionsValue}>
          <UIProvider value={uiValue}>
            {children}
          </UIProvider>
        </ActionsProvider>
      </DataProvider>
    </AuthProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Return the values so assertions can spy on them
    dataValue,
    actionsValue,
    uiValue,
    authValue,
  };
}
