import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
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
              <li key={`${day.day}-${day.source}`} className="max-w-full">
                <Badge
                  className="h-auto py-1 whitespace-normal"
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
      {/* Product types down, weeks across: how a planner reads a load chart. */}
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-[0.9375rem] tabular-nums">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr className="border-border bg-surface-subtle border-b">
              <th
                scope="col"
                className="text-muted bg-surface-subtle sticky start-0 z-10 px-4 py-2.5 text-start text-sm font-medium"
              >
                {t("table.type")}
              </th>
              {weeks.map((weekStart) => (
                <th
                  key={weekStart}
                  scope="col"
                  className="text-muted px-3 py-2.5 text-start text-sm font-medium whitespace-nowrap"
                >
                  {t("table.week", { date: format.date(weekStart, { style: "dayMonth" }) })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productTypes.map((type) => (
              <tr key={type.productTypeId} className="border-border border-b last:border-b-0">
                <th
                  scope="row"
                  className="bg-surface border-border sticky start-0 z-10 border-e px-4 py-3 text-start font-medium whitespace-nowrap"
                >
                  {type.productTypeNameTh}
                  <span className="text-muted block text-sm font-normal">
                    {type.unit && tUnits.has(type.unit) ? tUnits(type.unit) : (type.unit ?? "")}
                  </span>
                </th>
                {weeks.map((weekStart) => {
                  const week = type.weeks.find((item) => item.weekStart === weekStart);
                  if (!week)
                    return (
                      <td key={weekStart} className="text-muted px-3 py-3">
                        —
                      </td>
                    );
                  // Capacity is a count of pieces, sheets or jobs (decimal strings), never money.
                  const capacity = Number(week.capacity);
                  const booked = Number(week.booked);
                  const used = capacity ? Math.round((booked / capacity) * 100) : 0;
                  return (
                    <td key={weekStart} className="min-w-32 px-3 py-3 align-top">
                      {capacity ? (
                        <span className="flex flex-col gap-1">
                          <span
                            className={
                              used >= 90
                                ? "text-danger font-semibold"
                                : used >= 70
                                  ? "text-warning-subtle-fg font-semibold"
                                  : "font-medium"
                            }
                          >
                            {used}%
                          </span>
                          <Meter
                            label={type.productTypeNameTh}
                            value={used}
                            tone={used >= 90 ? "danger" : used >= 70 ? "warning" : "primary"}
                            valueText={t("load", {
                              booked: format.number(booked),
                              capacity: format.number(capacity),
                              unit: "",
                            })}
                          />
                          <span className="text-muted text-xs whitespace-nowrap">
                            {format.number(booked)} / {format.number(capacity)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted text-sm">{t("noCapacity")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PartnerPage>
  );
}
