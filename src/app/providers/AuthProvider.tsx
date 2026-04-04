// KwikBridge LMS — Auth Provider
// Manages auth session, loading state, sign in/up/out, OAuth redirect.
// All features consume auth via useAuth() hook.

import React, { createContext, useState, useEffect } from "react";
import { authSignIn, authSignUp, authSignOut, authGetUser, authOAuthUrl } from "../../lib/supabase";
import { SYSTEM_USERS, ROLES } from "../../constants/roles";

export const AuthContext = createContext<any>(null);

export function AuthProvider({ children }) {
  const [authSession, setAuthSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "", error: "" });

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      // Check OAuth redirect (hash fragment)
      if (window.location.hash) {
        try {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const token = params.get("access_token");
          if (token) {
            const user = await authGetUser(token);
            if (user) {
              const session = { token, user };
              localStorage.setItem("kb-auth", JSON.stringify(session));
              setAuthSession(session);
              window.history.replaceState(null, "", window.location.pathname);
            }
          }
        } catch {}
      }

      // Check stored session
      try {
        const stored = localStorage.getItem("kb-auth");
        if (stored) {
          const session = JSON.parse(stored);
          if (session?.token) {
            const user = await authGetUser(session.token);
            if (user) {
              setAuthSession({ ...session, user });
            } else {
              localStorage.removeItem("kb-auth");
            }
          }
        }
      } catch {
        localStorage.removeItem("kb-auth");
      }

      setAuthLoading(false);
    })();
  }, []);

  const handleSignIn = async () => {
    setAuthForm(f => ({ ...f, error: "" }));
    try {
      const res = await authSignIn(authForm.email, authForm.password);
      if (res.error) { setAuthForm(f => ({ ...f, error: res.error_description || "Sign in failed" })); return null; }
      const session = { token: res.access_token, user: res.user || { email: authForm.email } };
      localStorage.setItem("kb-auth", JSON.stringify(session));
      setAuthSession(session);
      // Match to system user
      const matched = SYSTEM_USERS.find(u => u.email?.toLowerCase() === authForm.email.toLowerCase());
      const zone = matched ? ROLES[matched.role]?.zone : "portal";
      return { session, matched, zone };
    } catch (e: any) {
      setAuthForm(f => ({ ...f, error: e.message || "Sign in failed" }));
      return null;
    }
  };

  const handleSignUp = async () => {
    setAuthForm(f => ({ ...f, error: "" }));
    try {
      const res = await authSignUp(authForm.email, authForm.password, authForm.name);
      if (res.error) { setAuthForm(f => ({ ...f, error: res.error_description || "Sign up failed" })); return null; }
      const session = { token: res.access_token, user: res.user || { email: authForm.email } };
      localStorage.setItem("kb-auth", JSON.stringify(session));
      setAuthSession(session);
      return { session, zone: "portal" };
    } catch (e: any) {
      setAuthForm(f => ({ ...f, error: e.message || "Sign up failed" }));
      return null;
    }
  };

  const handleSignOut = () => {
    try { authSignOut(authSession?.token); } catch {}
    localStorage.removeItem("kb-auth");
    setAuthSession(null);
  };

  return (
    <AuthContext.Provider value={{
      authSession, setAuthSession, authLoading,
      authMode, setAuthMode, authForm, setAuthForm,
      handleSignIn, handleSignUp, handleSignOut,
      authOAuthUrl,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
