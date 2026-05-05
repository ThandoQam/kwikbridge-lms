/**
 * UIContext — cross-page UI state.
 *
 * Holds navigation (page, zone, history), modals, toasts, and other
 * UI state that pages need to read/mutate but isn't business data.
 *
 * Why separate from DataContext: business data and UI state change
 * at very different rates and have different consumers. Splitting
 * them prevents needless re-renders (a toast appearance shouldn't
 * re-render the customer list).
 *
 * Migration: extracted feature components call useUI() to get
 * navigation handlers and modal state instead of receiving them
 * as props.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface UIContextValue {
  // Navigation
  page: string;
  setPage: (page: string) => void;
  zone: 'public' | 'portal' | 'staff';
  setZone: (zone: 'public' | 'portal' | 'staff') => void;
  pageHistory: string[];
  setPageHistory: (history: string[]) => void;
  navTo: (page: string) => void;
  navBack: () => void;

  // Detail view (right-pane / drawer)
  detail: any;
  setDetail: (d: any) => void;

  // Modals
  modal: string | null;
  setModal: (m: string | null) => void;

  // Toast notifications
  toast: { msg: string; type?: 'success' | 'error' | 'warning' } | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;

  // Header UI
  search: string;
  setSearch: (s: string) => void;
  notifOpen: boolean;
  setNotifOpen: (o: boolean) => void;

  // Sidebar / mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (o: boolean) => void;
  sideCollapsed: boolean;
  setSideCollapsed: (c: boolean) => void;

  // Document viewer
  viewingDoc: any;
  setViewingDoc: (d: any) => void;

  // Withdrawal modal state
  withdrawId: string | null;
  setWithdrawId: (id: string | null) => void;
  withdrawReason: string;
  setWithdrawReason: (r: string) => void;

  // Widget panel
  showWidgetPanel: boolean;
  setShowWidgetPanel: (s: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider = ({
  value,
  children,
}: {
  value: UIContextValue;
  children: ReactNode;
}) => {
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error('useUI() must be used within <UIProvider>. Check your tree.');
  }
  return ctx;
};
