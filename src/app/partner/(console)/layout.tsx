import { redirect } from "next/navigation";

import { FactoryProvider } from "@/features/partner/context/FactoryProvider";
import { getFactoryContext } from "@/features/partner/context/server";
import { PartnerShell } from "@/features/partner/shell";
import { requireActor, signInUrl } from "@/features/shared/auth/guard";

/**
 * Every partner screen needs a session, and every one of them is inside the shop-floor shell.
 *
 * The guard is here rather than in each page so a new screen is protected by where it is put.
 * `getActor` and `getFactoryContext` are wrapped in React's `cache`, so the guard, the shell and
 * the page are one call to `/v1/partner/me` and one to `/v1/partner/factories`.
 *
 * A partner user always acts for one factory at a time: its id and the user's permissions are
 * handed to the client islands through `FactoryProvider`.
 */
export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("partner");
  if (!actor) redirect(await signInUrl());
  const context = await getFactoryContext();
  // A partner account with no factory scope has nothing to act for; the API would refuse every
  // call, so it is treated like no session.
  if (!context) redirect(await signInUrl());

  return (
    <PartnerShell context={context}>
      <FactoryProvider factoryId={context.factoryId} permissions={actor.permissions}>
        {children}
      </FactoryProvider>
    </PartnerShell>
  );
}
