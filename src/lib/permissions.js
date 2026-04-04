// KwikBridge LMS — Permission Functions

import { ROLES, PERMS, APPROVAL_LIMITS } from "../constants/roles.js";

export function can(userRole, module, action) {
  const perms = PERMS[module]?.[userRole] || "";
  return perms.split(",").includes(action);
}

export function canAny(userRole, module, actions) {
  return actions.some(a => can(userRole, module, a));
}

export function approvalLimit(userRole) {
  return APPROVAL_LIMITS[userRole] || 0;
}

