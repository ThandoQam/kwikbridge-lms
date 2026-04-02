# KwikBridge LMS — Architecture & Stabilization Guide

## 1. Project Overview

KwikBridge is a cloud-based Loan Management System for ThandoQ and Associates (Pty) Ltd, 
a development finance institution registered with the NCR (NCRCP22396). The system manages
the full loan lifecycle: origination, underwriting, disbursement, servicing, collections,
provisioning, governance, and statutory reporting.

**Current state:** Single-file React artifact (~2000 lines, ~186KB) running inside Claude.ai.  
**Target state:** Modular multi-file React application with version control and test coverage.

---

## 2. Stabilization Strategy

### Problem
As the codebase grows inside a single JSX file, every edit risks cascading breakage. 
The file has 2400+ brace pairs, 1300+ paren pairs, 33 functions, and 18 state variables 
all in one component. One misplaced character collapses the entire system.

### Strategy: Progressive Modularization

**Phase 1 (Current) — Single-file with guardrails:**
- Architecture map maintained in this document
- Section markers with line ranges
- Integrity checks (brace/paren balance) run after every edit
- Seed data and handlers clearly separated from rendering
- Git version control for rollback safety

**Phase 2 — Extract data layer:**
- `src/data/seed.js` — all seed data (customers, products, applications, loans, documents, etc.)
- `src/data/constants.js` — colors, icons, format helpers
- `src/data/storage.js` — storage read/write abstraction

**Phase 3 — Extract handlers:**
- `src/handlers/application.js` — submitApp, moveToUnderwriting, runDDStep, decideLoan
- `src/handlers/underwriting.js` — actionFindingItem, signOffStep, saveAnalystNotes
- `src/handlers/documents.js` — approveDocument, rejectDocument, requestDocFromApplicant
- `src/handlers/servicing.js` — recordPayment, addCollectionAction
- `src/handlers/notifications.js` — sendNotification, saveSiteVisitNotes

**Phase 4 — Extract pages:**
- One file per page (Dashboard.jsx, Customers.jsx, etc.)
- Shared components in `src/components/`

**Phase 5 — Testing:**
- Unit tests for handlers (pure functions)
- Snapshot tests for page components
- Integration tests for workflow sequences

---

## 3. File Architecture Map (Current Single-File)

```
Line     Section
──────── ─────────────────────────────────────────
1-40     Imports, helpers, constants
41-53    Color system
56-243   Seed data function
         ├─ 57-65    Customers (6)
         ├─ 67-73    Products (6)
         ├─ 75-93    Applications (7)
         ├─ 95-112   Loans (4)
         ├─ 113-135  Collections (9)
         ├─ 136-152  Alerts (8) + Comms (6)
         ├─ 155-208  Document Registry (42)
         └─ 209-243  Statutory Reports (10) + Settings

244-274  SVG Icons (I object)

275-435  Reusable Components
         ├─ Badge, statusBadge
         ├─ KPI
         ├─ Btn
         ├─ Table
         ├─ Modal
         ├─ Field, Input, Select, Textarea
         ├─ Tab
         ├─ ProgressBar
         ├─ InfoGrid
         ├─ SectionCard
         └─ StepTracker

439-825  Main App Component (state, handlers)
         ├─ 439-466  State declarations, storage load
         ├─ 468-487  Nav items, helpers
         ├─ 489-500  submitApp handler
         ├─ 501-610  Underwriting handlers
         │   ├─ moveToUnderwriting
         │   ├─ saveAnalystNotes
         │   ├─ actionFindingItem
         │   ├─ updateFindingNote
         │   ├─ signOffStep
         │   ├─ approveDocument / rejectDocument
         │   ├─ requestDocFromApplicant / sendNotification
         │   └─ saveSiteVisitNotes
         ├─ 611-766  runDDStep (KYC, Docs, SiteVisit, Credit, Collateral, Social)
         ├─ 768-805  decideLoan
         └─ 806-825  recordPayment, addCollectionAction

827-844  Page Router (renderPage)

848-1610 Page Components
         ├─ 848-945   Dashboard
         ├─ 946-966   Customers
         ├─ 967-990   Origination
         ├─ 991-1021  Underwriting
         ├─ 1022-1046 Active Loans
         ├─ 1047-1074 Servicing
         ├─ 1075-1119 Collections
         ├─ 1120-1161 IFRS 9 Provisioning
         ├─ 1162-1227 Governance
         ├─ 1228-1445 Statutory Reporting
         ├─ 1446-1552 Documents
         ├─ 1553-1594 Reports
         └─ 1595-1611 Communications

1612-1910 Detail Views
         ├─ 1617-1840 Application Detail (underwriting workflow)
         └─ 1841-1910 Loan Detail

1912-1932 New Application Modal
1934-2005 Layout Shell (sidebar, header, main)
```

---

## 4. Data Model

### Entities and Relationships

```
Customer (C001-C006)
  ├── Applications (APP-001 to APP-007)
  │     ├── workflow: {} (KYC, docs, sitevisit, credit, collateral, social)
  │     └── → Loan (LN-001 to LN-004) [if approved]
  │           ├── payments: []
  │           ├── covenants: []
  │           ├── collateral: []
  │           └── → Collections entries
  ├── Documents (DOC-001 to DOC-042)
  │     linked to: custId, appId?, loanId?
  └── Communications entries

Standalone:
  ├── Products (P001-P006)
  ├── Alerts
  ├── Audit Trail
  ├── Provisions (IFRS 9)
  └── Statutory Reports (SR-001 to SR-010)
```

### Application Workflow States

```
Submitted → [Start DD] → Underwriting → [Complete all 7 steps] → Approved/Declined
                                │
                                ├─ Step 2: KYC (Run → Review items → Confirm/Flag/Reject each → Sign Off)
                                ├─ Step 3: Docs (Run → Review items → Approve/Reject/Request docs → Sign Off)
                                ├─ Step 4: Site Visit (Generate → Add notes → Sign Off)
                                ├─ Step 5: Credit (Gate: steps 2&3 done → Pull → Review → Confirm)
                                ├─ Step 6: Collateral (Run → Review → Confirm)
                                └─ Step 7: Social Impact (Run → Review → Confirm)
```

---

## 5. Integrity Checks

Run after every edit to ensure the file hasn't broken:

```python
t = open('kwikbridge-lms-v2.jsx').read()
assert t.count('{') == t.count('}'), f"Brace mismatch: {t.count('{')}/{t.count('}')}"
assert t.count('(') == t.count(')'), f"Paren mismatch: {t.count('(')}/{t.count(')')}"
assert 'export default' in t, "Missing export default"
assert t.count('function App') == 1, "Missing or duplicate App function"
print(f"OK: {len(t.split(chr(10)))} lines, {t.count('{')}/{t.count('}')} braces balanced")
```

---

## 6. Edit Safety Rules

1. **Always view before editing.** Never edit from memory — the file changes with every edit.
2. **Run integrity check after every str_replace.** Catch breakage immediately.
3. **One concern per edit.** Don't combine unrelated changes.
4. **Search before replace.** Verify the target string exists exactly once (or know how many).
5. **Test the boundaries.** After editing a function, verify the function that follows it still starts correctly.

---

## 7. Regulatory Compliance Reference

- **NCA** — National Credit Act 34 of 2005 (affordability, disclosure, consumer protection)
- **FICA** — Financial Intelligence Centre Act 38 of 2001 (KYC, sanctions, STR)
- **POPIA** — Protection of Personal Information Act 4 of 2013 (data privacy)
- **Debt Collectors Act** — 114 of 1998 (collection conduct)
- **BB-BEE Act** — 53 of 2003 (empowerment verification)
- **NCR Registration** — NCRCP22396, expires 31 July 2026
- **Form 39** — Quarterly if disbursements > R15M (due: 15 May, 15 Aug, 15 Nov, 15 Feb)
- **Annual Reports** — Due within 6 months of year-end (submissions@ncr.org.za)

---

## 8. Version History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0     | 2026-04-02 | Initial build — 13 modules, dark theme |
| 2.0     | 2026-04-02 | Bank-grade light theme, statutory reporting, document registry |
| 2.1     | 2026-04-02 | Interactive underwriting workflow with per-item verification |
| 2.2     | 2026-04-02 | Full DD workflow with sign-off, doc actions, notifications |
| 2.3     | 2026-04-02 | Stabilization — GitHub, architecture docs, modular structure |
