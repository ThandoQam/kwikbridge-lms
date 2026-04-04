// KwikBridge LMS — Domain Types
// Single source of truth for all entity interfaces.

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  idNum: string;
  regNum: string;
  industry: string;
  revenue: number;
  employees: number;
  years: number;
  address: string;
  province: string;
  ficaStatus: "Pending" | "Verified" | "Failed" | "Expired";
  beeStatus: string;
  beeLevel: number;
  womenOwned: number;
  youthOwned: number;
  disabilityOwned: number;
  createdAt: number;
  createdBy: string;
}

export interface Application {
  id: string;
  custId: string;
  product: string;
  amount: number;
  term: number;
  rate: number;
  purpose: string;
  status: ApplicationStatus;
  submitted: number;
  decided: number | null;
  approver: string | null;
  recommendation: string | null;
  expiresAt: number;
  qaSignedOff: boolean;
  qaOfficer: string | null;
  qaDate: number | null;
  qaFindings: QAFindings | null;
  socialScore: number;
  underwritingWorkflow: UnderwritingWorkflow | null;
  sanctionsFlag: boolean;
  sanctionsDate: number | null;
  createdAt: number;
  createdBy: string;
}

export type ApplicationStatus =
  | "Pre-Approval" | "Draft" | "Submitted" | "Underwriting"
  | "Approved" | "Declined" | "Booked" | "Withdrawn" | "Expired";

export interface QAFindings {
  mandatoryDocs: QADocCheck[];
  missingDocs: string[];
  incompleteDocs: string[];
  fieldErrors: string[];
  passedAt: number | null;
  officer: string | null;
}

export interface QADocCheck {
  type: string;
  docId: string | null;
  status: string;
  onFile: boolean;
}

export interface UnderwritingWorkflow {
  kycComplete: boolean;
  kycDate: number | null;
  kycOfficer: string | null;
  kycFindings: Finding[];
  docsComplete: boolean;
  docsDate: number | null;
  docsOfficer: string | null;
  docsFindings: Finding[];
  siteVisitComplete: boolean;
  siteVisitDate: number | null;
  siteVisitOfficer: string | null;
  siteVisitFindings: Finding[];
  creditComplete: boolean;
  creditDate: number | null;
  creditOfficer: string | null;
  creditBureauScore: number | null;
  dscr: number | null;
  riskScore: string | null;
  creditFindings: Finding[];
  socialImpactComplete: boolean;
  socialImpactDate: number | null;
  socialImpactOfficer: string | null;
  collateralComplete: boolean;
  collateralDate: number | null;
  collateralOfficer: string | null;
  amlComplete: boolean;
  amlDate: number | null;
}

export interface Finding {
  item: string;
  status: string;
  value: string;
  analystNote: string;
  inherited?: boolean;
}

export interface Loan {
  id: string;
  custId: string;
  appId: string;
  product: string;
  amount: number;
  balance: number;
  rate: number;
  term: number;
  monthlyPmt: number;
  status: "Booked" | "Active" | "Settled" | "Written Off";
  dpd: number;
  stage: 1 | 2 | 3;
  nextDue: number;
  disbursed: number | null;
  disbursedBy: string | null;
  bookedBy: string;
  bookedAt: number;
  payments: Payment[];
  ptpHistory: PTPEntry[];
  arrangementFee: number;
  commitmentFee: number;
}

export interface Payment {
  id: string;
  amount: number;
  interest: number;
  principal: number;
  date: number;
  method: string;
  ref: string;
}

export interface PTPEntry {
  date: string;
  amount: number;
  notes: string;
  submittedBy: string;
  submittedAt: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  idealFor: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  baseRate: number;
  monthlyRate: number;
  repaymentType: "Amortising" | "Bullet" | "Balloon" | "Seasonal";
  arrangementFee: number;
  commitmentFee: number;
  gracePeriod: number;
  maxLTV: number;
  minDSCR: number;
  riskClass: "A" | "B" | "C" | "D";
  ecl: number;
  s1PD: number;
  lgd: number;
  eligibleBEE: number[];
  eligibleIndustries: string[];
  status: "Active" | "Suspended" | "Retired";
  createdBy?: string;
  createdAt?: number;
}

export interface Document {
  id: string;
  custId: string;
  appId?: string;
  name: string;
  type: string;
  category: string;
  docType?: string;
  status: "Pending Review" | "Under Review" | "Verified" | "Rejected";
  uploadedAt: number;
  uploadedBy: string;
  reviewedBy?: string;
  reviewedAt?: number;
  notes?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  user: string;
  ts: number;
  details: string;
  category: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: "info" | "warning" | "error";
  title: string;
  msg: string;
  read: boolean;
  ts: number;
}

export interface Communication {
  id: string;
  custId: string;
  type: "Email" | "SMS" | "Phone" | "Letter" | "Meeting";
  direction: "Outbound" | "Inbound";
  subject: string;
  body: string;
  sentBy: string;
  sentAt: number;
}

export interface Provision {
  id: string;
  loanId: string;
  stage: 1 | 2 | 3;
  pd: number;
  lgd: number;
  ead: number;
  ecl: number;
}

export interface CollectionAction {
  id: string;
  loanId: string;
  action: string;
  notes: string;
  officer: string;
  ts: number;
  ptpDate?: number;
  ptpAmount?: number;
}

export interface StatutoryReport {
  id: string;
  name: string;
  type: string;
  category: string;
  period: string;
  dueDate: string;
  submitTo: string;
  status: "Not Started" | "In Progress" | "Submitted";
  preparer: string;
  reviewer: string;
  submittedDate?: string;
  notes?: string;
}

export interface Settings {
  companyName: string;
  ncrRegistration: string;
  branch: string;
  yearEnd: string;
  address: string;
  annualReviewDate: string;
  form39Threshold: number;
  totalFacility: number;
  ncrEmail: string;
  ncrEmailForm39: string;
  fundingCapacity?: number;
}

export interface SystemUser {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  status: "Active" | "Suspended" | "Revoked";
  department: string;
}

// ═══ App-level data shape ═══

export interface AppData {
  customers: Customer[];
  products: Product[];
  applications: Application[];
  loans: Loan[];
  collections: CollectionAction[];
  alerts: Alert[];
  audit: AuditEntry[];
  provisions: Provision[];
  comms: Communication[];
  documents: Document[];
  statutoryReports: StatutoryReport[];
  settings: Settings;
}

// ═══ UI Component Props ═══

export interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface BadgeProps {
  children: React.ReactNode;
  color?: "green" | "red" | "amber" | "blue" | "purple" | "cyan" | "slate";
}

export interface TableColumn<T = any> {
  label: string;
  key?: string;
  render?: (row: T) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMsg?: string;
}

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export interface KPIProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export interface TabProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export interface SectionCardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

// ═══ Permission Types ═══

export type RoleKey =
  | "ADMIN" | "EXEC" | "CREDIT_HEAD" | "COMPLIANCE"
  | "CREDIT_SNR" | "CREDIT" | "LOAN_OFFICER" | "COLLECTIONS"
  | "FINANCE" | "AUDITOR" | "VIEWER" | "BORROWER";

export type PermAction = "view" | "create" | "update" | "delete" | "approve" | "assign" | "signoff" | "export";

export type PermModule =
  | "dashboard" | "customers" | "origination" | "underwriting"
  | "loans" | "servicing" | "collections" | "provisioning"
  | "governance" | "statutory" | "documents" | "reports"
  | "comms" | "admin" | "products" | "settings" | "portal";

export type ZoneKey = "public" | "portal" | "staff";
