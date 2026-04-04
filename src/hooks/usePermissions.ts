// KwikBridge LMS — usePermissions Hook
// Wraps permission functions with the current user's role.
// UI components use this instead of importing PERMS directly.

import { ROLES, PERMS, APPROVAL_LIMITS } from "../constants/roles";

export function usePermissions(currentUser) {
  const role = currentUser?.role || "VIEWER";

  const can = (module, action) => {
    const perms = PERMS[module]?.[role] || "";
    return perms.split(",").includes(action);
  };

  const canAny = (module, actions) => actions.some(a => can(module, a));

  const canDo = (module, action) => can(module, action);

  const canDoAny = (module, actions) => canAny(module, actions);

  const approvalLimit = () => APPROVAL_LIMITS[role] || 0;

  return { can, canAny, canDo, canDoAny, approvalLimit, role };
}
