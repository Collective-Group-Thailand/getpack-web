import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ClosuresEditor } from "@/features/partner/settings/ClosuresEditor";
import { HoursEditor } from "@/features/partner/settings/HoursEditor";
import { getFormat } from "@/features/shared/format/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerAccount.hours"))("title") };
}

/** The factory's working time (U2.F7, D-292, D-161): weekly hours by version, and its closures. */
export default async function HoursPage() {
  const [t, tClosures, format, context] = await Promise.all([
    getTranslations("partnerAccount.hours"),
    getTranslations("partnerAccount.closures"),
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
    <PartnerPage title={t("title")} description={t("body")}>
      {versions.data ? (
        <PartnerSection
          title={t("weekTitle")}
          description={inForce ? t("inForce", { date: format.date(inForce.effectiveFrom) }) : t("platformDefault")}
        >
          {upcoming.length ? (
            <p className="text-sm">
              {t("upcoming", { dates: upcoming.map((v) => format.date(v.effectiveFrom)).join(", ") })}
            </p>
          ) : null}
          <HoursEditor current={inForce?.hours ?? null} />
        </PartnerSection>
      ) : (
        <PageError error={versions.error} />
      )}
      {closures.data ? (
        <PartnerSection title={tClosures("title")} description={tClosures("body")}>
          <ClosuresEditor days={closures.data} />
        </PartnerSection>
      ) : (
        <PageError error={closures.error} />
      )}
    </PartnerPage>
  );
}
