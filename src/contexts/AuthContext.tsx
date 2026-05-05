/**
 * AuthContext — current user, session, and permission helper.
 *
 * Holds the active session and the canDo() permission function.
 * Most pages need at least currentUser (for audit display) and canDo
 * (for permission gating); putting them in props would mean threading
 * 2 extra props everywhere.
 *
 * Migration: extracted feature components call useAuth() to get
 * currentUser and canDo.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface AuthContextValue {
  authSession: any;
  currentUser: any;
  role: string;
  canDo: (mod: string, action: string) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({
  value,
  children,
}: {
  value: AuthContextValue;
  children: ReactNode;
}) => {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within <AuthProvider>. Check your tree.');
  }
  return ctx;
};
