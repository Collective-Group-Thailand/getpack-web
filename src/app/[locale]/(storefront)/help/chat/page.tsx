import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { CsHandoff } from "@/features/customer/help/CsHandoff";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.guided");
  return { title: t("chatTitle"), description: t("chatIntro") };
}

/**
 * Talking to a person, as a page (F3 3.7): the hand-off to CS by LINE or a call back
 * (`store.support.handoff`); a signed-in customer can also write in the app (U5.3, `/account/messages`).
 */
export default async function Page() {
  const [t, jar] = await Promise.all([getTranslations("help.guided"), cookies()]);
  const signedIn = Boolean(readAccessToken(jar));
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-title leading-tight">{t("chatTitle")}</h1>
        <p className="text-muted mt-2">{t("chatIntro")}</p>
      </header>
      {signedIn ? (
        <Callout tone="info" title={t("inAppTitle")}>
          <p className="text-sm">{t("inAppBody")}</p>
          <Button asChild size="sm" className="mt-2" iconStart="chat">
            <Link href="/account/messages">{t("inAppAction")}</Link>
          </Button>
        </Callout>
      ) : null}
      <CsHandoff signedIn={signedIn} />
    </div>
  );
}
