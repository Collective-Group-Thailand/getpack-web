import { redirect } from "next/navigation";

import { requireActor, signInUrl } from "@/features/shared/auth/guard";

/**
 * Every partner screen needs a session and a factory scope.
 *
 * As in the admin zone, the guard lives in the layout so a new screen is protected by where
 * it is put rather than by remembering. The API still enforces the `factory:<uuid>` scope on
 * every request (ADR-0004); this only stops a signed-out visitor rendering a shell.
 */
export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("partner");
  if (!actor) redirect(await signInUrl());

  return <>{children}</>;
}
