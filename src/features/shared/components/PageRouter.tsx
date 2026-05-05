/**
 * StaffRouter — switch component that selects the correct staff page
 * based on UI page state.
 *
 * EXTRACTED FROM MONOLITH (Phase 4 of post-refactor sprint, May 2026).
 * Replaces the inline `renderPage()` function. The DetailView short-
 * circuit and per-page ErrorBoundary wrapping are preserved.
 *
 * Receives via context:
 *   - page: string (current page key, from useUI)
 *   - detail: detail object or null (from useUI)
 *
 * Receives via props:
 *   - All UI primitive components (Btn, Field, KPI, etc.)
 *   - All helper functions (cell, fmt, statusBadge, predictDelinquency,
 *     getProductSecurity, navTo, canDoAny)
 *   - All RBAC + business constants (ROLES, PERMS, APPROVAL_LIMITS,
 *     SECURITY_INSTRUMENTS, KYB_FICA_DOCS, ddSteps, SYSTEM_USERS)
 *   - Time snapshot (now, day)
 *   - Action handlers not yet exposed via context (assignApplication,
 *     qaSignOffApplication, withdrawApplication, moveToUnderwriting)
 *
 * Returns the correct extracted page component wrapped in an
 * ErrorBoundary so a crash in one page doesn't take down the whole app.
 */

// @ts-nocheck — transitional during monolith extraction.

import React from 'react';
import { Btn, I, Select, Tab } from '../../../components/ui';
import { useUI } from '../../../contexts/UIContext';

import { DetailView } from './DetailView';
import { DashboardPage } from '../../dashboard';
import { CustomersPage } from '../../customers';
import { OriginationPage } from '../../origination';
import { UnderwritingPage } from '../../underwriting';
import { LoansPage } from '../../loans';
import { ServicingPage } from '../../servicing';
import { CollectionsPage } from '../../collections';
import { ProvisioningPage } from '../../provisioning';
import { GovernancePage } from '../../governance';
import { StatutoryReportingPage } from '../../statutory';
import { DocumentsPage } from '../../documents';
import { ReportsPage } from '../../reports';
import { InvestorDashboard } from '../../investor';
import { CommsPage } from '../../comms';
import { AdministrationPage } from '../../admin';

interface StaffRouterProps {
// UI primitives
  ErrorBoundary: any;
  // Helpers
  predictDelinquency: any; getProductSecurity: any;
  navTo: any; canDoAny: any;
  // Constants
  ROLES: any; PERMS: any; APPROVAL_LIMITS: any;
  SECURITY_INSTRUMENTS: any; KYB_FICA_DOCS: any; ddSteps: any;
  SYSTEM_USERS: any;
  // Time
  now: number; day: number;
  // Action handlers not yet in context
  assignApplication: any;
  qaSignOffApplication: any;
  withdrawApplication: any;
  moveToUnderwriting: any;
  // Data refs needed by some still-prop-based features (Underwriting, Reports, Investor)
  applications: any; customers: any; loans: any; collections: any;
  provisions: any; audit: any;
  cust: any; prod: any;
  canDo: any; setDetail: any;
  save: any;
}

export function StaffRouter({
  ErrorBoundary,
  predictDelinquency,
  getProductSecurity,
  navTo,
  canDoAny,
  ROLES,
  PERMS,
  APPROVAL_LIMITS,
  SECURITY_INSTRUMENTS,
  KYB_FICA_DOCS,
  ddSteps,
  SYSTEM_USERS,
  now,
  day,
  assignApplication,
  qaSignOffApplication,
  withdrawApplication,
  moveToUnderwriting,
  applications,
  customers,
  loans,
  collections,
  provisions,
  audit,
  cust,
  prod,
  canDo,
  setDetail,
  save,
}: StaffRouterProps) {
  const { page, detail } = useUI();

  // ── Detail short-circuit ──
  if (detail) {
    return (
      <ErrorBoundary fallback="page-level" pageName="Detail View">
        <DetailView ROLES={ROLES} SECURITY_INSTRUMENTS={SECURITY_INSTRUMENTS} KYB_FICA_DOCS={KYB_FICA_DOCS} ddSteps={ddSteps} getProductSecurity={getProductSecurity} navTo={navTo} />
      </ErrorBoundary>
    );
  }

  // ── Per-page render with ErrorBoundary ──
  // Each page wrapped in its own ErrorBoundary so a crash in one page
  // doesn't take down the whole app — the user sees a friendly fallback
  // and can navigate to other pages.
  const wrap = (name: string, content: any) => (
    <ErrorBoundary fallback="page-level" pageName={name}>{content}</ErrorBoundary>
  );

  switch (page) {
    case 'dashboard':
      return wrap('Dashboard', (
        <DashboardPage predictDelinquency={predictDelinquency} ROLES={ROLES} />
      ));

    case 'customers':
      return wrap('Customers', (
        <CustomersPage now={now} day={day} />
      ));

    case 'origination':
      return wrap('Origination', (
        <OriginationPage SYSTEM_USERS={SYSTEM_USERS} assignApplication={assignApplication} qaSignOffApplication={qaSignOffApplication} withdrawApplication={withdrawApplication} />
      ));

    case 'underwriting':
      return wrap('Underwriting', (
        <UnderwritingPage applications={applications} cust={cust} canDo={canDo} moveToUnderwriting={moveToUnderwriting} setDetail={setDetail} />
      ));

    case 'loans':
      return wrap('Loans', (
        <LoansPage day={day} canDoAny={canDoAny} />
      ));

    case 'servicing':
      return wrap('Servicing', (
        <ServicingPage day={day} />
      ));

    case 'collections':
      return wrap('Collections', (
        <CollectionsPage />
      ));

    case 'provisioning':
      return wrap('IFRS 9 Provisioning', (
        <ProvisioningPage />
      ));

    case 'governance':
      return wrap('Governance', (
        <GovernancePage now={now} day={day} PERMS={PERMS} ROLES={ROLES} APPROVAL_LIMITS={APPROVAL_LIMITS} SYSTEM_USERS={SYSTEM_USERS} save={save} />
      ));

    case 'statutory':
      return wrap('Statutory Reporting', (
        <StatutoryReportingPage />
      ));

    case 'documents':
      return wrap('Documents', (
        <DocumentsPage now={now} day={day} />
      ));

    case 'reports':
      return wrap('Reports', (
        <ReportsPage loans={loans} applications={applications} customers={customers} collections={collections} provisions={provisions} audit={audit} cust={cust} canDo={canDo} />
      ));

    case 'investor':
      return wrap('Investor Dashboard', (
        <InvestorDashboard loans={loans} applications={applications} provisions={provisions} customers={customers} prod={prod} />
      ));

    case 'comms':
      return wrap('Communications', (
        <CommsPage />
      ));

    case 'admin':
    case 'products':
    case 'settings': {
      // All three URLs render the same Administration component but with
      // different default tabs (handled internally by AdministrationPage
      // based on permissions or URL hint). Title differs for breadcrumb.
      const titleByPage: Record<string, string> = {
        admin: 'Administration',
        products: 'Products',
        settings: 'Settings',
      };
      return wrap(titleByPage[page], (
        <AdministrationPage now={now} day={day} getProductSecurity={getProductSecurity} ROLES={ROLES} PERMS={PERMS} APPROVAL_LIMITS={APPROVAL_LIMITS} SECURITY_INSTRUMENTS={SECURITY_INSTRUMENTS} />
      ));
    }

    default:
      // Unknown page falls back to Dashboard. Previously this fell back
      // to <Dashboard /> referencing the deleted inline function — a
      // latent bug. Now uses the extracted DashboardPage component.
      return wrap('Dashboard', (
        <DashboardPage predictDelinquency={predictDelinquency} ROLES={ROLES} />
      ));
  }
}
