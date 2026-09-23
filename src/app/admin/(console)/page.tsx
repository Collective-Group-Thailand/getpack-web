import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { requireActor } from "@/features/shared/auth/guard";
import { Badge, Card } from "@/ui";

/**
 * Placeholder for the admin zone, now behind the session guard.
 *
 * It shows who is signed in and what the API says they are, which is the smallest thing that
 * proves the whole chain — cookie, BFF, `/v1/admin/me`, guard — actually works. The real
 * shell (sidebar built from the menu entitlements, topbar, command palette) is F1 1.3.
 */
export default async function AdminHomePage() {
  const [t, actor] = await Promise.all([getTranslations("admin.placeholder"), requireActor("admin")]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <p className="text-muted mt-2">{t("body")}</p>

      {actor ? (
        <Card className="mt-8" padding="lg">
          <p className="font-medium" data-testid="actor-name">
            {actor.displayName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="actor-roles">
            {actor.roles.map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
          <div className="mt-4">
            <SignOutButton zone="admin" />
          </div>
        </Card>
      ) : null}
    </main>
  );
}
