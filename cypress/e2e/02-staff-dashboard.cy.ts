/**
 * E2E: Staff dashboard access and core navigation.
 *
 * Verifies that staff users can log in, see the dashboard,
 * and navigate between modules without errors.
 */

describe('Staff Dashboard & Navigation', () => {
  beforeEach(() => {
    cy.loginAsStaffAdmin();
  });

  it('displays the staff dashboard with portfolio KPIs', () => {
    cy.contains(/Dashboard/i).should('be.visible');
    cy.contains(/Total Loan Book|Portfolio|Active Loans/i).should('be.visible');
  });

  it('navigates to Customers module', () => {
    cy.navigateTo('Customers');
    cy.contains(/Customers|FICA/i, { timeout: 10000 }).should('be.visible');
  });

  it('navigates to Origination module', () => {
    cy.navigateTo('Origination');
    cy.contains(/Origination|Applications/i, { timeout: 10000 }).should('be.visible');
  });

  it('navigates to Underwriting module', () => {
    cy.navigateTo('Underwriting');
    cy.contains(/Underwriting/i, { timeout: 10000 }).should('be.visible');
  });

  it('navigates to Investor View', () => {
    cy.navigateTo('Investor');
    cy.contains(/Investor Dashboard|Portfolio Book|IFRS 9/i, { timeout: 10000 }).should(
      'be.visible'
    );
  });

  it('shows IFRS 9 staging visualisation in investor view', () => {
    cy.navigateTo('Investor');
    cy.contains(/Stage 1.*Performing/i, { timeout: 10000 }).should('be.visible');
    cy.contains(/Stage 2.*Underperforming/i).should('be.visible');
    cy.contains(/Stage 3.*Non-Performing/i).should('be.visible');
  });

  it('error boundary catches and recovers from page errors', () => {
    // Navigate to all major modules — any one crashing should not crash app
    const modules = ['Customers', 'Origination', 'Loan Book', 'Servicing', 'Collections'];
    modules.forEach((m) => {
      cy.navigateTo(m);
      cy.wait(500);
      // App should still be functional (sidebar still rendered)
      cy.get('.kb-sidebar, [class*="sidebar"]').should('be.visible');
    });
  });
});
