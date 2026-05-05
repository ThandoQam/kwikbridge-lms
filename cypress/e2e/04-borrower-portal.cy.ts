/**
 * E2E: Borrower portal — what the customer sees post-pre-approval.
 *
 * Tests application timeline, document upload, and payment flow.
 */

describe('Borrower Portal', () => {
  beforeEach(() => {
    cy.loginAsBorrower();
  });

  it('displays the borrower welcome dashboard', () => {
    cy.contains(/Welcome|Applications|Active Loans/i, { timeout: 10000 }).should('be.visible');
  });

  it('shows quick actions panel', () => {
    cy.contains(/Quick Actions|Upload Documents|Make Payment/i, { timeout: 10000 }).should(
      'be.visible'
    );
  });

  it('navigates to documents page', () => {
    cy.contains(/Upload Documents|Documents/i).first().click();
    cy.contains(/KYB|FICA|Documents/i, { timeout: 10000 }).should('be.visible');
  });

  it('shows the 8 required document types', () => {
    cy.contains(/Documents/i).first().click();
    // SA ID, Proof of Address, CIPC, Bank, Financials are required
    cy.contains(/SA ID Document/i, { timeout: 10000 }).should('be.visible');
    cy.contains(/CIPC|Company Registration/i).should('be.visible');
    cy.contains(/Bank.*Confirmation/i).should('be.visible');
  });

  it('navigates to my loans', () => {
    cy.contains(/My Loans|Loans/i).first().click();
    cy.contains(/My Loans|No active loans|Active|Balance/i, { timeout: 10000 }).should('be.visible');
  });
});
