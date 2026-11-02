import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AgentPage, Panel } from "@/features/agent/AgentPage";
import { requireActiveAgent } from "@/features/agent/context.server";
import { ShareLink } from "@/features/agent/share/ShareLink";
import { AGENT_ZONE_PATHS } from "@/features/shared/agent/zone-paths";
import { zoneOrigin } from "@/lib/zones/origin.server";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agentZone.quotes");
  return { title: t("title") };
}

/**
 * ใบเสนอราคา (D-467). Until agents send their own quotes, this tab shows the way a quote reaches a customer today and
 * counts as the agent's: the customer opens getpack.co through the agent's link, sees an instant price in the
 * configurator or asks for a quote, and orders in their own account. A real page with real actions — the link to
 * share, the storefront's two ways to a price, and registering the customer first — never a placeholder.
 */
export default async function Page() {
  const { agent, programme } = await requireActiveAgent();
  const [t, tz, storefront] = await Promise.all([
    getTranslations("agentZone.quotes"),
    getTranslations("agentZone.home"),
    zoneOrigin("customer"),
  ]);
  const steps = [
    { key: "share", icon: "share" as const },
    { key: "price", icon: "calculator" as const },
    { key: "order", icon: "coins" as const },
  ];

  return (
    <AgentPage title={t("title")} intro={t("intro", { days: programme.linkCookieDays })}>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.key} className="border-border bg-surface rounded-card flex flex-col gap-2 border p-4 sm:p-5">
            <span className="flex items-center gap-3">
              <span className="bg-primary-subtle text-primary grid size-10 shrink-0 place-items-center rounded-full">
                <Icon name={step.icon} size={20} aria-hidden="true" />
              </span>
              <span className="text-muted text-sm font-medium tabular-nums">{t("step", { n: index + 1 })}</span>
            </span>
            <h2 className="text-base font-semibold">{t(`steps.${step.key}.title`)}</h2>
            <p className="text-muted text-sm text-pretty">{t(`steps.${step.key}.body`)}</p>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel id="quotes-link" title={t("linkTitle")}>
          <p className="text-muted mb-3 text-sm">{t("linkBody")}</p>
          <p className="mb-3 text-sm font-medium break-all">{agent.link}</p>
          <ShareLink link={agent.link} code={agent.code} message={tz("shareMessage")} />
        </Panel>
        <Panel id="quotes-storefront" title={t("storefrontTitle")}>
          <p className="text-muted mb-3 text-sm">{t("storefrontBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" iconEnd="external">
              <a href={`${storefront}/products`} target="_blank" rel="noopener noreferrer">
                {t("openProducts")}
              </a>
            </Button>
          </div>
        </Panel>
      </div>

      <section
        aria-labelledby="quotes-protect"
        className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div>
          <h2 id="quotes-protect" className="font-semibold">
            {t("protectTitle")}
          </h2>
          <p className="mt-0.5 text-sm">{t("protectBody", { days: programme.leadProtectionDays })}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={AGENT_ZONE_PATHS.leads}>{t("protectAction")}</Link>
        </Button>
      </section>
    </AgentPage>
  );
}
