// KwikBridge LMS — Store Adapter

declare global {
  interface Window { storage: any; }
}

export const store = {
  get: async (k) => { try { if (window.storage?.get) return await window.storage.get(k); const v = localStorage.getItem(k); return v ? { value: v } : null; } catch { return null; } },
  set: async (k, v) => { try { if (window.storage?.set) return await window.storage.set(k, v); localStorage.setItem(k, v); } catch {} },
};

export const SK = "kwikbridge-lms-data";
