// KwikBridge LMS — Data Provider
// Owns the global data state, load sequence, and save() callback.
// Uses normalised Supabase schema (12 individual tables).

import React, { createContext, useState, useEffect, useCallback } from "react";
import { sbLoadAll, sbSaveChanges } from "../../lib/supabase";
import { store, SK } from "../../lib/store";
import { seed } from "../../lib/seed";

export const DataContext = createContext<any>(null);

const hasCurrentSchema = (d: any) => {
  if (!d || typeof d !== "object") return false;
  if (!d.products || !Array.isArray(d.products) || d.products.length === 0) return false;
  if (!d.settings || typeof d.settings !== "object") return false;
  if (!Array.isArray(d.applications)) return false;
  return true;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any>(null);

  // Load sequence: local store (instant) → Supabase (3s timeout) → seed fallback
  useEffect(() => {
    (async () => {
      // 1. Try local store first (instant — no network wait)
      try {
        const local = await store.get(SK);
        if (local?.value) {
          const parsed = JSON.parse(local.value);
          if (hasCurrentSchema(parsed)) { setData(parsed); return; }
        }
      } catch (e: any) { /* continue to Supabase */ }

      // 2. Try Supabase with 3-second timeout (reads from 12 normalised tables)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const results = await sbLoadAll(controller.signal);
        clearTimeout(timeout);

        if (Object.keys(results).length > 0) {
          // Merge with seed defaults for any missing collections
          const seeded = seed();
          const merged = { ...seeded, ...results };
          if (!merged.settings) merged.settings = seeded.settings;
          if (hasCurrentSchema(merged)) { setData(merged); return; }
        }
      } catch (e: any) {
        console.log("Supabase load skipped:", e.name);
      }

      // 3. Seed fallback
      setData(seed());
    })();
  }, []);

  // Unified save — persists changes to Supabase + local store
  const save = useCallback(async (next: any) => {
    const prev = data;
    setData(next);

    // Persist to Supabase (differential — only changed rows)
    try {
      await sbSaveChanges(prev, next);
    } catch (e: any) {
      console.log("Supabase save error (non-fatal):", e.message);
    }

    // Also save to local store as fallback
    try { await store.set(SK, JSON.stringify(next)); } catch {}
  }, [data]);

  // Reset to seed data
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
