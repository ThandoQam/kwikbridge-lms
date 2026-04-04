// KwikBridge LMS — useAuth Hook
// Consumes AuthProvider context. All features use this for auth state.

import { useContext } from "react";
import { AuthContext } from "../app/providers/AuthProvider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
