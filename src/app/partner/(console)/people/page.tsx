import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatQty } from "@/features/partner/erp/format";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ShiftAdd, ShiftManager, SkillManager } from "@/features/partner/insight/PeopleForms";
import { erpMachines } from "@/features/partner/insight/server";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { erpSalespeople } from "@/features/partner/sales/server";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerInsight.people"))("title") };
}

const VIEWS = ["shifts", "skills", "log"] as const;
type View = (typeof VIEWS)[number];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bangkokDay = (offset: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/** People-lite (D-380): the shifts, who can run which machine, and who did what on the floor. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "shifts";
  const [t, tPlan, format, context] = await Promise.all([
    getTranslations("partnerInsight.people"),
    getTranslations("partnerFactory.planning"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canManage = canAt(context, "factory_people.manage");
  // Shifts and skills are read on every view: each is a tab's count.
  const [shifts, skills] = await Promise.all([
    attempt(
      async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/shifts", { params: { path } })).data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/operator-skills", { params: { path } })).data!,
    ),
  ]);
  const counts: Record<View, number | null> = {
    shifts: shifts.data?.length ?? null,
    skills: skills.data?.length ?? null,
    log: null,
  };
  let body: React.ReactNode;
  let tools: React.ReactNode = null;
  if (view === "shifts") {
    body = shifts.data ? <ShiftManager shifts={shifts.data} canEdit={canManage} /> : <PageError error={shifts.error} />;
    tools = canManage && shifts.data?.length ? <ShiftAdd /> : null;
  } else if (view === "skills") {
    const [people, machines] = await Promise.all([
      attempt(async () => erpSalespeople(contract, context.factoryId)),
      attempt(async () => erpMachines(contract, context.factoryId)),
    ]);
    body = skills.data ? (
      <SkillManager
        skills={skills.data}
        people={(people.data ?? []).map((p) => ({ id: p.id, label: p.name }))}
        machines={machines.data ?? []}
        canEdit={canManage}
      />
    ) : (
      <PageError error={skills.error} />
    );
  } else {
    const to = query.to && DAY.test(query.to) ? query.to : bangkokDay(0);
    const from = query.from && DAY.test(query.from) ? query.from : bangkokDay(-6);
    const read = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/work-log", {
            params: { path, query: { from, to } },
          })
        ).data!,
    );
    if (read.data) counts.log = read.data.rows.length;
    // The period sits in the toolbar beside the tabs, where a search sits on the other lists.
    tools = (
      <form className="flex flex-wrap items-center gap-2" action="/people">
        <input type="hidden" name="view" value="log" />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t("from")}</span>
          <Input type="date" name="from" defaultValue={from} className="w-40" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t("to")}</span>
          <Input type="date" name="to" defaultValue={to} className="w-40" />
        </label>
        <Button type="submit" variant="secondary">
          {t("show")}
        </Button>
      </form>
    );
    body = (
      <>
        {read.data ? (
          <PartnerTable
            caption={t("views.log")}
            rows={read.data.rows}
            rowKey={(row) => `${row.user.id}-${row.day}`}
            empty={
              <EmptyState
                icon="users"
                title={t("logEmpty")}
                action={
                  <Button asChild variant="secondary" iconStart="play">
                    <Link href="/floor">{tPlan("floor")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              { key: "d", header: t("day"), cell: (row) => format.date(row.day) },
              { key: "u", header: t("person"), primary: true, cell: (row) => row.user.name },
              { key: "o", header: t("operations"), align: "end", cell: (row) => format.number(row.operations) },
              { key: "r", header: t("runMinutes"), align: "end", cell: (row) => format.number(row.runMinutes) },
              { key: "g", header: t("good"), align: "end", cell: (row) => formatQty(row.good, format.locale) },
              {
                key: "s",
                header: t("scrap"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => formatQty(row.scrap, format.locale),
              },
              { key: "m", header: t("machines"), hideOnPhone: true, cell: (row) => row.machines.join(", ") },
            ]}
          />
        ) : (
          <PageError error={read.error} />
        )}
      </>
    );
  }
  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({
            key,
            href: `/people${queryOf({ view: key === "shifts" ? undefined : key })}`,
            label: t(`views.${key}`),
            count: counts[key],
          }))}
        />
        {tools}
      </ListToolbar>
      {body}
    </PartnerPage>
  );
}
