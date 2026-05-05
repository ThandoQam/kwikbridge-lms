// ═══════════════════════════════════════════════════════════════
// KWIKBRIDGE LMS — COMPREHENSIVE JOURNEY TEST
// Run: node test-journeys.js
// Tests every user journey by parsing the monolith for structural integrity
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const monolith = fs.readFileSync('src/kwikbridge-lms-v2.jsx', 'utf8');
// Also scan extracted feature files — tests against feature content
// should pass whether the code is inline or extracted.
const featureFiles = [];
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const p = require('path').join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (d.name.endsWith('.tsx') || d.name.endsWith('.ts')) {
      featureFiles.push(fs.readFileSync(p, 'utf8'));
    }
  });
}
try { walk('src/features'); } catch {}
const src = monolith + '\n/* ─── EXTRACTED FEATURES ─── */\n' + featureFiles.join('\n');

let pass = 0, fail = 0, warn = 0;
const results = [];

function test(category, name, condition, detail) {
  if (condition) { pass++; results.push({ s:'✓', category, name }); }
  else { fail++; results.push({ s:'✗', category, name, detail }); }
}
function warning(category, name, detail) {
  warn++; results.push({ s:'⚠', category, name, detail });
}

// ═══ 1. PUBLIC ZONE ═══
test('Public', 'Landing page renders', src.includes('public_home') && src.includes('Business Finance for Growth'));
test('Public', 'Product cards (4 products)', src.includes('Invoice Discounting') && src.includes('Purchase Order Financing') && src.includes('Working Capital Financing') && src.includes('Agri & Project Financing'));
test('Public', 'Apply for Financing form', src.includes('public_apply') && src.includes('handleSubmitApplication'));
test('Public', 'Track Application page', src.includes('public_track'));
test('Public', 'Staff Login button', src.includes('Staff Login'));
test('Public', 'Trust badges', src.includes('SEDFA Partner') && src.includes('NCA Compliant'));
test('Public', 'NCR footer', src.includes('NCRCP22396'));

// ═══ 2. AUTH ═══
test('Auth', 'Sign in form', src.includes('authSignIn') && src.includes('authForm'));
test('Auth', 'Sign up form', src.includes('authSignUp'));
test('Auth', 'Password field', src.includes('password') && src.includes('authForm'));
test('Auth', 'OAuth URL', src.includes('authOAuthUrl'));

// ═══ 3. PORTAL ZONE ═══
test('Portal', 'Portal dashboard', src.includes('portal_dashboard'));
test('Portal', 'My loans view', src.includes('portal_loans'));
test('Portal', 'My applications view', src.includes('portal_applications'));
test('Portal', 'Document upload', src.includes('portal_documents'));

// ═══ 4. CUSTOMER MANAGEMENT ═══
const customersExtracted = require('fs').readFileSync('./src/features/customers/components/CustomersPage.tsx', 'utf8');
test('Customers', 'Customer list table', customersExtracted.includes('Business Name') && customersExtracted.includes("label: 'Contact'"));
test('Customers', 'Create customer', src.includes('createCustomer'));
test('Customers', 'Customer detail view', src.includes('detail.type === "customer"'));
test('Customers', 'FICA status management', src.includes('updateFicaStatus'));
test('Customers', 'BEE status management', src.includes('updateBeeStatus'));
test('Customers', 'Customer filter tabs', src.includes('FICA Pending') || src.includes('ficaStatus'));

// ═══ 5. LOAN ORIGINATION ═══
const origExtracted = require('fs').readFileSync('./src/features/origination/components/OriginationPage.tsx', 'utf8');
test('Origination', 'Application list table', origExtracted.includes("label: 'App ID'"));
test('Origination', 'New application modal', src.includes('newApp') || src.includes('New Application'));
test('Origination', 'Application assignment', src.includes('assignApplication'));
test('Origination', 'QA sign-off', src.includes('qaSignOffApplication'));
test('Origination', 'Withdrawal', src.includes('withdrawApplication'));
test('Origination', 'Draft status + expiry', src.includes('Draft') && src.includes('expiresAt'));
test('Origination', 'Pipeline KPIs', origExtracted.includes('Pipeline Value'));
test('Origination', 'Status tabs (all/draft/submitted/etc)', src.includes('Draft (QA Pending)') || src.includes('Submitted'));
test('Origination', 'Approval authority matrix display', src.includes('APPROVAL_LIMITS'));

// ═══ 6. UNDERWRITING ═══
test('Underwriting', 'DD Step 1: KYC/FICA', src.includes('"kyc"') && src.includes('kycComplete'));
test('Underwriting', 'DD Step 2: Documents', src.includes('"docs"') && src.includes('docsComplete'));
test('Underwriting', 'DD Step 3: Site Visit', src.includes('siteVisitComplete') && src.includes('siteVisitComplete'));
test('Underwriting', 'DD Step 4: Financial Analysis', src.includes('financialAnalysisComplete') && src.includes('financialAnalysis'));
test('Underwriting', 'DD Step 5: Collateral', src.includes('"collateral"') && src.includes('collateralAssessed'));
test('Underwriting', 'DD Step 6: Social Impact', src.includes('"social"') && src.includes('socialVerified'));
test('Underwriting', 'DD Step 7: Sanctions', src.includes('sanctions') && src.includes('sanctionsCleared'));
test('Underwriting', 'Credit bureau pull', src.includes('creditBureauScore') && src.includes('TransUnion'));
test('Underwriting', 'Risk score calculation', src.includes('riskScore') && src.includes('Risk Score'));
test('Underwriting', 'DSCR calculation', src.includes('dscr') && src.includes('DSCR'));
test('Underwriting', 'Analyst notes', src.includes('saveAnalystNotes'));
test('Underwriting', 'Step sign-off', src.includes('signOffStep'));
test('Underwriting', 'Finding notes', src.includes('updateFindingNote'));

// ═══ 7. CREDIT DECISION ═══
test('Decision', 'Submit recommendation', src.includes('submitRecommendation'));
test('Decision', 'Structured credit memo', src.includes('generateCreditMemo') && src.includes('CREDIT MEMORANDUM'));
test('Decision', 'Approval authority routing', src.includes('getApprovalAuthority') && src.includes('Pending Approval'));
test('Decision', 'Separation of duties (recommender ≠ approver)', src.includes('recommendedBy') && src.includes('Separation of duties'));
test('Decision', 'Authority limit enforcement', src.includes('Authority exceeded'));
test('Decision', 'Conditions precedent', src.includes('conditions') && src.includes('Maintain DSCR'));
test('Decision', 'decideLoan function', src.includes('decideLoan'));
test('Decision', 'Credit memo display', src.includes('Credit Memorandum') && src.includes('creditMemo'));

// ═══ 8. LOAN BOOKING ═══
test('Booking', 'bookLoan function', src.includes('bookLoan'));
test('Booking', 'Loan record creation', src.includes('Loan Booked') && src.includes('status:"Booked"'));
test('Booking', 'Arrangement fee calc', src.includes('arrangementFee'));
test('Booking', 'Amortisation schedule', src.includes('amortisation') || src.includes('monthlyPmt'));
test('Booking', 'Stage 1 provision created', src.includes('stage:1') && src.includes('pd:0.02'));
test('Booking', 'Security instruments selection', src.includes('SECURITY_INSTRUMENTS') && src.includes('securitySelections'));
test('Booking', 'Generate Agreement button', src.includes('Generate Agreement') || src.includes('generateLoanAgreement'));
test('Booking', 'Generate security docs', src.includes('generateSecurityDoc'));

// ═══ 9. DISBURSEMENT ═══
test('Disbursement', 'disburseLoan function', src.includes('disburseLoan'));
test('Disbursement', 'Pre-disbursement AML check', src.includes('preDisbursementAML') || src.includes('Pre-disbursement'));
test('Disbursement', 'Dual authorisation', src.includes('disbursementAuth2') || src.includes('dual auth'));
test('Disbursement', 'Status changes to Active', src.includes('status:"Active"') || src.includes('"Active"'));
test('Disbursement', 'Disbursement date recorded', src.includes('disbursed:'));

// ═══ 10. LOAN SERVICING ═══
test('Servicing', 'Payment recording', src.includes('recordPayment'));
test('Servicing', 'Balance update', src.includes('balance:') && src.includes('totalPaid'));
test('Servicing', 'Payment history', src.includes('payments:'));
test('Servicing', 'DPD tracking', src.includes('dpd'));
test('Servicing', 'Covenant monitoring', src.includes('covenants'));

// ═══ 11. COLLECTIONS ═══
const collExtracted = require('fs').readFileSync('./src/features/collections/components/CollectionsPage.tsx', 'utf8');
test('Collections', 'Delinquent accounts table', collExtracted.includes('Delinquent Accounts'));
test('Collections', 'Collection action logging', src.includes('addCollectionAction'));
test('Collections', 'Phone call action', src.includes('Phone Call'));
test('Collections', 'Letter of Demand', src.includes('Letter of Demand'));
test('Collections', 'Promise to Pay (PTP)', src.includes('createPTP') && src.includes('ptpDate'));
test('Collections', 'Debt restructuring', src.includes('restructure') || src.includes('Restructure'));
test('Collections', 'Write-off proposal', src.includes('Write-Off Proposed') || src.includes('writeOff'));
test('Collections', 'Write-off approval', src.includes('approveWriteOff'));
test('Collections', 'Legal handover', src.includes('Legal Handover') || src.includes('Legal Department'));
test('Collections', 'Collections in loan detail', src.includes('Collections Actions'));
test('Collections', 'Stage-based action visibility', src.includes('l.dpd>30') && src.includes('l.dpd>90'));
test('Collections', 'Activity log tab', collExtracted.includes("'activity'") && collExtracted.includes('Activity Log'));

// ═══ 12. IFRS 9 PROVISIONING ═══
test('IFRS 9', 'ECL calculation', src.includes('ecl') && (src.includes('Expected Credit Loss') || require('fs').readFileSync('./src/features/provisioning/components/ProvisioningPage.tsx', 'utf8').includes('Expected Credit Loss')));
test('IFRS 9', '3-stage model', src.includes('Performing') && src.includes('Underperforming') && src.includes('Non-performing'));
test('IFRS 9', 'PD/LGD/EAD', src.includes('pd:') && src.includes('lgd:') && src.includes('ead:'));
test('IFRS 9', 'Provisioning table', src.includes('label:"ECL"') || src.includes('Provision'));

// ═══ 13. GOVERNANCE ═══
test('Governance', 'Audit trail', src.includes('addAudit') && src.includes('audit'));
test('Governance', 'Alert system', src.includes('addAlert'));
const govExtracted = require('fs').readFileSync('./src/features/governance/components/GovernancePage.tsx', 'utf8');
test('Governance', 'Control points', govExtracted.includes('controlPoints') || govExtracted.includes('Controls Active'));
test('Governance', 'Business rules', src.includes('businessRules') || src.includes('Business Rules'));

// ═══ 14. STATUTORY REPORTING ═══
test('Statutory', 'NCR Form 39', src.includes('Form 39'));
test('Statutory', 'Statutory report tracking', src.includes('statutoryReports'));
test('Statutory', 'Report status updates', src.includes('updateStatutoryStatus'));
test('Statutory', 'Deadline monitoring', src.includes('Reporting Deadlines'));

// ═══ 15. DOCUMENTS ═══
test('Documents', 'Document registry', src.includes('Documents') && src.includes('label:"Category"'));
test('Documents', 'Document approval', src.includes('approveDocument'));
test('Documents', 'Document rejection', src.includes('rejectDocument'));
test('Documents', 'Category filtering', src.includes('"KYC"') && src.includes('"Collateral"'));

// ═══ 16. COMMUNICATIONS ═══
test('Comms', 'Communication log', src.includes('comms') && src.includes('Communications'));
test('Comms', 'Email templates', src.includes('email') || src.includes('Email'));

// ═══ 17. REPORTS ═══
test('Reports', 'Portfolio summary', src.includes('Portfolio') && src.includes('Total Loan Book'));
test('Reports', 'NPL reporting', src.includes('NPL') || src.includes('Non-performing'));
test('Reports', 'Concentration analysis', src.includes('concentration') || src.includes('Concentration'));

// ═══ 18. ADMINISTRATION ═══
test('Admin', 'Product management', src.includes('Product Management') && src.includes('saveProduct'));
test('Admin', 'Product security config', src.includes('requiredSecurity') && src.includes('optionalSecurity'));
test('Admin', 'User management', src.includes('handleSaveUser'));
test('Admin', 'Settings management', src.includes('handleSaveSettings'));
test('Admin', 'Business rules', src.includes('handleSaveRule') || src.includes('Business Rules'));
test('Admin', 'API keys', src.includes('addApiKey') || src.includes('API Key'));

// ═══ 19. SECURITY INSTRUMENTS ═══
test('Security', '7 instrument types', src.includes('cession') && src.includes('bankAuth') && src.includes('personalGuarantee') && src.includes('assetPledge') && src.includes('cropLien') && src.includes('debitMandate') && src.includes('insurance'));
test('Security', 'Product-security mapping', src.includes('PRODUCT_SECURITY'));
test('Security', 'Cession agreement template', src.includes('DEED OF CESSION'));
test('Security', 'Bank authority template', src.includes('BANK LETTER OF AUTHORITY'));
test('Security', 'Suretyship template', src.includes('DEED OF SURETYSHIP'));
test('Security', 'Asset pledge template', src.includes('PLEDGE AND CESSION'));
test('Security', 'Crop lien template', src.includes('NOTARIAL BOND'));
test('Security', 'Debit mandate template', src.includes('DEBIT ORDER MANDATE'));

// ═══ 20. UI COMPONENTS ═══
test('UI', 'KPI component', src.includes('function KPI('));
test('UI', 'SectionCard component', src.includes('function SectionCard('));
test('UI', 'Badge component', src.includes('function Badge('));
test('UI', 'Table component', src.includes('function Table('));
test('UI', 'Modal component', src.includes('function Modal('));
test('UI', 'Btn component', src.includes('function Btn('));
test('UI', 'Tab component', src.includes('function Tab('));
test('UI', 'Field component', src.includes('function Field('));
test('UI', 'Toast notification', src.includes('showToast'));
test('UI', 'Widget customisation', src.includes('widgetConfig') && src.includes('toggleWidget'));
test('UI', 'Sticky sidebar', src.includes('position:"fixed"') && src.includes('kb-sidebar'));
test('UI', 'Mobile hamburger', src.includes('kb-hamburger'));
test('UI', 'Mobile bottom bar', src.includes('kb-mobile-fab'));

// ═══ 21. DESIGN SYSTEM ═══
test('Design', 'Colour palette (C.*)', src.includes('const C = {'));
test('Design', 'Design tokens (T.*)', src.includes('const T = {'));
test('Design', 'Cell renderers (cell.*)', src.includes('const cell = {'));
test('Design', 'GLOBAL_CSS shared', (src.match(/<style>\{GLOBAL_CSS\}<\/style>/g) || []).length >= 3);
test('Design', 'Font smoothing', src.includes('font-smoothing:antialiased'));
test('Design', 'text-rendering', src.includes('text-rendering:optimizeLegibility'));

// ═══ 22. COMPLIANCE ═══
test('Compliance', 'NCA references', src.includes('National Credit Act') || src.includes('NCA'));
test('Compliance', 'FICA/AML', src.includes('FICA') && src.includes('AML'));
test('Compliance', 'POPIA', src.includes('POPIA'));
test('Compliance', 'Sanctions screening', src.includes('sanctions') && src.includes('Sanctions Screening'));
test('Compliance', 'NCR registration display', src.includes('NCRCP22396'));

// ═══ 23. DATA INTEGRITY ═══
const configSrc = require('fs').readFileSync('src/lib/config.ts', 'utf-8');
test('Data', 'Supabase connection', configSrc.includes('supabase.co'));
test('Data', 'Seed data function', src.includes('Reset Demo') || src.includes('localStorage'));
test('Data', 'Save function', src.includes('const save ='));
test('Data', 'Audit trail on mutations', (src.match(/addAudit\(/g) || []).length >= 30);
test('Data', 'Alert generation', (src.match(/addAlert\(/g) || []).length >= 10);

// ═══ 24. CROSS-CUTTING ═══
test('XCut', 'Role-based permissions', src.includes('canDo('));
test('XCut', 'Approval limits', src.includes('APPROVAL_LIMITS'));
test('XCut', 'Error handling (no alert())', !src.includes('alert('));
test('XCut', 'Date formatting (fmt.date)', src.includes('fmt.date'));
test('XCut', 'Currency formatting (fmt.cur)', src.includes('fmt.cur'));
test('XCut', 'Back navigation', src.includes('goBack') && src.includes('BackBtn'));

// ═══ 25. RENDER INTEGRITY ═══
// Check that every page component is defined
const pageComponents = ['Dashboard', 'Customers', 'Origination', 'Underwriting', 'Loans', 'Servicing', 'Collections', 'Provisioning', 'Governance', 'StatutoryReporting', 'Documents', 'Reports', 'Comms', 'Administration'];
// Pages can be inline functions OR extracted to src/features/
const extractedFeatures = {
  'Reports': 'features/reports',
  'Provisioning': 'features/provisioning',
  'InvestorDashboard': 'features/investor',
  'Underwriting': 'features/underwriting',
  'Comms': 'features/comms',
  'Customers': 'features/customers',
  'Origination': 'features/origination',
  'Loans': 'features/loans',
  'Servicing': 'features/servicing',
  'Collections': 'features/collections',
  'Documents': 'features/documents',
  'Governance': 'features/governance',
  'StatutoryReporting': 'features/statutory',
  'Dashboard': 'features/dashboard',
};
pageComponents.forEach(comp => {
  const inline = src.includes(`function ${comp}(`);
  const extracted = extractedFeatures[comp] && src.includes(extractedFeatures[comp]);
  test('Render', `${comp} component defined`, inline || extracted);
});

// Check detail views render
test('Render', 'renderDetail function', src.includes('function renderDetail'));
test('Render', 'renderPage function', src.includes('renderPage()'));
test('Render', 'Detail → renderDetail routing', src.includes('if (detail) return') && src.includes('renderDetail()'));

// ═══ REPORT ═══
console.log('\n═══════════════════════════════════════════════════════');
console.log('  KWIKBRIDGE LMS — JOURNEY TEST RESULTS');
console.log('═══════════════════════════════════════════════════════\n');

const categories = {};
results.forEach(r => {
  if (!categories[r.category]) categories[r.category] = [];
  categories[r.category].push(r);
});

Object.entries(categories).forEach(([cat, items]) => {
  const p = items.filter(i => i.s === '✓').length;
  const f = items.filter(i => i.s === '✗').length;
  const w = items.filter(i => i.s === '⚠').length;
  const status = f > 0 ? '✗' : w > 0 ? '⚠' : '✓';
  console.log(`  ${status} ${cat} (${p}/${items.length})`);
  items.filter(i => i.s === '✗').forEach(i => {
    console.log(`      ✗ ${i.name}${i.detail ? ': ' + i.detail : ''}`);
  });
});

console.log(`\n  ─────────────────────────────────`);
console.log(`  PASSED:  ${pass}`);
console.log(`  FAILED:  ${fail}`);
console.log(`  WARNINGS: ${warn}`);
console.log(`  TOTAL:   ${pass + fail + warn}`);
console.log(`  SCORE:   ${pass}/${pass + fail} (${Math.round(pass/(pass+fail)*100)}%)`);
console.log(`  ─────────────────────────────────\n`);

process.exit(fail > 0 ? 1 : 0);
