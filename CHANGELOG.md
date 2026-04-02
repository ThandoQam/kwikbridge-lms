# Changelog

All notable changes to the KwikBridge LMS.

## [2.3.0] - 2026-04-02
### Added
- GitHub repository and version control
- Architecture documentation (docs/ARCHITECTURE.md)
- Integrity check script (check.py) — validates bracket balance, required functions, handlers, pages, and data entities after every edit
- Stabilization strategy with progressive modularization plan

### Structure
- Project organized: src/, docs/, check.py, README, CHANGELOG
- Full architecture map with line ranges for every section

## [2.2.0] - 2026-04-02
### Added
- Fully interactive underwriting workflow with expandable step panels
- Per-item officer verification: Confirm / Flag / Reject with notes on each KYC check and document
- Document-level actions inside underwriting: Approve Doc, Reject Doc, Request from Applicant
- Site visit form with editable officer observations
- Notification panel to email applicants from within the workflow
- Per-step sign-off requirement — no step auto-completes, officer must review and confirm
- Step gating — credit analysis blocked until KYC and documents are signed off
- Credit memorandum auto-built from all DD step findings and analyst notes

## [2.1.0] - 2026-04-02
### Added
- Structured findings model (array of {item, status, detail, source} per DD step)
- KYC produces reviewable checklist (ID, PoA, Bank, CIPC, Sanctions, PEP)
- Document review produces per-document checklist from registry
- New step: Collateral & Security Assessment with LTV calculation
- Analyst notes textarea included in credit memorandum
- decideLoan preserves DD-computed scores (no longer randomizes on decision)
- Gate logic: credit analysis requires KYC + docs complete first

## [2.0.0] - 2026-04-02
### Added
- Bank-grade light color palette (navy text, white surfaces, no visual noise)
- NCR Statutory Reporting module (annual reports, Form 39 quarterly returns, deadline tracking)
- Centralized document registry (42 documents with full metadata)
- Document categories: KYC, KYB, Financial, Legal, Collateral, Compliance, Collections
- Document expiry tracking with 90-day warning
- Statutory deadline alerts on Dashboard

### Changed
- All UI stripped to zero visual noise: no gradients, no blur, no rounded corners, no colored backgrounds
- Badges: text color + thin border only
- Tabs: underline style instead of pills
- Removed KB icon from sidebar

## [1.0.0] - 2026-04-02
### Initial Release
- 13 modules covering full loan lifecycle
- 6 customers, 6 products, 7 applications, 4 loans
- IFRS 9 provisioning with ECL by stage
- NCA/FICA/POPIA compliance framework
- Immutable audit trail
- Dark theme (later replaced)
