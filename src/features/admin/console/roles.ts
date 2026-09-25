"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * A role key as people read it. `RoleDto` carries names, but reading roles needs `users.read`,
 * which most approvers lack — so the D-140 names live in `admin.roles` too, and an unknown key
 * shows as itself rather than disappearing.
 */
export function useRoleLabel() {
  const t = useTranslations("admin.roles");
  return useCallback((key: string) => (t.has(key) ? t(key) : key), [t]);
}
