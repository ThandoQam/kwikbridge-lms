// KwikBridge LMS — Data Provider
// Owns the global data state, load sequence, and save() callback.
// All features consume data via useData() hook — never directly.

import React, { createContext, useState, useEffect, useCallback } from "react";
import { sbGet, sbUpsert, TABLES } from "../../lib/supabase";
import { store, SK } from "../../lib/store";
import { seed } from "../../lib/seed";

export const DataContext = createContext<any>(null);

const hasCurrentSchema = (d) => {
  if (!d || typeof d !== "object") return false;
  if (!d.products || !Array.isArray(d.products) || d.products.length === 0) return false;
  if (!d.settings || typeof d.settings !== "object") return false;
  if (!Array.isArray(d.applications)) return false;
  return true;
};

export function DataProvider({ children }) {
  const [data, setData] = useState<any>(null);

  // Load sequence: store first → Supabase with 3s timeout → seed() fallback
  useEffect(() => {
    (async () => {
      try {
        // 1. Try local store (instant)
        const local = await store.get(SK);
        if (local?.value) {
          const parsed = JSON.parse(local.value);
          if (hasCurrentSchema(parsed)) { setData(parsed); return; }
        }
      } catch (e: any) { /* continue to Supabase */ }

      try {
        // 2. Try Supabase with 3s timeout
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const rows = await sbGet("kwikbridge_data");
        clearTimeout(timer);
        if (rows?.length) {
          const merged = {};
          for (const row of rows) {
            try { merged[row.key] = JSON.parse(row.value); } catch {}
          }
          if (hasCurrentSchema(merged)) { setData(merged); return; }
        }
      } catch (e: any) {
        console.log("Supabase load skipped:", e.name);
      }

      // 3. Seed fallback
      setData(seed());
    })();
  }, []);

  // Unified save — persists to store + Supabase
  const save = useCallback((newData) => {
    setData(newData);
    try { store.set(SK, JSON.stringify(newData)); } catch {}
    try {
      for (const [key, table] of Object.entries(TABLES)) {
        if (newData[key] !== undefined) {
          sbUpsert(table, { key, value: JSON.stringify(newData[key]) }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.log("Supabase save error (non-fatal):", e.message);
    }
  }, []);

  // Reset to seed
  const reset = () => {
    const fresh = seed();
    setData(fresh);
    try { store.set(SK, JSON.stringify(fresh)); } catch {}
  };

  return (
    <DataContext.Provider value={{ data, save, reset }}>
      {children}
    </DataContext.Provider>
  );
}
