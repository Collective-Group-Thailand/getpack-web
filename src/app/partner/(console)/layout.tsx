import { redirect } from "next/navigation";

import { PartnerShell } from "@/features/partner/shell";
import { requireActor, signInUrl } from "@/features/shared/auth/guard";

/**
 * Every partner screen needs a session, and every one of them is inside the shop-floor shell.
 *
 * The guard is here rather than in each page so a new screen is protected by where it is put.
 * `getActor` is wrapped in React's `cache`, so the guard and the shell's topbar are one call
 * to `/v1/partner/me`.
 */
export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("partner");
  if (!actor) redirect(await signInUrl());

  return <PartnerShell actor={actor}>{children}</PartnerShell>;
}
