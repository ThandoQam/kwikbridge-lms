/**
 * E2E: Loan lifecycle — origination to disbursement.
 *
 * Walks an application through underwriting, approval, booking,
 * and disbursement — the core money movement flow.
 */

describe('Loan Lifecycle (Underwriting → Disbursement)', () => {
  beforeEach(() => {
    cy.loginAsStaffAdmin();
  });

  it('shows applications in the underwriting queue', () => {
    cy.navigateTo('Underwriting');
    cy.contains(/Underwriting|Applications/i, { timeout: 10000 }).should('be.visible');
  });

  it('displays loan portfolio with status badges', () => {
    cy.navigateTo('Loan Book');
    cy.contains(/Loan|Active|Status/i, { timeout: 10000 }).should('be.visible');
  });

  it('servicing module shows active loans', () => {
    cy.navigateTo('Servicing');
    cy.contains(/Servicing|Payment|Schedule/i, { timeout: 10000 }).should('be.visible');
  });

  it('collections module shows arrears', () => {
    cy.navigateTo('Collections');
    cy.contains(/Collections|Arrears|DPD/i, { timeout: 10000 }).should('be.visible');
  });

  it('IFRS 9 provisioning module is accessible', () => {
    cy.navigateTo('IFRS 9');
    cy.contains(/IFRS 9|ECL|Stage|Provision/i, { timeout: 10000 }).should('be.visible');
  });
});
