# KwikBridge LMS — Production Readiness Audit

## System Module Map (Sidebar Order)

| # | Module | Sidebar Key | Purpose |
|---|--------|-------------|---------|
| 1 | Dashboard | dashboard | Portfolio KPIs, pipeline, alerts, statutory deadlines |
| 2 | Customers | customers | Customer onboarding, KYC/FICA, BEE, document intake |
| 3 | Origination | origination | Lead capture, application intake, product selection |
| 4 | Underwriting | underwriting | Credit assessment pipeline, DD queue |
| 5 | Active Loans | loans | Portfolio monitoring, covenant tracking |
| 6 | Servicing | servicing | Payment processing, schedules, statements |
| 7 | Collections | collections | Arrears management, PTP, restructuring, write-off |
| 8 | IFRS 9 | provisioning | ECL staging, PD/LGD/EAD, provisioning |
| 9 | Governance | governance | Audit trail, authority matrix, regulatory, alerts |
| 10 | NCR Reporting | statutory | Annual reports, Form 39, deadline tracking |
| 11 | Documents | documents | Centralized registry, expiry, verification |
| 12 | Reports | reports | Portfolio, concentration, impact, outcomes |
| 13 | Communications | comms | Omnichannel log |

## End-to-End Lifecycle

```
Customer Onboarding → Origination → Underwriting (8-step DD) → Approval
  → Loan Booking → Disbursement → Servicing → Collections → Governance/Reporting
```

## Audit Results: 66 Steps, 55% Coverage

| Phase | Steps | Working | Partial | Missing |
|-------|-------|---------|---------|---------|
| 1. Customer Onboarding | 6 | 0 | 1 | 5 |
| 2. Origination | 6 | 3 | 0 | 3 |
| 3. Underwriting | 16 | 16 | 0 | 0 |
| 4. Approval | 5 | 3 | 0 | 2 |
| 5. Loan Booking | 5 | 1 | 0 | 4 |
| 6. Disbursement | 4 | 1 | 0 | 3 |
| 7. Servicing | 6 | 1 | 0 | 5 |
| 8. Collections | 7 | 0 | 2 | 5 |
| 9. Governance | 5 | 4 | 0 | 1 |
| 10. Reporting | 6 | 5 | 0 | 1 |

## RBAC: Currently ABSENT

Zero role-based access control exists. No currentUser, no roles, no permissions.
Every user can do everything. No separation of duties.

## CRUD Gaps

| Entity | C | R | U | D | Critical Gaps |
|--------|---|---|---|---|---------------|
| Customer | ✗ | ✓ | ✗ | ✗ | Cannot create or edit customers |
| Application | ✓ | ✓ | ✓ | ✗ | No cancel/withdraw |
| Loan | ✓ | ✓ | ✓ | ✗ | No close/settle |
| Document | ✗ | ✓ | ✓ | ✗ | Cannot upload new documents |
| Collection | ✓ | ✓ | ✗ | ✗ | Cannot update PTP or restructure |
| Provision | ✓ | ✓ | ✗ | ✗ | Cannot recalculate ECL |

## Remediation Order (Module-by-Module)

### Module 1: RBAC Foundation (prerequisite for all other modules)
Add: currentUser state, role definitions, permission matrix, role-gated rendering.
MUST be done first — every subsequent module depends on it.

### Module 2: Customer Onboarding (customers)
Add: Create customer form, edit customer, FICA status transitions, BEE verification,
document upload, customer approval workflow.

### Module 3: Origination (origination)
Add: Application validation on submit, assignment to Loan Officer, sanctions screening,
application withdraw/cancel.

### Module 4: Approval & Decisioning (underwriting detail)
Add: Authority matrix enforcement, separation of duties, escalation workflow.

### Module 5: Loan Booking & Disbursement (loans)
Add: Separate booking step, conditions precedent check, pre-disbursement AML,
disbursement initiation with dual authorization.

### Module 6: Servicing (servicing)
Add: Amortization schedule, interest/principal split, statement generation,
debit order management.

### Module 7: Collections (collections)
Add: Auto-stage escalation, PTP create/track, restructuring form,
write-off proposal, legal handover.

### Module 8: Governance (governance)
Add: Authority matrix enforcement (code-level), role-based audit filtering.

### Module 9: Reporting (reports)
Add: Export capability, role-filtered views.
