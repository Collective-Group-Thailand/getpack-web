import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { factoryReferences } from "@/features/partner/onboarding/StepContent";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.capacity"))("title") };
}

/**
 * The factory's weeks (F5 5.2): weekly capacity per product type against the load its accepted
 * jobs book, and the days it does not work — the national calendar's and its own (D-101, D-161).
 * Capacity changes go through the Partner team (a change request).
 */
export default async function CapacityPage() {
  const t = await getTranslations("partnerJobs.capacity");
  const tUnits = await getTranslations("partnerOnboarding.capacity.units");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const [calendar, references] = await Promise.all([
    attempt(() =>
      requests.call("GET /v1/partner/factories/{factoryId}/capacity-calendar", {
        path: { factoryId: context.factoryId },
        query: { weeks: 6 },
      }),
    ),
    factoryReferences(context.factoryId),
  ]);
  if (!calendar.data)
    return (
      <PartnerPage title={t("title")}>
        <PageError error={calendar.error} />
      </PartnerPage>
    );

  return (
    <PartnerPage title={t("title")} description={t("body")} wide>
      {calendar.data.closures.length ? (
        <PartnerSection title={t("closures")}>
          <ul className="flex flex-wrap gap-2">
            {calendar.data.closures.map((closure) => (
              <li key={closure.date}>
                <Badge tone={closure.kind === "factory" ? "warning" : "neutral"} icon="calendar">
                  {t("closure", { date: format.date(closure.date), name: closure.name })}
                </Badge>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {calendar.data.weeks.map((week) => (
          <li key={week.weekStart}>
            <Card padding="md" className="flex flex-col gap-3">
              <h2 className="font-semibold">{t("week", { date: format.date(week.weekStart) })}</h2>
              {week.types.map((type) => {
                const capacity = Number(type.capacity);
                const booked = Number(type.booked);
                const used = capacity ? Math.round((booked / capacity) * 100) : 0;
                return (
                  <Meter
                    key={type.productTypeId}
                    label={references.typeName(type.productTypeId)}
                    value={used}
                    tone={used >= 90 ? "danger" : used >= 70 ? "warning" : "primary"}
                    valueText={t("load", {
                      booked: format.number(booked),
                      capacity: format.number(capacity),
                      unit: tUnits(type.unit),
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
