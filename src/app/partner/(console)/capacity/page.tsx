import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.capacity"))("title") };
}

/**
 * The factory's weeks (F5 5.2, `partner.factories.capacityCalendar`): weekly capacity per product
 * type against the load its accepted jobs book, and the days that differ from its working week —
 * the national calendar's holidays and its own closures (D-101, D-161). The factory changes its
 * capacity through the Partner team (a change request); its own closures are edited in U2.9.
 */
export default async function CapacityPage() {
  const [t, tUnits, format, locale] = await Promise.all([
    getTranslations("partnerJobs.capacity"),
    getTranslations("partnerOnboarding.capacity.units"),
    getFormat(),
    getLocale(),
  ]);
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const calendar = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/capacity-calendar", {
          params: { path: { factoryId: context.factoryId }, query: { weeks: 6 } },
        })
      ).data!,
  );
  if (!calendar.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={calendar.error} />
      </PartnerPage>
    );
  const { days, productTypes } = calendar.data;
  const weeks = [...new Set(productTypes.flatMap((type) => type.weeks.map((week) => week.weekStart)))].sort();

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {days.length ? (
        <PartnerSection title={t("closures")}>
          <ul className="flex flex-wrap gap-2">
            {days.map((day) => (
              <li key={`${day.day}-${day.source}`}>
                <Badge
                  tone={day.kind === "extra_working_day" ? "info" : day.source === "factory" ? "warning" : "neutral"}
                  icon="calendar"
                >
                  {t(`dayKinds.${day.kind}`, {
                    date: format.date(day.day),
                    name: locale === "en" ? (day.nameEn ?? day.nameTh) : day.nameTh,
                  })}
                </Badge>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {weeks.map((weekStart) => (
          <li key={weekStart}>
            <Card padding="md" className="flex flex-col gap-3">
              <h2 className="font-semibold">{t("week", { date: format.date(weekStart) })}</h2>
              {productTypes.map((type) => {
                const week = type.weeks.find((item) => item.weekStart === weekStart);
                if (!week) return null;
                // Capacity is a count of pieces, sheets or jobs (decimal strings), never money.
                const capacity = Number(week.capacity);
                const booked = Number(week.booked);
                const used = capacity ? Math.round((booked / capacity) * 100) : 0;
                return (
                  <Meter
                    key={type.productTypeId}
                    label={type.productTypeNameTh}
                    value={used}
                    tone={used >= 90 ? "danger" : used >= 70 ? "warning" : "primary"}
                    valueText={t("load", {
                      booked: format.number(booked),
                      capacity: format.number(capacity),
                      unit: type.unit && tUnits.has(type.unit) ? tUnits(type.unit) : (type.unit ?? ""),
                    })}
                  />
                );
              })}
            </Card>
          </li>
        ))}
      </ul>
    </PartnerPage>
  );
}
