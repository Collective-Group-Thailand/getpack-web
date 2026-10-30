import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ScheduleBoard } from "@/features/partner/ops/ScheduleBoard";
import { ViewTabs } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.schedule"))("title") };
}

const DAYS = ["1", "3", "7"] as const;
/** Today in Bangkok as `YYYY-MM-DD`; the board opens on it. */
const bangkokDate = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The machine schedule (D-352): each machine's work over 1, 3 or 7 days, moved by hand or planned automatically. */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string }>;
}) {
  const query = await searchParams;
  const today = bangkokDate();
  const from = query.from && DAY.test(query.from) ? query.from : today;
  const days = DAYS.includes(query.days as (typeof DAYS)[number]) ? Number(query.days) : 3;
  const [t, tPlan, format, context] = await Promise.all([
    getTranslations("partnerOps.schedule"),
    getTranslations("partnerFactory.planning"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const read = await attempt(async () => {
    const [board, machines] = await Promise.all([
      contract.GET("/v1/partner/factories/{factoryId}/erp/schedule", { params: { path, query: { from, days } } }),
      contract.GET("/v1/partner/factories/{factoryId}/erp/machines", { params: { path } }),
    ]);
    return { board: board.data!, machines: machines.data! };
  });
  const href = (next: { from?: string; days?: number }) =>
    `/planning/schedule${queryOf({ from: (next.from ?? from) === today ? undefined : (next.from ?? from), days: next.days ?? days })}`;

  const last = shift(from, days - 1);
  const range = days === 1 ? format.date(from) : `${format.date(from)} – ${format.date(last)}`;
  // The window controls: how many days, then back / today / forward and the dates shown — one group, left of the
  // board's primary action.
  const nav = (
    <>
      <ViewTabs
        label={t("days.label")}
        current={String(days)}
        items={DAYS.map((d) => ({ key: d, href: href({ days: Number(d) }), label: t(`days.${d}`) }))}
      />
      <div className="flex items-center gap-1.5">
        <IconButton asChild name="chevron-left" label={t("prev")} variant="secondary">
          <Link href={href({ from: shift(from, -days) })} />
        </IconButton>
        <Button asChild variant="secondary" aria-current={from === today ? "date" : undefined}>
          <Link href={href({ from: today })}>{t("today")}</Link>
        </Button>
        <IconButton asChild name="chevron-right" label={t("next")} variant="secondary">
          <Link href={href({ from: shift(from, days) })} />
        </IconButton>
      </div>
      <p className="text-sm font-medium tabular-nums" aria-live="polite">
        {range}
      </p>
    </>
  );

  return (
    <PartnerPage full title={t("title")} description={t("body")} back={{ href: "/planning", label: tPlan("title") }}>
      {read.data ? (
        <ScheduleBoard
          board={read.data.board}
          machines={read.data.machines.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }))}
          days={days}
          canManage={canAt(context, "factory_planning.manage")}
          nav={nav}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
