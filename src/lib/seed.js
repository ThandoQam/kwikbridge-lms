// KwikBridge LMS — Seed Data

import { uid } from "../utils/ids.js";

export function seed() {
  const products = [
    { id:"P001", name:"PO Financing — ECDoE", minAmount:1000000, maxAmount:7500000, minTerm:3, maxTerm:6, baseRate:42.0, monthlyRate:3.5, description:"Government purchase order financing for Eastern Cape Department of Education contractors. Three-way cession structure with near-sovereign off-taker credit quality. High-volume anchor product.", repaymentType:"Bullet", arrangementFee:2.5, commitmentFee:0.5, gracePeriod:0, maxLTV:90, minDSCR:1.15, eligibleBEE:[1,2,3,4], eligibleIndustries:["Education","Construction","Services"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"ECDoE-contracted suppliers, service providers, and construction firms with confirmed government purchase orders.", riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22 },
    { id:"P002", name:"Invoice — Scholar Transport", minAmount:10000, maxAmount:150000, minTerm:1, maxTerm:2, baseRate:30.0, monthlyRate:2.5, description:"Invoice discounting for scholar transport operators with confirmed ECDoE contracts. Short-tenor, high-velocity product with 8 cycles per year. Verified invoice against government off-taker.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:80, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Transport","Education"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Scholar transport operators with verified ECDoE invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P003", name:"Invoice — Road Maintenance", minAmount:50000, maxAmount:1000000, minTerm:1, maxTerm:1, baseRate:30.0, monthlyRate:2.5, description:"Invoice discounting for road maintenance contractors with ECDoT (Eastern Cape Dept of Transport) verified invoices. Highest capital velocity — 10 cycles per year.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:85, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Construction","Transport","Infrastructure"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Road maintenance contractors and civil works firms with ECDoT verified invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P004", name:"Invoice — Coega Infrastructure", minAmount:500000, maxAmount:5000000, minTerm:1, maxTerm:2, baseRate:33.6, monthlyRate:2.8, description:"Invoice discounting for Coega Industrial Development Zone infrastructure contractors. A+ rated parastatal off-taker with 5 cycles per year.", repaymentType:"Bullet", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:85, minDSCR:1.0, eligibleBEE:[1,2,3,4], eligibleIndustries:["Construction","Infrastructure","Manufacturing"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Coega IDZ infrastructure contractors and suppliers with confirmed invoices.", riskClass:"A", ecl:0.76, s1PD:0.006, lgd:0.23 },
    { id:"P005", name:"Working Capital — Micro Traders", minAmount:500, maxAmount:10000, minTerm:0.17, maxTerm:1, baseRate:96.0, monthlyRate:8.0, description:"Fast micro-loans for informal traders and micro-enterprises. AI-scored with group guarantee (Grameen model). Up to 12 cycles per year. ECDC SERFSP pre-screened origination.", repaymentType:"Bullet", arrangementFee:3.0, commitmentFee:0, gracePeriod:0, maxLTV:100, minDSCR:1.0, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["All"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Street vendors, spaza shop owners, informal traders, micro-service providers.", riskClass:"B", ecl:8.58, s1PD:0.03, lgd:0.65 },
    { id:"P006", name:"Agri Finance — Smallholder", minAmount:50000, maxAmount:1000000, minTerm:3, maxTerm:6, baseRate:36.0, monthlyRate:3.0, description:"Seasonal agricultural finance for smallholder farmers. Crop lien and equipment collateral. Scenario-weighted for drought probability (75% good season / 25% drought).", repaymentType:"Seasonal", arrangementFee:2.0, commitmentFee:0, gracePeriod:0, maxLTV:70, minDSCR:1.2, eligibleBEE:[1,2,3,4,5,6,7,8], eligibleIndustries:["Agriculture","Food Processing"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"Smallholder farmers, emerging agricultural enterprises, crop producers in the Eastern Cape.", riskClass:"C", ecl:9.88, s1PD:0.0525, lgd:0.575 },
    { id:"P007", name:"Project & Contract Finance", minAmount:1000000, maxAmount:5000000, minTerm:3, maxTerm:12, baseRate:42.0, monthlyRate:3.5, description:"Tailored financing for specific projects and contracts. Designed to match your project's cash flow cycle with repayment terms up to 12 months. Suitable for mid-sized construction, infrastructure, and service delivery contracts.", repaymentType:"Amortising", arrangementFee:2.0, commitmentFee:0.5, gracePeriod:1, maxLTV:80, minDSCR:1.2, eligibleBEE:[1,2,3,4], eligibleIndustries:["Construction","Infrastructure","Professional Services"], status:"Active", createdBy:"U001", createdAt:now-365*day, idealFor:"SMEs undertaking mid-sized projects, construction firms, service providers with secured contracts.", riskClass:"A", ecl:0.70, s1PD:0.006, lgd:0.22 },
  ];

  const statutoryReports = [
    { id:"SR-001", name:"Annual Compliance Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Comprehensive compliance report covering all NCA obligations." },
    { id:"SR-002", name:"Annual Financial Statements", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Audited financial statements for the full financial year." },
    { id:"SR-003", name:"Annual Financial & Operational Return", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Detailed financial and operational data return as prescribed by the NCR." },
    { id:"SR-004", name:"Assurance Engagement Report", type:"Annual", category:"Statutory", period:"FY ending 28 Feb 2026", dueDate:"2026-08-31", submitTo:"submissions@ncr.org.za", status:"Not Started", preparer:null, reviewer:null, notes:"Independent assurance engagement on NCA compliance." },
    { id:"SR-005", name:"Form 39 – Q1 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Jan – 31 Mar 2026", dueDate:"2026-05-15", submitTo:"returns@ncr.org.za", status:"In Progress", preparer:"Finance Department", reviewer:"Chief Risk Officer", notes:"Quarterly statistical return." },
    { id:"SR-009", name:"Form 39 – Q4 2025 Statistical Return", type:"Form 39", category:"Statistical", period:"1 Oct – 31 Dec 2025", dueDate:"2026-02-15", submitTo:"returns@ncr.org.za", status:"Submitted", preparer:"Finance Department", reviewer:"Chief Risk Officer", submittedDate:"2026-02-12", notes:"Submitted on time." },
  ];

  const statutoryAlerts = [
    { id:uid(), type:"Statutory", severity:"critical", title:"Form 39 Q1 2026 – Due 15 May 2026", msg:"Statistical return due to NCR by 15 May 2026. Currently: In Progress.", read:false, ts:now },
    { id:uid(), type:"Statutory", severity:"warning", title:"Annual Reports – Due 31 August 2026", msg:"4 annual statutory reports due within 6 months of year-end.", read:false, ts:now-1*day },
    { id:uid(), type:"Statutory", severity:"info", title:"NCR Registration Renewal – 31 July 2026", msg:"NCRCP22396 expires 31 July 2026. Submit renewal before expiry.", read:false, ts:now-2*day },
  ];

  return {
    customers: [], products, applications: [], loans: [], collections: [],
    alerts: [...statutoryAlerts], audit: [], provisions: [], comms: [], documents: [],
    statutoryReports,
    settings: {
      companyName:"TQA Capital (Pty) Ltd", ncrReg:"NCRCP22396", ncrExpiry:"31 July 2026",
      branch:"East London, Nahoon Valley", yearEnd:"28 February 2026", annualDueDate:"2026-08-31",
      form39Required:"Annual", totalDisbursed:0,
      ncrAddress:"127 – 15th Road, Randjies Park, Midrand, 1685",
      ncrPO:"PO Box 209, Halfway House, 1685",
      ncrEmailAnnual:"submissions@ncr.org.za", ncrEmailForm39:"returns@ncr.org.za"
    }
  };
}
