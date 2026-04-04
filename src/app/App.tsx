// KwikBridge LMS — App Shell
// Root component that wraps providers and routes to the correct layout.
// This is the future entry point — currently the monolith still serves as entry.

import React from "react";
import { DataProvider } from "./providers/DataProvider";
import { AuthProvider } from "./providers/AuthProvider";

export function AppShell({ children }) {
  return (
    <DataProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </DataProvider>
  );
}
