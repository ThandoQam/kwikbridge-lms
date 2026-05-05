/**
 * DataContext — single source of truth for app data.
 *
 * Replaces the monolith's pattern of passing dozens of state variables
 * down through prop drilling or relying on closure access. Components
 * subscribe to the data they need via useData().
 *
 * Migration note: this is the foundation of the refactor. Currently the
 * monolith owns the data state directly. As pages are extracted, they
 * switch from closure access to useData(). The monolith becomes a
 * provider wrapper around the extracted pages.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface Customer {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  idNum?: string;
  regNum?: string;
  industry?: string;
  revenue?: number;
  employees?: number;
  years?: number;
  beeLevel?: number;
  province?: string;
  ficaStatus?: string;
  monthlyDebt?: number;
  monthlyRent?: number;
  businessBank?: string;
  womenOwned?: number;
  youthOwned?: number;
  disabilityOwned?: number;
  [key: string]: unknown;
}

export interface Application {
  id: string;
  custId: string;
  status: string;
  product: string;
  amount: number;
  term: number;
  purpose?: string;
  rate?: number | null;
  riskScore?: number | null;
  dscr?: number | null;
  recommendation?: string | null;
  approver?: string | null;
  conditions?: string[];
  offTaker?: string | null;
  offTakerRef?: string | null;
  offTakerRiskLevel?: string;
  securityInHand?: string[];
  isThinFile?: boolean;
  roughDSCR?: number | null;
  submitted?: number;
  decided?: number | null;
  [key: string]: unknown;
}

export interface Loan {
  id: string;
  appId: string;
  custId: string;
  product: string;
  amount: number;
  balance: number;
  rate: number;
  term: number;
  status: string;
  dpd?: number;
  stage?: number;
  payments?: Array<{ amount: number; ts: number; type: string }>;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  baseRate?: number;
  monthlyRate?: number;
  minAmount?: number;
  maxAmount?: number;
  minTerm?: number;
  maxTerm?: number;
  arrangementFee?: number;
  repaymentType?: string;
  [key: string]: unknown;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  user: string;
  detail: string;
  ts: number;
  category: string;
}

export interface Provision {
  id: string;
  loanId: string;
  stage: number;
  pd: number;
  lgd: number;
  ead: number;
  ecl: number;
}

export interface DataState {
  customers: Customer[];
  applications: Application[];
  loans: Loan[];
  products: Product[];
  documents: unknown[];
  audit: AuditEntry[];
  alerts: unknown[];
  provisions: Provision[];
  comms: unknown[];
  collections: unknown[];
  statutoryReports: unknown[];
  settings: Record<string, unknown>;
}

export interface DataContextValue extends DataState {
  // Mutations
  save: (newData: DataState) => void;
  // Helpers
  cust: (id: string) => Customer | undefined;
  prod: (id: string) => Product | undefined;
  // Audit helper
  addAudit: (
    action: string,
    entity: string,
    user: string,
    detail: string,
    category: string
  ) => AuditEntry;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider = ({
  value,
  children,
}: {
  value: DataContextValue;
  children: ReactNode;
}) => {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextValue => {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData() must be used within <DataProvider>. Check your tree.');
  }
  return ctx;
};

// Selectors — common derived data
export const useCustomerById = (id: string): Customer | undefined => {
  const { customers } = useData();
  return customers.find((c) => c.id === id);
};

export const useProductById = (id: string): Product | undefined => {
  const { products } = useData();
  return products.find((p) => p.id === id);
};

export const useApplicationById = (id: string): Application | undefined => {
  const { applications } = useData();
  return applications.find((a) => a.id === id);
};

export const useLoanById = (id: string): Loan | undefined => {
  const { loans } = useData();
  return loans.find((l) => l.id === id);
};

// Portfolio aggregates
export const usePortfolioStats = () => {
  const { loans, applications, provisions } = useData();
  const activeLoans = loans.filter((l) => l.status === 'Active' || l.status === 'Booked');
  const totalBook = activeLoans.reduce((s, l) => s + (l.balance || l.amount || 0), 0);
  const totalDisbursed = loans.reduce((s, l) => s + (l.amount || 0), 0);
  const totalECL = (provisions || []).reduce((s, p) => s + (p.ecl || 0), 0);
  const stage1 = activeLoans.filter((l) => (l.dpd || 0) <= 30);
  const stage2 = activeLoans.filter((l) => (l.dpd || 0) > 30 && (l.dpd || 0) <= 90);
  const stage3 = activeLoans.filter((l) => (l.dpd || 0) > 90);
  const pipeline = applications.filter((a) =>
    ['Submitted', 'Underwriting', 'Pre-Approval'].includes(a.status)
  );

  return {
    activeLoans,
    totalBook,
    totalDisbursed,
    totalECL,
    stage1,
    stage2,
    stage3,
    pipeline,
  };
};
