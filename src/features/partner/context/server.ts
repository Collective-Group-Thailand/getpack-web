import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { serverApi } from "@/lib/api/server";
import { serverRequests } from "@/lib/api/requests/server";
import type { PartnerMe, Schemas } from "@/lib/api/types";
import { signInUrl } from "@/features/shared/auth/guard";
import { getActor } from "@/lib/auth/actor";

import { FACTORY_COOKIE } from "./cookie";

export type OwnFactory = Schemas["FactoryDto"];

export interface FactoryContext {
  actor: PartnerMe;
  /** The factory this user is acting for now — one of `actor.factories` (token scopes). */
  factoryId: string;
  /** The factory itself: name, status and onboarding progress. */
  factory: OwnFactory | null;
  /** Every factory this user may act for, for the switcher; usually one. */
  factories: OwnFactory[];
  roles: string[];
}

/**
 * Which factory a partner user is acting for, from their `/me` and the `pk_factory` cookie.
 *
 * `/me` names factories by id only (`partner.factory-name`), so their names come from
 * `GET /v1/partner/factories`, which lists exactly the token's scopes (D-044). Cached per render,
 * like `getActor`, so the shell, the layout and the page ask once.
 */
export const getFactoryContext = cache(async (): Promise<FactoryContext | null> => {
  const actor = await getActor("partner");
  if (!actor || actor.factories.length === 0) return null;
  const chosen = (await cookies()).get(FACTORY_COOKIE)?.value;
  const access = actor.factories.find((factory) => factory.factoryId === chosen) ?? actor.factories[0]!;
  let factories: OwnFactory[] = [];
  try {
    factories = (await (await serverApi("partner")).GET("/v1/partner/factories", {})).data?.data ?? [];
  } catch {
    // The shell still renders with roles only; the page reports its own failure.
  }
  return {
    actor,
    factoryId: access.factoryId,
    factory: factories.find((factory) => factory.id === access.factoryId) ?? null,
    factories,
    roles: access.roles,
  };
});

/**
 * The factory context for a page. A page renders in parallel with its layout, so the layout's
 * sign-in redirect does not stop the page running: each page asks here, and is sent to sign in
 * the same way when there is no session.
 */
export async function factoryContext(): Promise<FactoryContext> {
  const context = await getFactoryContext();
  if (!context) redirect(await signInUrl());
  return context;
}

/** True when the signed-in user may do this at the factory they are acting for. */
export function canAt(context: FactoryContext, permission: string): boolean {
  return context.actor.permissions.includes(permission);
}

/** Both clients a partner Server Component reads with. */
export async function partnerServerApis() {
  const [contract, requests] = await Promise.all([serverApi("partner"), serverRequests("partner")]);
  return { contract, requests };
}

/**
 * Runs a read and hands back its data, or `null` with the error for the page to show — a
 * Server Component cannot keep a TanStack error state, and a failed read should not take the
 * whole zone down to its error boundary.
 */
export async function attempt<T>(read: () => Promise<T>): Promise<{ data: T | null; error: unknown }> {
  try {
    return { data: await read(), error: null };
  } catch (error) {
    return { data: null, error };
  }
}
