"use client";

import { createContext, useContext } from "react";

import type { StaffMe } from "@/lib/api/types";

const ActorContext = createContext<StaffMe | null>(null);

/**
 * The signed-in staff member, from the same `/v1/admin/me` call the layout's guard made.
 *
 * `useCan` exists to *hide* what cannot succeed — the API is the enforcement point (ADR-0005).
 * It answers from the permission keys the API sent; it never infers anything from a role name,
 * because fourteen roles with SoD pairs expressed as `roles.includes(…)` is a second permission
 * system that disagrees with the real one.
 */
export function ActorProvider({ actor, children }: { actor: StaffMe; children: React.ReactNode }) {
  return <ActorContext.Provider value={actor}>{children}</ActorContext.Provider>;
}

export function useActor(): StaffMe {
  const actor = useContext(ActorContext);
  if (!actor) throw new Error("useActor must be used inside the admin console layout");
  return actor;
}

export function useCan(...permissions: string[]): boolean {
  const actor = useActor();
  return permissions.every((permission) => actor.permissions.includes(permission));
}
