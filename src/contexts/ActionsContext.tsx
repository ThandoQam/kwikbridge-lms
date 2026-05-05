/**
 * ActionsContext — business mutation handlers.
 *
 * Exposes the mutation functions that pages need to invoke (create
 * customer, decide loan, book loan, record payment, etc.) without
 * threading them as props through every component.
 *
 * The handler functions themselves live in the monolith and reference
 * the data state via closure. This context just delivers stable
 * references to those functions to extracted components.
 *
 * Why separate from DataContext: handlers should have stable identity
 * (memoized once at mount). DataContext value changes whenever data
 * mutates; if handlers were on DataContext, every consumer would
 * re-render on every data change. Separating means a component that
 * only calls handlers (and doesn't read data) won't re-render when
 * data changes.
 *
 * Migration: extracted feature components call useActions() to get
 * the handlers they need.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface ActionsContextValue {
  // Customer lifecycle
  createCustomer: (form: any) => void;
  updateCustomer: (custId: string, updates: any) => void;
  updateFicaStatus: (custId: string, newStatus: string) => void;
  updateBeeStatus: (custId: string, newStatus: string, beeLevel: number, expiryDate: string) => void;

  // Application lifecycle
  submitApp: (form: any) => void;
  saveAnalystNotes: (appId: string, notes: string) => void;
  updateFindingNote: (appId: string, stepKey: string, itemIndex: number, note: string) => void;
  approveDocument: (docId: string, appId: string) => void;
  saveSiteVisitNotes: (appId: string, notes: string) => void;
  saveSiteVisitField: (appId: string, fieldIndex: number, value: any) => void;
  saveSiteVisitRating: (appId: string, fieldIndex: number, rating: any) => void;
  saveCreditFinding: (appId: string, fieldIndex: number, field: string, value: any) => void;
  runDDStep: (appId: string, stepKey: string) => void;
  generateCreditMemo: (app: any) => void;
  submitRecommendation: (appId: string, recommendation: any) => void;
  decideLoan: (appId: string, decision: any) => void;

  // Loan lifecycle
  generateSecurityDoc: (templateType: string, app: any, cust: any, prod: any) => void;
  generateLoanAgreement: (loan: any, app: any, cust: any, prod: any) => void;
  bookLoan: (appId: string) => void;
  disburseLoan: (loanId: string) => void;
  recordPayment: (loanId: string, amount: number) => void;

  // Collections
  addCollectionAction: (loanId: string, actionType: string, notes: string, extra?: any) => void;
  createPTP: (loanId: string, ptpDate: string, ptpAmount: number, notes: string) => void;
  approveWriteOff: (loanId: string) => void;

  // Statutory + admin
  updateStatutoryStatus: (reportId: string, newStatus: string) => void;
  saveProduct: (prod: any) => void;
  toggleProductStatus: (prodId: string) => void;

  // System / utility
  reset: () => Promise<void>;
}

const ActionsContext = createContext<ActionsContextValue | null>(null);

export const ActionsProvider = ({
  value,
  children,
}: {
  value: ActionsContextValue;
  children: ReactNode;
}) => {
  return <ActionsContext.Provider value={value}>{children}</ActionsContext.Provider>;
};

export const useActions = (): ActionsContextValue => {
  const ctx = useContext(ActionsContext);
  if (!ctx) {
    throw new Error('useActions() must be used within <ActionsProvider>. Check your tree.');
  }
  return ctx;
};
