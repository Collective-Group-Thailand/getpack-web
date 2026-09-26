import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { GuidedHelp } from "@/features/customer/help/GuidedHelp";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("liff.chat");
  return { title: t("title") };
}

/** Chat with CS from LINE (D-151): straight to the OA chat, or the guided hand-off with context. */
export default async function Page() {
  const [t, channels] = await Promise.all([getTranslations("liff.chat"), getSupportChannels()]);
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
      <GuidedHelp />
    </div>
  );
}
