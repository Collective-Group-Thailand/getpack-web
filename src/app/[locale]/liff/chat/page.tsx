import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { CsHandoff } from "@/features/customer/help/CsHandoff";
import { readAccessToken } from "@/lib/auth/session";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.chat");
  return { title: t("title") };
}

/** Chat with CS from LINE (D-151): straight to the OA chat, or the hand-off to CS with the page (guided help waits for U2.2, D-223). */
export default async function Page() {
  const [t, channels, jar] = await Promise.all([getTranslations("liff.chat"), getSupportChannels(), cookies()]);
  return (
    // Project D: talking to the team as one card — what it is for, the big button into the LINE chat, the hours.
    <div className="flex flex-col gap-4">
      <LiffHeader title={t("title")} />
      <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4">
        <span
          aria-hidden="true"
          className="bg-primary-subtle text-primary-subtle-fg grid size-11 place-items-center rounded-lg"
        >
          <Icon name="chat" size={22} />
        </span>
        <p className="text-pretty">{t("intro")}</p>
        {channels?.lineOaId ? (
          <Button asChild size="lg" iconStart="chat" className="w-full">
            <a href={`https://line.me/R/oaMessage/${encodeURIComponent(channels.lineOaId)}/`}>{t("open")}</a>
          </Button>
        ) : null}
        {channels?.hours ? (
          <p className="text-muted flex items-center gap-2 text-sm">
            <Icon name="clock" size={16} aria-hidden="true" />
            {t("hours", { hours: channels.hours })}
          </p>
        ) : null}
      </section>
      <CsHandoff signedIn={Boolean(readAccessToken(jar))} />
    </div>
  );
}
