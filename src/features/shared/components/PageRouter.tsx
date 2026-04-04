// @ts-nocheck
// KwikBridge LMS — Staff Page Router
// Routes to the correct staff module based on page state.

import React from "react";

export function renderPage() {
    if (detail) return renderDetail();
    switch (page) {
      case "dashboard": return <Dashboard />;
      case "customers": return <Customers />;
      case "origination": return <Origination />;
      case "underwriting": return <Underwriting />;
      case "loans": return <Loans />;
      case "servicing": return <Servicing />;
      case "collections": return <Collections />;
      case "provisioning": return <Provisioning />;
      case "governance": return <Governance />;
      case "statutory": return <StatutoryReporting />;
      case "documents": return <Documents />;
      case "reports": return <Reports />;
      case "comms": return <Comms />;
      case "admin": return <Administration />;
      case "products": return <Administration />;
      case "settings": return <Administration />;
      default: return <Dashboard />;
    }
  }
