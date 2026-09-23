import { redirect } from "next/navigation";

import { requireActor, signInUrl } from "@/features/shared/auth/guard";

/**
 * Every back-office screen sits under this layout, and every one of them needs a session.
 *
 * The guard is here rather than in each page so a new screen is protected by where it is put,
 * not by remembering to add a check. `(console)` and `(auth)` are route groups, so neither
 * appears in a URL: this is `/` on the admin host, and the login page is `/login`.
 *
 * Hiding a screen is not authorisation. The API enforces every permission (ADR-0005); this
 * only stops a signed-out visitor from rendering a shell they cannot fill.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("admin");
  if (!actor) redirect(await signInUrl());

  return <>{children}</>;
}
