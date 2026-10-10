import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ScheduleBoard } from "@/features/partner/ops/ScheduleBoard";
import { ViewTabs } from "@/features/partner/rows";
import { Button } from "@/ui/components/Button";

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
  const [t, tPlan, context] = await Promise.all([
    getTranslations("partnerOps.schedule"),
    getTranslations("partnerFactory.planning"),
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

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/planning", label: tPlan("title") }}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" iconStart="chevron-left">
            <Link href={href({ from: shift(from, -days) })}>{t("prev")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={href({ from: today })}>{t("today")}</Link>
          </Button>
          <Button asChild variant="secondary" iconEnd="chevron-right">
            <Link href={href({ from: shift(from, days) })}>{t("next")}</Link>
          </Button>
        </div>
      }
    >
      <ViewTabs
        label={t("days.label")}
        current={String(days)}
        items={DAYS.map((d) => ({ key: d, href: href({ days: Number(d) }), label: t(`days.${d}`) }))}
      />
      {read.data ? (
        <ScheduleBoard
          board={read.data.board}
          machines={read.data.machines.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name }))}
          days={days}
          canManage={canAt(context, "factory_planning.manage")}
        />
      ) : (
        <PageError error={read.error} />
      )}
    </PartnerPage>
  );
}
