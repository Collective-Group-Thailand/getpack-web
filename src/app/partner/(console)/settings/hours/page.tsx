import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { SettingsFrame } from "@/features/partner/settings/SettingsFrame";
import { ClosuresEditor } from "@/features/partner/settings/ClosuresEditor";
import { HoursEditor } from "@/features/partner/settings/HoursEditor";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.hours"))("title") };
}

/** The factory's working time (U2.F7, D-292, D-161): weekly hours by version, and its closures. */
export default async function HoursPage() {
  const [t, tClosures, tSettings, format, context] = await Promise.all([
    getTranslations("partnerAccount.hours"),
    getTranslations("partnerAccount.closures"),
    getTranslations("partnerAccount.settings"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { params: { path: { factoryId: context.factoryId } } };
  const [versions, closures] = await Promise.all([
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/business-hours", path)).data ?? []),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/closures", path)).data ?? []),
  ]);
  const inForce = versions.data?.find((v) => v.inForce) ?? null;
  const upcoming = (versions.data ?? []).filter((v) => !v.inForce && v.effectiveFrom > (inForce?.effectiveFrom ?? ""));

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/settings", label: tSettings("title") }}
    >
      <SettingsFrame current="hours">
        {/* The week on the left, the days that break it on the right: two settings, each saved on its own. */}
        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:gap-8">
          {versions.data ? (
            <PartnerSection
              title={t("weekTitle")}
              description={inForce ? t("inForce", { date: format.date(inForce.effectiveFrom) }) : t("platformDefault")}
            >
              {upcoming.length ? (
                <Callout tone="info">
                  {t("upcoming", { dates: upcoming.map((v) => format.date(v.effectiveFrom)).join(", ") })}
                </Callout>
              ) : null}
              <HoursEditor current={inForce?.hours ?? null} />
            </PartnerSection>
          ) : (
            <PageError error={versions.error} />
          )}
          <aside className="flex min-w-0 flex-col 2xl:sticky 2xl:top-20">
            {closures.data ? (
              <PartnerSection title={tClosures("title")} description={tClosures("body")}>
                <ClosuresEditor days={closures.data} />
              </PartnerSection>
            ) : (
              <PageError error={closures.error} />
            )}
          </aside>
        </div>
      </SettingsFrame>
    </PartnerPage>
  );
}
