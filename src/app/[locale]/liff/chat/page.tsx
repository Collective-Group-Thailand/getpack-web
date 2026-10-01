import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { CsHandoff } from "@/features/customer/help/CsHandoff";
import { readAccessToken } from "@/lib/auth/session";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.chat");
  return { title: t("title") };
}

/** Chat with CS from LINE (D-151): straight to the OA chat, or the hand-off to CS with the page (guided help waits for U2.2, D-223). */
export default async function Page() {
  const [t, channels, jar] = await Promise.all([getTranslations("liff.chat"), getSupportChannels(), cookies()]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("intro")}</p>
      {channels?.lineOaId ? (
        <Button asChild iconStart="chat">
          <a href={`https://line.me/R/oaMessage/${encodeURIComponent(channels.lineOaId)}/`}>{t("open")}</a>
        </Button>
      ) : null}
      {channels?.hours ? <p className="text-muted text-sm">{t("hours", { hours: channels.hours })}</p> : null}
      <CsHandoff signedIn={Boolean(readAccessToken(jar))} />
    </div>
  );
}
