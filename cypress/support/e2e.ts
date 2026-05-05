/**
 * Cypress E2E support — global hooks and custom commands.
 *
 * Loaded by every spec file via cypress.config.ts.
 */

// Suppress uncaught exceptions from third-party scripts that don't
// affect our test outcomes (e.g. analytics SDK loading failures)
Cypress.on('uncaught:exception', (err) => {
  // Returning false here prevents Cypress from failing the test
  if (err.message.includes('ResizeObserver')) return false;
  if (err.message.includes('Sentry')) return false;
  if (err.message.includes('posthog')) return false;
  return true;
});

// Custom command: log in via the dev access bypass (Staff Admin button)
Cypress.Commands.add('loginAsStaffAdmin', () => {
  cy.visit('/');
  // The "Staff (Admin)" dev access button is on the auth page
  cy.contains('button', /Staff \(Admin\)|Staff Admin/i, { timeout: 10000 }).click();
  cy.contains(/Dashboard/i, { timeout: 10000 }).should('be.visible');
});

// Custom command: log in as borrower via dev access
Cypress.Commands.add('loginAsBorrower', () => {
  cy.visit('/');
  cy.contains('button', /Borrower Portal|Borrower/i, { timeout: 10000 }).click();
  cy.contains(/Welcome|Borrower Portal|Applications/i, { timeout: 10000 }).should('be.visible');
});

// Custom command: navigate to a sidebar module by label
Cypress.Commands.add('navigateTo', (label: string) => {
  cy.get('.kb-sidebar, [class*="sidebar"]').contains(label).click();
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginAsStaffAdmin(): Chainable<void>;
      loginAsBorrower(): Chainable<void>;
      navigateTo(label: string): Chainable<void>;
    }
  }
}

export {};
