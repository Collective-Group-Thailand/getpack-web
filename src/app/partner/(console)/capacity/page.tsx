import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { WeekCapacity } from "@/features/partner/capacity/WeekCapacity";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Meter } from "@/ui/components/Meter";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerJobs.capacity"))("title") };
}

/**
 * The factory's weeks (F5 5.2, `partner.factories.capacityCalendar`): weekly capacity per product
 * type against the load its accepted jobs book, and the days that differ from its working week —
 * the national calendar's holidays and its own closures (D-101, D-161). A planner with
 * `factory_capacity.manage` changes one week's capacity in place (a holiday, an overhaul, an extra shift);
 * its standing weekly capacity still changes through the Partner team; closures are edited in U2.9.
 */
export default async function CapacityPage() {
  const [t, tHours, tClosures, tUnits, format, locale] = await Promise.all([
    getTranslations("partnerJobs.capacity"),
    getTranslations("partnerAccount.hours"),
    getTranslations("partnerAccount.closures"),
    getTranslations("partnerOnboarding.capacity.units"),
    getFormat(),
    getLocale(),
  ]);
  const context = await factoryContext();
  const manage = canAt(context, "factory_capacity.manage");
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

  // Capacity is a count of pieces, sheets or jobs (decimal strings), never money; the share is booked ÷ capacity.
  const cellOf = (type: (typeof productTypes)[number], weekStart: string) => {
    const week = type.weeks.find((item) => item.weekStart === weekStart);
    if (!week) return null;
    const capacity = Number(week.capacity);
    const booked = Number(week.booked);
    const used = capacity ? Math.round((booked / capacity) * 100) : 0;
    const tone = used >= 90 ? ("danger" as const) : used >= 70 ? ("warning" as const) : ("primary" as const);
    const pct = `${used}%`;
    const ratio = `${format.number(booked)} / ${format.number(capacity)}`;
    return { week, capacity, booked, used, tone, pct, ratio };
  };
  const toneText = {
    danger: "text-danger font-semibold",
    warning: "text-warning-subtle-fg font-semibold",
    primary: "font-medium",
  };
  const unitOf = (unit: string | null) => (unit && tUnits.has(unit) ? tUnits(unit) : (unit ?? ""));
  const weekHeader = (weekStart: string) => t("table.week", { date: format.date(weekStart, { style: "dayMonth" }) });

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        manage ? (
          <Button asChild size="lg" variant="secondary" iconStart="clock">
            <Link href="/settings/hours">{tHours("title")}</Link>
          </Button>
        ) : undefined
      }
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8">
        {/* Product types down, weeks across: how a planner reads a load chart. */}
        <div className="border-border bg-surface hidden overflow-x-auto rounded-xl border md:block">
          <table className="w-full border-collapse text-base tabular-nums">
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
                    {weekHeader(weekStart)}
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
                    <span className="text-muted block text-sm font-normal">{unitOf(type.unit)}</span>
                  </th>
                  {weeks.map((weekStart) => {
                    const cell = cellOf(type, weekStart);
                    if (!cell)
                      return (
                        <td key={weekStart} className="text-muted px-3 py-3">
                          —
                        </td>
                      );
                    return (
                      <td key={weekStart} className="min-w-28 px-3 py-2.5 align-top">
                        {cell.capacity ? (
                          <span className="flex flex-col gap-1.5">
                            <span className="flex items-center justify-between gap-1">
                              <span className={toneText[cell.tone]}>{cell.pct}</span>
                              {manage ? (
                                <WeekCapacity
                                  trigger="icon"
                                  productTypeId={type.productTypeId}
                                  productTypeName={type.productTypeNameTh}
                                  weekStart={weekStart}
                                  weekLabel={format.date(weekStart, { style: "dayMonth" })}
                                  capacity={cell.week.capacity}
                                />
                              ) : null}
                            </span>
                            <Meter
                              label={type.productTypeNameTh}
                              value={cell.used}
                              tone={cell.tone}
                              valueText={t("load", {
                                booked: format.number(cell.booked),
                                capacity: format.number(cell.capacity),
                                unit: "",
                              })}
                            />
                            <span className="text-muted text-xs whitespace-nowrap">{cell.ratio}</span>
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

        {/* A phone reads one product type at a time, its weeks down the card. */}
        <ul className="flex flex-col gap-3 md:hidden">
          {productTypes.map((type) => (
            <li key={type.productTypeId} className="border-border bg-surface rounded-xl border">
              <p className="border-border border-b px-4 py-3 font-semibold">
                {type.productTypeNameTh}
                <span className="text-muted ms-2 text-sm font-normal">{unitOf(type.unit)}</span>
              </p>
              <ul className="divide-border divide-y">
                {weeks.map((weekStart) => {
                  const cell = cellOf(type, weekStart);
                  return (
                    <li key={weekStart} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-muted w-24 shrink-0 text-sm">{weekHeader(weekStart)}</span>
                      {cell?.capacity ? (
                        <>
                          <span className="min-w-0 flex-1">
                            <Meter
                              label={type.productTypeNameTh}
                              value={cell.used}
                              tone={cell.tone}
                              valueText={t("load", {
                                booked: format.number(cell.booked),
                                capacity: format.number(cell.capacity),
                                unit: "",
                              })}
                            />
                          </span>
                          <span className={`w-12 text-end tabular-nums ${toneText[cell.tone]}`}>{cell.pct}</span>
                          {manage ? (
                            <WeekCapacity
                              trigger="icon"
                              productTypeId={type.productTypeId}
                              productTypeName={type.productTypeNameTh}
                              weekStart={weekStart}
                              weekLabel={format.date(weekStart, { style: "dayMonth" })}
                              capacity={cell.week.capacity}
                            />
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted text-sm">{cell ? t("noCapacity") : "—"}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        {/* The days that differ from the working week, beside the weeks they fall in. */}
        <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20">
          <PartnerSection title={t("closures")}>
            {days.length ? (
              <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                {days.map((day) => (
                  <li key={`${day.day}-${day.source}`} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <Badge
                      tone={
                        day.kind === "extra_working_day" ? "info" : day.source === "factory" ? "warning" : "neutral"
                      }
                      icon="calendar"
                    >
                      {format.date(day.day, { style: "dayMonth" })}
                    </Badge>
                    <span className="flex min-w-0 flex-col break-keep">
                      {locale === "en" ? (day.nameEn ?? day.nameTh) : day.nameTh}
                      <span className="text-muted text-xs">{tClosures(`kinds.${day.kind}`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="calendar"
                title={tClosures("none")}
                action={
                  manage ? (
                    <Button asChild variant="secondary" iconStart="clock">
                      <Link href="/settings/hours">{tHours("title")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </PartnerSection>
        </aside>
      </div>
    </PartnerPage>
  );
}
