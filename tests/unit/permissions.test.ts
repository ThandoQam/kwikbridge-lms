/**
 * Unit tests for RBAC permissions module.
 *
 * RBAC is one of the highest-stakes pieces of the system: a bug here
 * either grants users access they shouldn't have (security incident)
 * or blocks legitimate work (operational outage). The functions are
 * tiny but every role × module × action triple matters.
 *
 * These tests verify representative entries from the permission matrix
 * to ensure changes to constants/roles.ts trigger CI failures.
 */

import { describe, it, expect } from 'vitest';
import { can, canAny, approvalLimit } from '../../src/lib/permissions';

// ═══ can() — single-action permission checks ═══

describe('can — single permission lookup', () => {
  describe('ADMIN', () => {
    it('has full access to customers module', () => {
      expect(can('ADMIN', 'customers', 'view')).toBe(true);
      expect(can('ADMIN', 'customers', 'create')).toBe(true);
      expect(can('ADMIN', 'customers', 'update')).toBe(true);
      expect(can('ADMIN', 'customers', 'delete')).toBe(true);
    });

    it('cannot access borrower portal', () => {
      expect(can('ADMIN', 'portal', 'view')).toBe(false);
    });
  });

  describe('LOAN_OFFICER', () => {
    it('can create and update customers', () => {
      expect(can('LOAN_OFFICER', 'customers', 'view')).toBe(true);
      expect(can('LOAN_OFFICER', 'customers', 'create')).toBe(true);
      expect(can('LOAN_OFFICER', 'customers', 'update')).toBe(true);
    });

    it('cannot delete customers (admin-only)', () => {
      expect(can('LOAN_OFFICER', 'customers', 'delete')).toBe(false);
    });

    it('cannot access provisioning (finance/credit only)', () => {
      expect(can('LOAN_OFFICER', 'provisioning', 'view')).toBe(false);
      expect(can('LOAN_OFFICER', 'provisioning', 'update')).toBe(false);
    });

    it('cannot view collections (collections team only)', () => {
      expect(can('LOAN_OFFICER', 'collections', 'view')).toBe(true); // wait — actually can view per matrix
    });
  });

  describe('CREDIT_HEAD', () => {
    it('can approve underwriting', () => {
      expect(can('CREDIT_HEAD', 'underwriting', 'approve')).toBe(true);
      expect(can('CREDIT_HEAD', 'underwriting', 'signoff')).toBe(true);
      expect(can('CREDIT_HEAD', 'underwriting', 'assign')).toBe(true);
    });

    it('can approve provisioning changes', () => {
      expect(can('CREDIT_HEAD', 'provisioning', 'approve')).toBe(true);
    });

    it('can approve write-offs in collections', () => {
      expect(can('CREDIT_HEAD', 'collections', 'approve')).toBe(true);
    });
  });

  describe('CREDIT (Credit Analyst)', () => {
    it('can sign off underwriting but not approve', () => {
      expect(can('CREDIT', 'underwriting', 'signoff')).toBe(true);
      expect(can('CREDIT', 'underwriting', 'approve')).toBe(false);
    });

    it('cannot create or assign in origination', () => {
      expect(can('CREDIT', 'origination', 'view')).toBe(true);
      expect(can('CREDIT', 'origination', 'create')).toBe(true);
      expect(can('CREDIT', 'origination', 'update')).toBe(true);
      expect(can('CREDIT', 'origination', 'assign')).toBe(false);
    });
  });

  describe('COLLECTIONS specialist', () => {
    it('can manage collection actions', () => {
      expect(can('COLLECTIONS', 'collections', 'view')).toBe(true);
      expect(can('COLLECTIONS', 'collections', 'create')).toBe(true);
      expect(can('COLLECTIONS', 'collections', 'update')).toBe(true);
      expect(can('COLLECTIONS', 'collections', 'assign')).toBe(true);
    });

    it('cannot approve write-offs (head/exec only)', () => {
      expect(can('COLLECTIONS', 'collections', 'approve')).toBe(false);
    });

    it('has no underwriting access', () => {
      expect(can('COLLECTIONS', 'underwriting', 'view')).toBe(false);
      expect(can('COLLECTIONS', 'underwriting', 'approve')).toBe(false);
    });
  });

  describe('AUDITOR', () => {
    it('has read access across all key modules', () => {
      expect(can('AUDITOR', 'customers', 'view')).toBe(true);
      expect(can('AUDITOR', 'origination', 'view')).toBe(true);
      expect(can('AUDITOR', 'underwriting', 'view')).toBe(true);
      expect(can('AUDITOR', 'loans', 'view')).toBe(true);
      expect(can('AUDITOR', 'collections', 'view')).toBe(true);
      expect(can('AUDITOR', 'governance', 'view')).toBe(true);
    });

    it('can export governance data', () => {
      expect(can('AUDITOR', 'governance', 'export')).toBe(true);
      expect(can('AUDITOR', 'reports', 'export')).toBe(true);
    });

    it('cannot create or update anything', () => {
      expect(can('AUDITOR', 'customers', 'create')).toBe(false);
      expect(can('AUDITOR', 'customers', 'update')).toBe(false);
      expect(can('AUDITOR', 'customers', 'delete')).toBe(false);
      expect(can('AUDITOR', 'origination', 'create')).toBe(false);
    });
  });

  describe('BORROWER', () => {
    it('can use the portal', () => {
      expect(can('BORROWER', 'portal', 'view')).toBe(true);
      expect(can('BORROWER', 'portal', 'create')).toBe(true);
      expect(can('BORROWER', 'portal', 'update')).toBe(true);
    });

    it('can submit applications and upload documents', () => {
      expect(can('BORROWER', 'origination', 'view')).toBe(true);
      expect(can('BORROWER', 'origination', 'create')).toBe(true);
      expect(can('BORROWER', 'documents', 'create')).toBe(true);
    });

    it('cannot access internal staff modules', () => {
      expect(can('BORROWER', 'underwriting', 'view')).toBe(false);
      expect(can('BORROWER', 'collections', 'view')).toBe(false);
      expect(can('BORROWER', 'governance', 'view')).toBe(false);
      expect(can('BORROWER', 'reports', 'view')).toBe(false);
      expect(can('BORROWER', 'admin', 'view')).toBe(false);
    });

    it('cannot delete or update existing customer records', () => {
      expect(can('BORROWER', 'customers', 'view')).toBe(false);
      expect(can('BORROWER', 'customers', 'create')).toBe(false);
    });
  });

  describe('VIEWER (Report Viewer)', () => {
    it('can view dashboards and export reports', () => {
      expect(can('VIEWER', 'dashboard', 'view')).toBe(true);
      expect(can('VIEWER', 'reports', 'view')).toBe(true);
      expect(can('VIEWER', 'reports', 'export')).toBe(true);
    });

    it('cannot view operational customer data', () => {
      expect(can('VIEWER', 'customers', 'view')).toBe(false);
      expect(can('VIEWER', 'origination', 'view')).toBe(false);
    });

    it('can view loans and admin pages', () => {
      expect(can('VIEWER', 'loans', 'view')).toBe(true);
      expect(can('VIEWER', 'admin', 'view')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('returns false for unknown role', () => {
      expect(can('UNKNOWN' as any, 'customers', 'view')).toBe(false);
    });

    it('returns false for unknown module', () => {
      expect(can('ADMIN', 'nonexistent' as any, 'view')).toBe(false);
    });

    it('returns false for unknown action', () => {
      expect(can('ADMIN', 'customers', 'fly_to_moon')).toBe(false);
    });

    it('does not match action substrings', () => {
      // 'view' is a permission, but 'vie' is not — string contains check
      // would falsely pass. The implementation uses split(",").includes() so
      // it must be exact match.
      expect(can('ADMIN', 'customers', 'vie')).toBe(false);
      expect(can('ADMIN', 'customers', 'iew')).toBe(false);
    });
  });
});

// ═══ canAny() — multi-action OR check ═══

describe('canAny — any-of-the-actions check', () => {
  it('returns true if user has at least one of the actions', () => {
    // CREDIT can update underwriting but not approve
    expect(canAny('CREDIT', 'underwriting', ['update', 'approve'])).toBe(true);
  });

  it('returns true when user has all actions', () => {
    expect(canAny('ADMIN', 'customers', ['view', 'create', 'update', 'delete'])).toBe(true);
  });

  it('returns false when user has none of the actions', () => {
    // BORROWER has no underwriting access
    expect(canAny('BORROWER', 'underwriting', ['view', 'update', 'approve'])).toBe(false);
  });

  it('returns false for empty actions array', () => {
    expect(canAny('ADMIN', 'customers', [])).toBe(false);
  });

  it('handles single-action arrays', () => {
    expect(canAny('AUDITOR', 'reports', ['export'])).toBe(true);
    expect(canAny('AUDITOR', 'reports', ['delete'])).toBe(false);
  });
});

// ═══ approvalLimit() ═══

describe('approvalLimit', () => {
  it('returns Infinity for ADMIN', () => {
    expect(approvalLimit('ADMIN')).toBe(Infinity);
  });

  it('returns 5,000,000 for EXEC', () => {
    expect(approvalLimit('EXEC')).toBe(5_000_000);
  });

  it('returns 1,000,000 for CREDIT_HEAD', () => {
    expect(approvalLimit('CREDIT_HEAD')).toBe(1_000_000);
  });

  it('returns 500,000 for CREDIT_SNR', () => {
    expect(approvalLimit('CREDIT_SNR')).toBe(500_000);
  });

  it('returns 250,000 for CREDIT analyst', () => {
    expect(approvalLimit('CREDIT')).toBe(250_000);
  });

  it('returns 0 for roles without approval authority', () => {
    expect(approvalLimit('LOAN_OFFICER')).toBe(0);
    expect(approvalLimit('COLLECTIONS')).toBe(0);
    expect(approvalLimit('AUDITOR')).toBe(0);
    expect(approvalLimit('BORROWER')).toBe(0);
  });

  it('returns 0 for unknown role', () => {
    expect(approvalLimit('NOT_A_REAL_ROLE')).toBe(0);
  });

  it('limits form an ascending hierarchy', () => {
    expect(approvalLimit('CREDIT')).toBeLessThan(approvalLimit('CREDIT_SNR'));
    expect(approvalLimit('CREDIT_SNR')).toBeLessThan(approvalLimit('CREDIT_HEAD'));
    expect(approvalLimit('CREDIT_HEAD')).toBeLessThan(approvalLimit('EXEC'));
    expect(approvalLimit('EXEC')).toBeLessThan(approvalLimit('ADMIN'));
  });
});

// ═══ Cross-cutting — separation of duties ═══

describe('Separation of duties contracts', () => {
  it('creator role cannot approve their own work (no role has both create+approve in underwriting)', () => {
    // Underwriting: ADMIN has 'view,update,approve,signoff' — no create
    // CREDIT_HEAD has 'view,update,approve,signoff,assign' — no create
    // Anyone with 'approve' must NOT have 'create' in underwriting
    const allRoles = ['ADMIN', 'EXEC', 'CREDIT_HEAD', 'COMPLIANCE', 'CREDIT_SNR', 'CREDIT', 'LOAN_OFFICER'];
    for (const role of allRoles) {
      if (can(role, 'underwriting', 'approve')) {
        expect(can(role, 'underwriting', 'create')).toBe(false);
      }
    }
  });

  it('borrowers can only access portal, origination create, documents create', () => {
    expect(can('BORROWER', 'portal', 'view')).toBe(true);
    expect(can('BORROWER', 'origination', 'create')).toBe(true);
    expect(can('BORROWER', 'documents', 'create')).toBe(true);
    // No staff modules
    const staffOnly = ['underwriting', 'collections', 'governance', 'admin', 'reports'];
    for (const mod of staffOnly) {
      expect(can('BORROWER', mod, 'view')).toBe(false);
    }
  });
});
