// KwikBridge LMS — Wired Application Shell (ENH-09)
// This is the modular entry point that replaces the monolith.
// Routes to Public, Portal, or Staff layout based on auth state.

import React, { useState, useMemo, useCallback } from "react";
import { DataProvider, DataContext } from "./providers/DataProvider";
import { AuthProvider, AuthContext } from "./providers/AuthProvider";
import { useNavigation } from "../hooks/useNavigation";
import { usePermissions } from "../hooks/usePermissions";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";
import { PublicLayout } from "./layouts/PublicLayout";
import { PortalLayout } from "./layouts/PortalLayout";
import { StaffLayout } from "./layouts/StaffLayout";
import { C, I } from "../lib/theme";
import { ROLES, SYSTEM_USERS, PERMS, APPROVAL_LIMITS } from "../constants/roles";
import { fmt } from "../utils/format";
import { uid } from "../utils/ids";
import { addAudit, addAlert } from "../utils/audit";
import { stage, dpd as calcDpd, now, day } from "../utils/dpd";
import { installGlobalHandlers, collectWebVitals, setUserContext } from "../lib/monitoring";

// Install monitoring on startup
if (typeof window !== "undefined") {
  installGlobalHandlers();
  collectWebVitals();
}

// ═══ Staff navigation items ═══
const STAFF_NAV = [
  { key: "dashboard", label: "Dashboard", icon: I.dashboard },
  { key: "customers", label: "Customers", icon: I.customers },
  { key: "origination", label: "Origination", icon: I.origination },
  { key: "underwriting", label: "Underwriting", icon: I.underwriting },
  { key: "loans", label: "Loans", icon: I.loans },
  { key: "servicing", label: "Servicing", icon: I.servicing },
  { key: "collections", label: "Collections", icon: I.collections },
  { key: "provisioning", label: "Provisioning", icon: I.provisioning },
  { key: "governance", label: "Governance", icon: I.governance },
  { key: "statutory", label: "Statutory", icon: I.governance },
  { key: "documents", label: "Documents", icon: I.documents },
  { key: "reports", label: "Reports", icon: I.reports },
  { key: "comms", label: "Communications", icon: I.comms },
  { key: "admin", label: "Administration", icon: I.customers },
];

const PORTAL_NAV = [
  { key: "portal_dashboard", label: "Dashboard", icon: I.dashboard },
  { key: "portal_applications", label: "Applications", icon: I.origination },
  { key: "portal_loans", label: "My Loans", icon: I.loans },
  { key: "portal_documents", label: "Documents", icon: I.documents },
  { key: "portal_comms", label: "Messages", icon: I.comms },
  { key: "portal_profile", label: "Profile", icon: I.customers },
];

export function App() {
  return (
    <ErrorBoundary component="App">
      <DataProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}

function AppRouter() {
  const auth = React.useContext(AuthContext);
  const dataCtx = React.useContext(DataContext);
  const { page, setPage, navTo, goBack, canGoBack, detail, setDetail } = useNavigation("public_home");
  const [zone, setZone] = useState("public");
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  if (!dataCtx?.data || !auth) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Outfit',system-ui,sans-serif", color: C.textDim }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>KwikBridge</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Loading...</div>
        </div>
      </div>
    );
  }

  const { data, save, reset } = dataCtx;
  const { authSession, authLoading, authMode, setAuthMode, authForm, setAuthForm, handleSignIn, handleSignUp, handleSignOut, authOAuthUrl } = auth;

  // Derive current user from auth session
  const currentUser = useMemo(() => {
    if (!authSession) return null;
    const email = authSession.user?.email || "";
    const sysUser = SYSTEM_USERS.find((u: any) => u.email === email);
    return sysUser || { id: email, name: authSession.user?.user_metadata?.name || email, email, role: "BORROWER", initials: email.slice(0, 2).toUpperCase() };
  }, [authSession]);

  const role = currentUser?.role || "VIEWER";
  const { canDo, canDoAny, approvalLimit } = usePermissions(currentUser);

  // Zone derivation
  const userZone = authSession ? (ROLES[role]?.zone || "staff") : "public";

  // Auto-set zone on auth change
  React.useEffect(() => {
    if (authSession && zone === "public") {
      setZone(userZone);
      if (userZone === "portal") setPage("portal_dashboard");
      else setPage("dashboard");
    }
    if (!authSession && zone !== "public" && zone !== "auth") {
      setZone("public");
      setPage("public_home");
    }
  }, [authSession, zone, userZone]);

  // Set monitoring user context
  React.useEffect(() => {
    if (currentUser) setUserContext(currentUser.id, role);
  }, [currentUser, role]);

  // Data collections (shorthand)
  const { customers, applications, loans, documents, collections, alerts, audit, provisions, comms, products, statutoryReports, settings } = data;
  const unread = alerts?.filter((a: any) => !a.read).length || 0;

  // Helper: find customer
  const cust = useCallback((id: string) => customers?.find((c: any) => c.id === id), [customers]);
  const prod = useCallback((id: string) => products?.find((p: any) => p.id === id), [products]);

  // Mark alert read
  const markRead = useCallback((id: string) => {
    save({ ...data, alerts: alerts.map((a: any) => a.id === id ? { ...a, read: true } : a) });
  }, [data, save, alerts]);

  const signOut = useCallback(() => {
    handleSignOut();
    setZone("public");
    setPage("public_home");
  }, [handleSignOut]);

  // Staff nav with counts
  const staffNavItems = useMemo(() => {
    return STAFF_NAV.map(n => ({
      ...n,
      count: n.key === "origination" ? applications?.filter((a: any) => ["Submitted", "Pre-Approval", "Draft"].includes(a.status)).length :
             n.key === "underwriting" ? applications?.filter((a: any) => a.status === "Underwriting").length :
             n.key === "collections" ? loans?.filter((l: any) => l.status === "Active" && l.dpd > 0).length :
             n.key === "governance" ? unread : undefined
    }));
  }, [applications, loans, unread]);

  // ═══ Auth Zone ═══
  if (zone === "auth" || (!authSession && zone !== "public")) {
    return (
      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg }}>
        <div style={{ background: C.surface, padding: 32, width: 360, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>KwikBridge</div>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1, marginBottom: 24 }}>LOAN MANAGEMENT SYSTEM</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{authMode === "login" ? "Staff Login" : "Create Account"}</div>
          {authForm.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 12, padding: "6px 8px", background: "#fee" }}>{authForm.error}</div>}
          {authMode === "register" && (
            <input placeholder="Full Name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", marginBottom: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }} />
          )}
          <input placeholder="Email" type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
            style={{ width: "100%", padding: "8px 10px", marginBottom: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }} />
          <input placeholder="Password" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
            onKeyDown={e => e.key === "Enter" && (authMode === "login" ? handleSignIn() : handleSignUp())}
            style={{ width: "100%", padding: "8px 10px", marginBottom: 16, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit" }} />
          <button onClick={authMode === "login" ? handleSignIn : handleSignUp}
            style={{ width: "100%", padding: "10px", background: C.text, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
            {authLoading ? "..." : authMode === "login" ? "Sign In" : "Create Account"}
          </button>
          <div style={{ textAlign: "center", fontSize: 11, color: C.textDim }}>
            {authMode === "login" ? (
              <><span>No account? </span><button onClick={() => setAuthMode("register")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Register</button></>
            ) : (
              <><span>Have an account? </span><button onClick={() => setAuthMode("login")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Sign In</button></>
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button onClick={() => { setZone("public"); setPage("public_home"); }}
              style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Public Zone ═══
  if (zone === "public" || !authSession) {
    return (
      <PublicLayout page={page} setPage={setPage} setZone={setZone} setAuthForm={setAuthForm} setAuthMode={setAuthMode}>
        <div style={{ fontSize: 13, color: C.textDim, textAlign: "center", padding: 40 }}>
          Public zone content rendered by monolith. Modular public pages coming soon.
        </div>
      </PublicLayout>
    );
  }

  // ═══ Portal Zone (Borrower) ═══
  if (userZone === "portal") {
    const myEmail = authSession?.user?.email;
    const myCustomer = customers?.find((c: any) => c.email === myEmail);

    return (
      <PortalLayout page={page} navTo={navTo} goBack={goBack} canGoBack={canGoBack}
        portalNav={PORTAL_NAV} handleSignOut={signOut} authSession={authSession} myCustomer={myCustomer}>
        <div style={{ fontSize: 13, color: C.textDim, textAlign: "center", padding: 40 }}>
          Portal content rendered by monolith. Modular portal pages coming soon.
        </div>
      </PortalLayout>
    );
  }

  // ═══ Staff Zone ═══
  return (
    <StaffLayout
      page={page} navTo={navTo} goBack={goBack} canGoBack={canGoBack}
      sideCollapsed={sideCollapsed} setSideCollapsed={setSideCollapsed}
      staffNavItems={staffNavItems} currentUser={currentUser}
      sysUsers={SYSTEM_USERS} setCurrentUser={() => {}}
      search={search} setSearch={setSearch}
      alerts={alerts} unread={unread} markRead={markRead}
      notifOpen={notifOpen} setNotifOpen={setNotifOpen}
      handleSignOut={signOut} reset={reset} authSession={authSession}
    >
      <div style={{ fontSize: 13, color: C.textDim, textAlign: "center", padding: 40 }}>
        Staff module: <strong>{page}</strong>. Feature pages will be wired incrementally.
      </div>
    </StaffLayout>
  );
}

// Re-export for backward compatibility
export { App as AppShell };
