# KwikBridge Loan Management System

Cloud-based Loan Management System for **ThandoQ and Associates (Pty) Ltd** — a South African development finance institution (NCR Registration: NCRCP22396).

## Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | Dashboard | Portfolio KPIs, IFRS 9 staging, pipeline, alerts, statutory deadlines |
| 2 | Customer Management | KYC/FICA verification, BEE profiling, risk categorization |
| 3 | Loan Origination | Multi-step application, product catalog, auto-validation |
| 4 | Credit Assessment | 8-step underwriting workflow with per-item verification and sign-off |
| 5 | Active Loans | Portfolio monitoring, covenant tracking, payment history |
| 6 | Loan Servicing | Payment processing, debit orders, statement generation |
| 7 | Collections & Recovery | NCA-compliant 3-stage collections, PTP tracking, restructuring |
| 8 | IFRS 9 Provisioning | ECL calculation, PD/LGD/EAD, 12-month vs lifetime ECL |
| 9 | Governance & Compliance | Audit trail, approval matrix, regulatory framework |
| 10 | NCR Statutory Reporting | Annual reports, Form 39 quarterly returns, deadline tracking |
| 11 | Document Management | Centralized registry, expiry tracking, per-document actions |
| 12 | Reports & Analytics | Portfolio, concentration, impact, regulatory reporting |
| 13 | Communication Center | Omnichannel log (email, phone, SMS, letter, in-person) |

## Regulatory Compliance

- National Credit Act (NCA) 34 of 2005
- Financial Intelligence Centre Act (FICA) 38 of 2001
- Protection of Personal Information Act (POPIA) 4 of 2013
- Debt Collectors Act 114 of 1998
- BB-BEE Act 53 of 2003

## Integrity Checks

Run after every edit:

```bash
python3 check.py src/kwikbridge-lms-v2.jsx
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system architecture, data model, 
workflow states, and stabilization strategy.

## License

Proprietary — ThandoQ and Associates (Pty) Ltd. Confidential.
