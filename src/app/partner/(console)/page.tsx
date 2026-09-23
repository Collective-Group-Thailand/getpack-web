import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { requireActor } from "@/features/shared/auth/guard";
import { Badge, Card } from "@/ui";

/**
 * Placeholder for the partner zone, now behind the session guard. The shop-floor shell —
 * bottom nav, big targets, offline feedback — is F5.
 */
export default async function PartnerHomePage() {
  const [t, actor] = await Promise.all([getTranslations("partner.placeholder"), requireActor("partner")]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <p className="text-muted mt-2">{t("body")}</p>

      {actor ? (
        <Card className="mt-8" padding="lg">
          <p className="font-medium" data-testid="actor-name">
            {actor.displayName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="actor-factories">
            {actor.factories.map((factory) => (
              <Badge key={factory.id}>{factory.name}</Badge>
            ))}
          </div>
          <div className="mt-4">
            <SignOutButton zone="partner" />
          </div>
        </Card>
      ) : null}
    </main>
  );
}
