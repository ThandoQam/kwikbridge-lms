// KwikBridge LMS — DPD and Stage

export const now = Date.now();
export const day = 864e5;

export const dpd = due => due ? Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 864e5)) : 0;
export const stage = d => d <= 30 ? 1 : d <= 90 ? 2 : 3;
