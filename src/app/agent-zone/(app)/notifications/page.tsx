import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getNotificationPreferences } from "@/features/agent/api.server";
import { AgentPage } from "@/features/agent/AgentPage";
import { requireActiveAgent } from "@/features/agent/context.server";
import { CHANNELS, PreferencesMatrix, reachableFor } from "@/features/agent/notifications/PreferencesMatrix";
import { PushOnThisDevice } from "@/features/agent/notifications/PushOnThisDevice";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.notifications");
  return { title: t("title") };
}

/**
 * การแจ้งเตือน (D-467): push on this device, then which events reach the agent on which channel. When LINE or e-mail
 * cannot reach the person (`reachable`), a line above the switches says why, so a switch that is on but silent
 * never looks broken.
 */
export default async function Page() {
  await requireActiveAgent();
  const [t, preferences] = await Promise.all([
    getTranslations("agentZone.notifications"),
    getNotificationPreferences(),
  ]);
  const unreachable = CHANNELS.filter((channel) => channel !== "web_push" && !reachableFor(preferences.reachable, channel));

  return (
    <AgentPage title={t("title")} intro={t("intro")}>
      <PushOnThisDevice />
      <section aria-labelledby="pref-matrix" className="flex flex-col gap-3">
        <div>
          <h2 id="pref-matrix" className="text-lg font-semibold">
            {t("matrixTitle")}
          </h2>
          <p className="text-muted mt-0.5 text-sm">{t("matrixIntro")}</p>
        </div>
        {unreachable.length > 0 ? (
          <Callout tone="info" title={t("unreachableTitle")}>
            <ul className="flex flex-col gap-1">
              {unreachable.map((channel) => (
                <li key={channel}>{t(`unreachable.${channel}`)}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <PreferencesMatrix initial={preferences} />
      </section>
    </AgentPage>
  );
}
