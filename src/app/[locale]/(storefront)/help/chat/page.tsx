import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { CsHandoff } from "@/features/customer/help/CsHandoff";
import { readAccessToken } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.guided");
  return { title: t("chatTitle"), description: t("chatIntro") };
}

/**
 * Talking to a person, as a page (F3 3.7): the hand-off to CS by LINE or a call back
 * (`store.support.handoff`). Guided help's questions wait for the Structure Advisor (U2.2,
 * D-223), so this offers the hand-off alone.
 */
export default async function Page() {
  const [t, jar] = await Promise.all([getTranslations("help.guided"), cookies()]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold">{t("chatTitle")}</h1>
        <p className="text-muted mt-2">{t("chatIntro")}</p>
      </header>
      <CsHandoff signedIn={Boolean(readAccessToken(jar))} />
    </div>
  );
}
