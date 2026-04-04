// KwikBridge LMS — useData Hook
// Consumes DataProvider context. All features use this to access data.

import { useContext } from "react";
import { DataContext } from "../app/providers/DataProvider";

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
