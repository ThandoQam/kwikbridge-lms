-- ═══════════════════════════════════════════════════════════════
-- KwikBridge LMS — Demo Seed Data
-- ═══════════════════════════════════════════════════════════════
-- 10 realistic Eastern Cape SME customers
-- 10 applications across all stages
-- 5 active loans (3 performing, 1 in arrears, 1 settled)
-- Payments, collections, provisions, audit trail, documents
--
-- Run this in Supabase Dashboard → SQL Editor after migrations.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════

-- Timestamps (relative to "now" = April 2026)
-- We use epoch milliseconds to match the app's convention

-- ═══ ENSURE ALL COLUMNS EXIST (patches for older schemas) ═══
ALTER TABLE customers ADD COLUMN IF NOT EXISTS social_score NUMERIC DEFAULT 0;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS underwriting_workflow JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sanctions_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sanctions_date BIGINT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS accrued_interest NUMERIC DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at BIGINT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS loan_id TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE comms ADD COLUMN IF NOT EXISTS related_to TEXT;
ALTER TABLE comms ADD COLUMN IF NOT EXISTS loan_id TEXT;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS loan_id TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS category TEXT;

-- ═══ PRODUCTS (seed only if empty) ═══
-- Add missing columns if they don't exist (safe for re-runs)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ideal_for TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS s1_pd NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ecl NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lgd NUMERIC DEFAULT 0;

INSERT INTO products (id, name, description, ideal_for, min_amount, max_amount, min_term, max_term, base_rate, monthly_rate, repayment_type, arrangement_fee, commitment_fee, grace_period, max_ltv, min_dscr, risk_class, ecl, s1_pd, lgd, eligible_bee, eligible_industries, status, created_by, created_at)
VALUES
  ('P001', 'PO Financing — ECDoE', 'Government purchase order financing for Eastern Cape Department of Education contractors.', 'ECDoE-contracted suppliers and service providers.', 1000000, 7500000, 3, 6, 42.0, 3.5, 'Bullet', 2.5, 0.5, 0, 90, 1.15, 'A', 0.70, 0.006, 0.22, '[1,2,3,4]', '["Education","Construction","Services"]', 'Active', 'SYSTEM', 1711929600000),
  ('P002', 'Invoice — Scholar Transport', 'Invoice discounting for scholar transport operators with confirmed ECDoE contracts.', 'Scholar transport operators with verified ECDoE invoices.', 10000, 150000, 1, 2, 30.0, 2.5, 'Bullet', 2.0, 0, 0, 80, 1.0, 'A', 0.76, 0.006, 0.23, '[1,2,3,4,5,6,7,8]', '["Transport","Education"]', 'Active', 'SYSTEM', 1711929600000),
  ('P003', 'Invoice — Road Maintenance', 'Invoice discounting for road maintenance contractors with ECDoT verified invoices.', 'Road maintenance contractors with ECDoT invoices.', 50000, 1000000, 1, 1, 30.0, 2.5, 'Bullet', 2.0, 0, 0, 85, 1.0, 'A', 0.80, 0.008, 0.25, '[1,2,3,4,5,6,7,8]', '["Construction","Transport","Infrastructure"]', 'Active', 'SYSTEM', 1711929600000),
  ('P004', 'Asset Finance — Fleet', 'Vehicle and fleet financing for government-contracted transport operators.', 'Transport operators needing fleet expansion for government contracts.', 150000, 3000000, 12, 60, 16.5, 1.375, 'Amortising', 2.0, 0.25, 0, 80, 1.3, 'B', 1.20, 0.012, 0.30, '[1,2,3,4,5]', '["Transport","Logistics","Construction"]', 'Active', 'SYSTEM', 1711929600000),
  ('P005', 'Working Capital — SME', 'Short-term working capital facility for established SMEs with government contracts.', 'SMEs needing bridging finance for operational expenses.', 50000, 2000000, 3, 12, 24.0, 2.0, 'Amortising', 1.5, 0.5, 1, 70, 1.2, 'B', 1.50, 0.015, 0.28, '[1,2,3,4,5,6]', '["Manufacturing","Services","Construction","Agriculture"]', 'Active', 'SYSTEM', 1711929600000),
  ('P006', 'Micro Enterprise Loan', 'Small business loans for emerging entrepreneurs in township and rural economies.', 'Micro enterprises, spaza shops, and emerging entrepreneurs.', 5000, 50000, 3, 12, 36.0, 3.0, 'Amortising', 3.0, 0, 0, 0, 1.0, 'C', 3.50, 0.035, 0.40, '[1,2,3,4,5,6,7,8]', '["Retail","Services","Agriculture","Manufacturing"]', 'Active', 'SYSTEM', 1711929600000),
  ('P007', 'Contract-Backed Term Loan', 'Medium-term financing secured by confirmed government or corporate contracts.', 'Businesses with signed multi-year contracts needing capital for delivery.', 500000, 5000000, 6, 36, 18.0, 1.5, 'Amortising', 2.0, 0.5, 2, 75, 1.25, 'B', 1.00, 0.010, 0.25, '[1,2,3,4]', '["Construction","Services","Manufacturing","Technology"]', 'Active', 'SYSTEM', 1711929600000)
ON CONFLICT (id) DO NOTHING;

-- ═══ CUSTOMERS — 10 realistic Eastern Cape SMEs ═══
INSERT INTO customers (id, name, contact, email, phone, id_num, reg_num, industry, revenue, employees, years, address, province, fica_status, bee_status, bee_level, women_owned, youth_owned, disability_owned, created_at, created_by)
VALUES
  ('C001', 'Mthatha Building Supplies (Pty) Ltd', 'Sipho Ndamase', 'sipho@mbs-group.co.za', '047 531 2200', '7805155123081', '2012/145678/07', 'Construction', 12500000, 35, 14, '22 Sutherland Street, Mthatha', 'Eastern Cape', 'Verified', 'Level 1', 1, 100, 0, 0, 1704067200000, 'SYSTEM'),
  
  ('C002', 'Ikhwezi Scholar Transport CC', 'Nomfundo Sigcawu', 'nomfundo@ikhwezi.co.za', '043 722 1850', '8201260234089', '2015/287654/23', 'Transport', 4200000, 18, 11, '15 Buffalo Road, King William''s Town', 'Eastern Cape', 'Verified', 'Level 2', 2, 65, 0, 0, 1704067200000, 'SYSTEM'),
  
  ('C003', 'Ubuntu Catering & Events (Pty) Ltd', 'Thandi Madikizela', 'thandi@ubuntucatering.co.za', '041 585 3300', '8506150345087', '2018/398765/07', 'Services', 3800000, 22, 8, '48 Ring Road, Greenacres, Gqeberha', 'Eastern Cape', 'Verified', 'Level 1', 1, 80, 35, 0, 1704067200000, 'SYSTEM'),
  
  ('C004', 'Xhosa Digital Solutions (Pty) Ltd', 'Luyanda Maqubela', 'luyanda@xhosadigital.co.za', '043 748 2100', '9203120456082', '2020/456789/07', 'Technology', 2100000, 12, 6, '3rd Floor, Beacon Bay Crossing, East London', 'Eastern Cape', 'Verified', 'Level 2', 2, 30, 70, 0, 1704067200000, 'SYSTEM'),
  
  ('C005', 'Amathole Road Services CC', 'Mandla Jali', 'mandla@amatholeroads.co.za', '040 635 1700', '7608250567086', '2010/567890/23', 'Infrastructure', 18000000, 85, 16, 'Industrial Park, Fort Beaufort Road, Alice', 'Eastern Cape', 'Verified', 'Level 1', 1, 51, 0, 0, 1704067200000, 'SYSTEM'),
  
  ('C006', 'Motherwell Fresh Produce (Pty) Ltd', 'Zukiswa Nqweniso', 'zuki@motherwellfresh.co.za', '041 461 2800', '8809180678085', '2019/678901/07', 'Agriculture', 1800000, 8, 7, 'Plot 42, Motherwell NU30, Gqeberha', 'Eastern Cape', 'Verified', 'Level 3', 3, 100, 40, 0, 1704067200000, 'SYSTEM'),
  
  ('C007', 'Mdantsane Auto Repairs (Pty) Ltd', 'Vuyani Plaatjie', 'vuyani@mdantsaneauto.co.za', '043 761 5500', '8104100789083', '2013/789012/07', 'Manufacturing', 5600000, 14, 13, '120 NU12 Main Road, Mdantsane', 'Eastern Cape', 'Verified', 'Level 2', 2, 0, 0, 25, 1704067200000, 'SYSTEM'),
  
  ('C008', 'Ngqura Logistics (Pty) Ltd', 'Ayanda Gqirana', 'ayanda@ngqura.co.za', '041 407 8800', '8712050890081', '2016/890123/07', 'Logistics', 9500000, 42, 10, 'Coega IDZ, Zone 1, Gqeberha', 'Eastern Cape', 'Verified', 'Level 1', 1, 45, 55, 0, 1704067200000, 'SYSTEM'),
  
  ('C009', 'Sunflower Spaza Wholesale', 'Nosipho Dyantyi', 'nosipho@sunflowerspaza.co.za', '047 532 4100', '9105200901087', '2022/901234/07', 'Retail', 650000, 3, 4, '78 Nelson Mandela Drive, Mthatha', 'Eastern Cape', 'Verified', 'Level 4', 4, 100, 100, 0, 1704067200000, 'SYSTEM'),
  
  ('C010', 'Eastern Cape Security Group (Pty) Ltd', 'Bongani Matshoba', 'bongani@ecsecurity.co.za', '043 743 6600', '7502150012089', '2008/012345/07', 'Services', 22000000, 180, 18, '55 Oxford Street, East London CBD', 'Eastern Cape', 'Verified', 'Level 2', 2, 40, 10, 5, 1704067200000, 'SYSTEM')
ON CONFLICT (id) DO NOTHING;

-- ═══ APPLICATIONS — 10 at different stages ═══
INSERT INTO applications (id, cust_id, product, amount, term, rate, purpose, status, submitted, decided, approver, recommendation, social_score, sanctions_flag, created_at, created_by)
VALUES
  -- 1. DRAFT — just started, not yet submitted
  ('APP-001', 'C009', 'P006', 25000, 6, 36.0, 'Stock replenishment for winter season — bulk purchase of cooking oil, maize meal, and cleaning products from Makro.', 'Draft', NULL, NULL, NULL, NULL, 72, FALSE, 1743465600000, 'C009'),

  -- 2. SUBMITTED — awaiting loan officer review
  ('APP-002', 'C006', 'P005', 350000, 12, 24.0, 'Irrigation system upgrade and cold storage installation for fresh produce distribution to Pick n Pay and Spar stores.', 'Submitted', 1743552000000, NULL, NULL, NULL, 85, FALSE, 1743465600000, 'C006'),

  -- 3. UNDERWRITING — in credit analysis
  ('APP-003', 'C004', 'P007', 1200000, 24, 18.0, 'Digital transformation project for ECDoE — laptop procurement, network installation, and LMS deployment for 15 rural schools.', 'Underwriting', 1742860800000, NULL, NULL, NULL, 92, FALSE, 1742774400000, 'C004'),

  -- 4. APPROVED — awaiting disbursement
  ('APP-004', 'C003', 'P005', 500000, 9, 24.0, 'Working capital for Eastern Cape Premier''s Office catering contract — equipment hire, staffing, and procurement for 6-month engagement.', 'Approved', 1742256000000, 1742860800000, 'Thabo Mokoena (Head of Credit)', 'Approve', 88, FALSE, 1742169600000, 'C003'),

  -- 5. BOOKED — loan created and active (performing well)
  ('APP-005', 'C001', 'P001', 3500000, 6, 42.0, 'PO financing for ECDoE school renovation programme — Lot 7: Mthatha District. Purchase order MBD-2024-7892 confirmed.', 'Booked', 1738368000000, 1738972800000, 'Thabo Mokoena (Head of Credit)', 'Approve', 90, FALSE, 1738281600000, 'C001'),

  -- 6. BOOKED — active loan (performing)
  ('APP-006', 'C002', 'P002', 120000, 2, 30.0, 'Invoice discounting — ECDoE scholar transport invoice INV-2025-4521 for Amathole District school routes.', 'Booked', 1740787200000, 1741132800000, 'Credit Analyst', 'Approve', 78, FALSE, 1740700800000, 'C002'),

  -- 7. BOOKED — active loan (IN ARREARS — 45 DPD)
  ('APP-007', 'C007', 'P004', 850000, 48, 16.5, 'Fleet expansion — 2x Hyundai H-100 panel vans and 1x Toyota Hilux for mobile auto repair service across Amathole District.', 'Booked', 1735689600000, 1736294400000, 'Thabo Mokoena (Head of Credit)', 'Approve', 65, FALSE, 1735603200000, 'C007'),

  -- 8. BOOKED — settled loan (fully repaid)
  ('APP-008', 'C005', 'P003', 750000, 1, 30.0, 'Invoice discounting — ECDoT road maintenance invoice for R1M for Amathole District gravel roads programme.', 'Booked', 1730419200000, 1730764800000, 'Credit Analyst', 'Approve', 82, FALSE, 1730332800000, 'C005'),

  -- 9. DECLINED — failed credit assessment
  ('APP-009', 'C010', 'P007', 4500000, 36, 18.0, 'Expansion of security operations to Sarah Baartman District — 50 additional guards, control room setup, and vehicle fleet.', 'Declined', 1741996800000, 1742601600000, 'Thabo Mokoena (Head of Credit)', 'Decline', 55, FALSE, 1741910400000, 'C010'),

  -- 10. BOOKED — active loan (performing, 3 months in)
  ('APP-010', 'C008', 'P007', 2000000, 24, 18.0, 'Contract-backed financing for Coega IDZ logistics infrastructure — container yard expansion and forklift procurement.', 'Booked', 1738368000000, 1738972800000, 'Credit Committee', 'Approve', 91, FALSE, 1738281600000, 'C008')
ON CONFLICT (id) DO NOTHING;

-- ═══ LOANS — 5 loans (3 performing, 1 in arrears, 1 settled) ═══

-- Loan 1: Mthatha Building — PO Finance, Active, Performing
INSERT INTO loans (id, cust_id, app_id, product, amount, balance, rate, term, monthly_pmt, status, dpd, stage, next_due, disbursed, disbursed_by, booked_by, booked_at, payments, ptp_history, arrangement_fee, total_paid)
VALUES (
  'LN-001', 'C001', 'APP-005', 'P001', 3500000, 3500000, 42.0, 6, 0, 'Active', 0, 1,
  EXTRACT(EPOCH FROM (CURRENT_DATE + INTERVAL '15 days')) * 1000,
  1739577600000, 'Finance Dept', 'Thabo Mokoena', 1739577600000,
  '[]'::jsonb,
  '[]'::jsonb,
  87500, 0
) ON CONFLICT (id) DO NOTHING;

-- Loan 2: Ikhwezi Transport — Invoice, Active, Performing
INSERT INTO loans (id, cust_id, app_id, product, amount, balance, rate, term, monthly_pmt, status, dpd, stage, next_due, disbursed, disbursed_by, booked_by, booked_at, payments, ptp_history, arrangement_fee, total_paid)
VALUES (
  'LN-002', 'C002', 'APP-006', 'P002', 120000, 65000, 30.0, 2, 0, 'Active', 0, 1,
  EXTRACT(EPOCH FROM (CURRENT_DATE + INTERVAL '8 days')) * 1000,
  1741737600000, 'Finance Dept', 'Credit Analyst', 1741737600000,
  '[{"id":"PMT-001","amount":58000,"interest":3000,"principal":55000,"date":1742342400000,"method":"EFT","ref":"IKH-2025-001"}]'::jsonb,
  '[]'::jsonb,
  2400, 58000
) ON CONFLICT (id) DO NOTHING;

-- Loan 3: Mdantsane Auto — Fleet Finance, Active, IN ARREARS (45 DPD)
INSERT INTO loans (id, cust_id, app_id, product, amount, balance, rate, term, monthly_pmt, status, dpd, stage, next_due, disbursed, disbursed_by, booked_by, booked_at, payments, ptp_history, arrangement_fee, total_paid)
VALUES (
  'LN-003', 'C007', 'APP-007', 'P004', 850000, 782000, 16.5, 48, 24150, 'Active', 45, 2,
  EXTRACT(EPOCH FROM (CURRENT_DATE - INTERVAL '45 days')) * 1000,
  1736899200000, 'Finance Dept', 'Thabo Mokoena', 1736899200000,
  '[{"id":"PMT-002","amount":24150,"interest":11688,"principal":12462,"date":1737504000000,"method":"Debit Order","ref":"MDA-2025-001"},{"id":"PMT-003","amount":24150,"interest":11520,"principal":12630,"date":1740182400000,"method":"Debit Order","ref":"MDA-2025-002"}]'::jsonb,
  '[{"date":"2026-03-15","amount":24150,"notes":"Customer promised payment by 15 March. Vehicle breakdown affected cash flow.","submittedBy":"Collections Specialist","submittedAt":1741564800000}]'::jsonb,
  17000, 48300
) ON CONFLICT (id) DO NOTHING;

-- Loan 4: Amathole Roads — Invoice, Settled (fully repaid)
INSERT INTO loans (id, cust_id, app_id, product, amount, balance, rate, term, monthly_pmt, status, dpd, stage, next_due, disbursed, disbursed_by, booked_by, booked_at, payments, ptp_history, arrangement_fee, total_paid)
VALUES (
  'LN-004', 'C005', 'APP-008', 'P003', 750000, 0, 30.0, 1, 0, 'Settled', 0, 1,
  1733097600000,
  1731369600000, 'Finance Dept', 'Credit Analyst', 1731369600000,
  '[{"id":"PMT-004","amount":768750,"interest":18750,"principal":750000,"date":1733011200000,"method":"EFT","ref":"AMR-2025-001"}]'::jsonb,
  '[]'::jsonb,
  15000, 768750
) ON CONFLICT (id) DO NOTHING;

-- Loan 5: Ngqura Logistics — Contract Term Loan, Active, Performing (3 months in)
INSERT INTO loans (id, cust_id, app_id, product, amount, balance, rate, term, monthly_pmt, status, dpd, stage, next_due, disbursed, disbursed_by, booked_by, booked_at, payments, ptp_history, arrangement_fee, total_paid)
VALUES (
  'LN-005', 'C008', 'APP-010', 'P007', 2000000, 1856000, 18.0, 24, 99640, 'Active', 0, 1,
  EXTRACT(EPOCH FROM (CURRENT_DATE + INTERVAL '20 days')) * 1000,
  1739577600000, 'Finance Dept', 'Credit Committee', 1739577600000,
  '[{"id":"PMT-005","amount":99640,"interest":30000,"principal":69640,"date":1740182400000,"method":"Debit Order","ref":"NGQ-2025-001"},{"id":"PMT-006","amount":99640,"interest":28955,"principal":70685,"date":1742860800000,"method":"Debit Order","ref":"NGQ-2025-002"},{"id":"PMT-007","amount":99640,"interest":27894,"principal":71746,"date":1745452800000,"method":"Debit Order","ref":"NGQ-2025-003"}]'::jsonb,
  '[]'::jsonb,
  40000, 298920
) ON CONFLICT (id) DO NOTHING;

-- ═══ PROVISIONS — IFRS 9 ECL for active loans ═══
INSERT INTO provisions (id, loan_id, stage, pd, lgd, ead, ecl, method)
VALUES
  ('PROV-001', 'LN-001', 1, 0.006, 0.22, 3500000, 4620, '12-month ECL'),
  ('PROV-002', 'LN-002', 1, 0.006, 0.23, 65000, 90, '12-month ECL'),
  ('PROV-003', 'LN-003', 2, 0.036, 0.30, 782000, 8453, 'Lifetime ECL'),
  ('PROV-005', 'LN-005', 1, 0.010, 0.25, 1856000, 4640, '12-month ECL')
ON CONFLICT (id) DO NOTHING;

-- ═══ COLLECTIONS — Actions on the arrears account ═══
INSERT INTO collections (id, loan_id, action, notes, officer, ts, channel)
VALUES
  ('COL-001', 'LN-003', 'SMS Reminder', 'Automated SMS sent: "Dear Vuyani, your payment of R24,150 is overdue. Please make payment or contact us."', 'SYSTEM', 1743033600000, 'SMS'),
  ('COL-002', 'LN-003', 'Phone Call', 'Contacted customer. Explained vehicle breakdown impacted cash flow. Customer cooperative, requested 2-week extension.', 'Noluthando Mgquba', 1743292800000, 'Phone'),
  ('COL-003', 'LN-003', 'Promise to Pay', 'PTP secured: R24,150 by 15 March 2026. Customer will use insurance payout from vehicle repair claim.', 'Noluthando Mgquba', 1741564800000, 'Phone'),
  ('COL-004', 'LN-003', 'PTP Broken', 'PTP of R24,150 due 15 March not honoured. Insurance claim still pending. Escalating to formal demand.', 'SYSTEM', 1742428800000, 'System'),
  ('COL-005', 'LN-003', 'Letter of Demand', 'Formal NCA Section 129 notice issued. 20 business days to respond before further action.', 'Noluthando Mgquba', 1742688000000, 'Post')
ON CONFLICT (id) DO NOTHING;

-- ═══ DOCUMENTS — Sample uploads per customer ═══
INSERT INTO documents (id, cust_id, app_id, name, type, status, uploaded_at, uploaded_by, reviewed_by, reviewed_at, notes)
VALUES
  ('DOC-001', 'C001', 'APP-005', 'Sipho Ndamase ID', 'ID Document', 'Verified', 1738368000000, 'C001', 'Loan Officer', 1738454400000, 'SA ID verified against Home Affairs.'),
  ('DOC-002', 'C001', 'APP-005', 'MBS CIPC Certificate', 'Company Registration', 'Verified', 1738368000000, 'C001', 'Loan Officer', 1738454400000, 'CIPC registration 2012/145678/07 confirmed.'),
  ('DOC-003', 'C001', 'APP-005', 'MBS Financial Statements FY2025', 'Financial Statements', 'Verified', 1738368000000, 'C001', 'Credit Analyst', 1738540800000, 'Signed AFS for year ended Feb 2025.'),
  ('DOC-004', 'C001', 'APP-005', 'ECDoE Purchase Order MBD-2024-7892', 'Contract/PO', 'Verified', 1738368000000, 'C001', 'Credit Analyst', 1738540800000, 'Purchase order confirmed with ECDoE procurement.'),
  ('DOC-005', 'C001', 'APP-005', 'BEE Certificate — Level 1', 'BEE Certificate', 'Verified', 1738368000000, 'C001', 'Compliance', 1738540800000, 'Level 1 BEE, 100% Black-owned.'),
  ('DOC-006', 'C007', 'APP-007', 'Vuyani Plaatjie ID', 'ID Document', 'Verified', 1735689600000, 'C007', 'Loan Officer', 1735776000000, 'SA ID verified.'),
  ('DOC-007', 'C007', 'APP-007', 'Mdantsane Auto CIPC', 'Company Registration', 'Verified', 1735689600000, 'C007', 'Loan Officer', 1735776000000, 'Verified.'),
  ('DOC-008', 'C003', 'APP-004', 'Thandi Madikizela ID', 'ID Document', 'Verified', 1742256000000, 'C003', 'Loan Officer', 1742342400000, 'SA ID verified.'),
  ('DOC-009', 'C004', 'APP-003', 'Xhosa Digital CIPC', 'Company Registration', 'Pending Review', 1742860800000, 'C004', NULL, NULL, 'Awaiting verification.'),
  ('DOC-010', 'C006', 'APP-002', 'Motherwell Fresh Produce Business Plan', 'Business Plan', 'Pending Review', 1743552000000, 'C006', NULL, NULL, 'Comprehensive plan including irrigation upgrade ROI analysis.')
ON CONFLICT (id) DO NOTHING;

-- ═══ AUDIT TRAIL — Key lifecycle events ═══
INSERT INTO audit_trail (id, action, entity, "user", ts, details, category)
VALUES
  ('AUD-001', 'Customer Created', 'C001', 'SYSTEM', 1704067200000, 'Mthatha Building Supplies onboarded. FICA: Verified.', 'Customers'),
  ('AUD-002', 'Application Submitted', 'APP-005', 'C001', 1738368000000, 'PO Financing application — R3,500,000 for ECDoE school renovation.', 'Origination'),
  ('AUD-003', 'Application Approved', 'APP-005', 'Thabo Mokoena', 1738972800000, 'Approved by Head of Credit. DSCR: 1.45x. Risk Score: 82/100. Grade B.', 'Underwriting'),
  ('AUD-004', 'Loan Disbursed', 'LN-001', 'Finance Dept', 1739577600000, 'R3,500,000 disbursed to FNB account ****7823. Debit order set up.', 'Loans'),
  ('AUD-005', 'Payment Received', 'LN-002', 'SYSTEM', 1742342400000, 'R58,000 received via EFT. Interest: R3,000. Principal: R55,000. Balance: R65,000.', 'Servicing'),
  ('AUD-006', 'Payment Missed', 'LN-003', 'SYSTEM', 1743033600000, 'Debit order returned unpaid — insufficient funds. DPD: 1.', 'Collections'),
  ('AUD-007', 'Collections Action', 'LN-003', 'Noluthando Mgquba', 1743292800000, 'Phone contact made. Customer cooperative. Vehicle breakdown cited. PTP secured.', 'Collections'),
  ('AUD-008', 'PTP Broken', 'LN-003', 'SYSTEM', 1742428800000, 'PTP of R24,150 not honoured. Insurance claim pending. Escalated to formal demand.', 'Collections'),
  ('AUD-009', 'Loan Settled', 'LN-004', 'SYSTEM', 1733011200000, 'Amathole Roads invoice loan fully repaid. R768,750 received. Account closed.', 'Servicing'),
  ('AUD-010', 'Application Declined', 'APP-009', 'Thabo Mokoena', 1742601600000, 'Declined: DSCR 0.95x below 1.2x threshold. D/E ratio 3.2x exceeds 2.0x limit. Recommend capital injection before re-application.', 'Underwriting'),
  ('AUD-011', 'FICA Verified', 'C008', 'Loan Officer', 1738368000000, 'Ngqura Logistics — all FICA documents verified. Home Affairs API check: Pass.', 'Compliance'),
  ('AUD-012', 'Application Submitted', 'APP-002', 'C006', 1743552000000, 'Working Capital application — R350,000 for irrigation upgrade. Awaiting assignment.', 'Origination')
ON CONFLICT (id) DO NOTHING;

-- ═══ ALERTS — Current system alerts ═══
INSERT INTO alerts (id, type, severity, title, msg, read, ts)
VALUES
  ('ALR-001', 'Collections', 'warning', 'Arrears — Mdantsane Auto Repairs', 'LN-003: 45 DPD. Formal demand issued. PTP broken. Next review: legal action assessment.', FALSE, 1742688000000),
  ('ALR-002', 'Origination', 'info', 'New Application — Motherwell Fresh Produce', 'APP-002: Working Capital R350,000 submitted. Awaiting loan officer assignment.', FALSE, 1743552000000),
  ('ALR-003', 'Underwriting', 'info', 'Underwriting In Progress — Xhosa Digital', 'APP-003: R1,200,000 Contract-Backed Term Loan. Credit analysis underway.', FALSE, 1742860800000),
  ('ALR-004', 'Loans', 'info', 'Approved — Awaiting Disbursement', 'APP-004: Ubuntu Catering R500,000 approved. Pending signed loan agreement.', FALSE, 1742860800000),
  ('ALR-005', 'Compliance', 'info', 'NCR Annual Return Due', 'NCR Form 39 annual return due 30 June 2026. Begin preparation.', FALSE, 1743465600000)
ON CONFLICT (id) DO NOTHING;

-- ═══ COMMS — Sample communications ═══
INSERT INTO comms (id, cust_id, type, direction, sent_by, subject, body, sent_at)
VALUES
  ('COM-001', 'C007', 'SMS', 'Outbound', 'SYSTEM', 'Payment Reminder', 'Dear Vuyani, your payment of R24,150.00 for loan LN-003 is overdue. Please contact us on 043 761 5500 to discuss. — KwikBridge', 1743033600000),
  ('COM-002', 'C007', 'Letter', 'Outbound', 'Noluthando Mgquba', 'Section 129 Notice', 'Formal notice in terms of Section 129 of the National Credit Act. 20 business days to respond.', 1742688000000),
  ('COM-003', 'C003', 'Email', 'Outbound', 'Thabo Mokoena', 'Application Approved — APP-004', 'Dear Thandi, we are pleased to advise that your application for R500,000 Working Capital has been approved. Please review and sign the attached loan agreement.', 1742860800000),
  ('COM-004', 'C006', 'Email', 'Inbound', 'Zukiswa Nqweniso', 'Application Query', 'Hi, I submitted my application APP-002 last week. Could you please advise on the expected timeline for review? Many thanks, Zuki.', 1743811200000)
ON CONFLICT (id) DO NOTHING;

-- ═══ SETTINGS ═══
INSERT INTO settings (id, data)
VALUES ('main', '{
  "companyName": "TQA Capital (Pty) Ltd",
  "ncrReg": "NCRCP22396",
  "ncrExpiry": "31 July 2026",
  "branch": "East London, Nahoon Valley",
  "regNumber": "2017/313869/07"
}'::jsonb)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

-- ═══ VERIFY SEED ═══
SELECT 'customers' AS "table", COUNT(*) AS "rows" FROM customers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'applications', COUNT(*) FROM applications
UNION ALL SELECT 'loans', COUNT(*) FROM loans
UNION ALL SELECT 'provisions', COUNT(*) FROM provisions
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'audit_trail', COUNT(*) FROM audit_trail
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'comms', COUNT(*) FROM comms
ORDER BY "table";
