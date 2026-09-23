import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/features/admin/shell";
import { NAV_COOKIE, isNavState } from "@/features/admin/shell";
import { requireActor, signInUrl } from "@/features/shared/auth/guard";
import { clientEnv } from "@/lib/env";

/**
 * Every back-office screen sits under this layout, and every one of them needs a session.
 *
 * The guard is here rather than in each page so a new screen is protected by where it is put,
 * not by remembering to add a check. `(console)` and `(auth)` are route groups, so neither
 * appears in a URL: this is `/` on the admin host, and the login page is `/login`.
 *
 * Hiding a screen is not authorisation. The API enforces every permission (ADR-0005); this
 * only stops a signed-out visitor from rendering a shell they cannot fill.
 *
 * The same `/v1/admin/me` call feeds the guard and the sidebar — `getActor` is wrapped in
 * React's `cache`, so the two uses are one request.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("admin");
  if (!actor) redirect(await signInUrl());

  // Read before the first byte, so the sidebar never renders open and then snaps shut.
  const nav = (await cookies()).get(NAV_COOKIE)?.value;

  return (
    <AdminShell
      actor={actor}
      menu={actor.menu}
      initialNav={isNavState(nav) ? nav : "open"}
      envBadge={clientEnv.NEXT_PUBLIC_ENV_BADGE}
    >
      {children}
    </AdminShell>
  );
}
