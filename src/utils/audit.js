// KwikBridge LMS — Audit and Alert Factories

import { uid } from "./ids.js";

export const addAudit = (action, entity, user, detail, category) => ({ id: uid(), action, entity, user, detail, ts: Date.now(), category });

export const addAlert = (type, severity, title, msg, extra = {}) => ({ id: uid(), type, severity, title, msg, read: false, ts: Date.now(), ...extra });
