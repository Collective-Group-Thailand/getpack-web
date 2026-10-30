import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_LEAD_STAGE, ERP_OPPORTUNITY_STAGE } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { Activities, TargetForm } from "@/features/partner/sales/CrmForms";
import { erpSalespeople } from "@/features/partner/sales/server";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.crm"))("title") };
}

const VIEWS = ["pipeline", "leads", "opportunities", "activities", "report"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/**
 * The factory's own sales pipeline (D-359, D-369): open deals by stage and salesperson, leads, opportunities,
 * the follow-ups due, and each salesperson's month against target.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string; month?: string; stage?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "pipeline";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const month = query.month && MONTH.test(query.month) ? query.month : thisMonth();
  const [t, tCommon, tSource, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.crm"),
    getTranslations("partnerSales.common"),
    getTranslations("partnerSales.crm.sources"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const manage = canAt(context, "factory_sales.manage");
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/crm${queryOf({ view: next === "pipeline" ? undefined : next, ...extra })}`;
  const labels = await pagerLabels();
  // The two ways to start a record; an empty list offers the one it lists (`primary` there, outlined elsewhere).
  const newLead = (variant: "primary" | "secondary") =>
    manage ? (
      <Button asChild variant={variant} iconStart="user-plus">
        <Link href="/crm/leads/new">{t("newLead")}</Link>
      </Button>
    ) : undefined;
  const newOpportunity = (variant: "primary" | "secondary") =>
    manage ? (
      <Button asChild variant={variant} iconStart="handshake">
        <Link href="/crm/opportunities/new">{t("newOpportunity")}</Link>
      </Button>
    ) : undefined;

  let body: React.ReactNode;
  if (view === "pipeline") {
    const p = await attempt(
      async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/pipeline", { params: { path } })).data!,
    );
    body = p.data ? (
      <>
        <PartnerStats
          label={t("pipeline.summary")}
          items={[
            { key: "open", label: t("pipeline.openValue"), value: format.thb(p.data.openValue) },
            {
              key: "w",
              label: t("pipeline.weighted"),
              value: format.thb(p.data.openWeighted),
              hint: t("pipeline.weightedHint"),
            },
            {
              key: "soon",
              label: t("pipeline.closingSoon"),
              value: p.data.closingSoon,
              href: href("opportunities", { stage: "open" }),
            },
            {
              key: "due",
              label: t("pipeline.myDue"),
              value: p.data.myDue,
              href: href("activities"),
              // What the page asks of the reader: follow-ups due, on the pale tint when there are any.
              highlight: p.data.myDue > 0,
            },
          ]}
        />
        <PartnerSection title={t("pipeline.byStage")}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {p.data.stages.map((s) => (
              <li key={s.stage}>
                <Link
                  href={href("opportunities", { stage: s.stage })}
                  className="border-border bg-surface hover:bg-surface-subtle flex h-full flex-col gap-1 rounded-xl border p-3"
                >
                  <StatusChip map={ERP_OPPORTUNITY_STAGE} value={s.stage} />
                  <span className="text-lg font-semibold tabular-nums">{format.thb(s.value)}</span>
                  <span className="text-muted text-sm">{t("pipeline.deals", { n: s.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PartnerSection>
        <PartnerSection title={t("pipeline.bySalesperson")}>
          <PartnerTable
            caption={t("pipeline.bySalesperson")}
            rows={p.data.salespeople}
            rowKey={(row) => row.salesperson?.id ?? "none"}
            empty={<EmptyState icon="users" title={t("pipeline.empty")} action={newOpportunity("secondary")} />}
            columns={[
              {
                key: "p",
                header: tCommon("salesperson"),
                primary: true,
                cell: (row) => row.salesperson?.name ?? tCommon("noSalesperson"),
              },
              { key: "n", header: t("pipeline.open"), align: "end", cell: (row) => row.open },
              { key: "v", header: t("pipeline.openValue"), align: "end", cell: (row) => format.thb(row.value) },
              { key: "w", header: t("pipeline.weighted"), align: "end", cell: (row) => format.thb(row.weighted) },
            ]}
          />
        </PartnerSection>
      </>
    ) : (
      <PageError error={p.error} />
    );
  } else if (view === "leads") {
    const list = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/leads", {
            params: {
              path,
              query: { perPage: PER_PAGE, page, stage: (query.stage as "open") ?? "open", ...(q ? { q } : {}) },
            },
          })
        ).data!,
    );
    body = list.data ? (
      <>
        <PartnerTable
          caption={t("views.leads")}
          rows={list.data.data}
          rowKey={(row) => row.id}
          rowHref={(row) => `/crm/leads/${row.id}`}
          empty={
            <EmptyState
              icon="user-plus"
              title={t("leads.empty")}
              description={t("leads.emptyBody")}
              action={newLead("primary")}
            />
          }
          columns={[
            { key: "n", header: t("leads.name"), primary: true, cell: (row) => row.name },
            {
              key: "c",
              header: t("leads.contact"),
              hideOnPhone: true,
              cell: (row) => [row.contactName, row.phone].filter(Boolean).join(" · ") || "—",
            },
            { key: "s", header: t("leads.source"), hideOnPhone: true, cell: (row) => tSource(row.source) },
            {
              key: "v",
              header: t("leads.value"),
              align: "end",
              cell: (row) => (row.expectedValue ? format.thb(row.expectedValue) : "—"),
            },
            {
              key: "p",
              header: tCommon("salesperson"),
              hideOnPhone: true,
              cell: (row) => row.salesperson?.name ?? tCommon("noSalesperson"),
            },
            {
              key: "st",
              header: tCommon("status"),
              cell: (row) => <StatusChip map={ERP_LEAD_STAGE} value={row.stage} />,
            },
          ]}
        />
        <Pager
          page={page}
          perPage={PER_PAGE}
          total={list.data.meta.total}
          hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
          labels={labels}
        />
      </>
    ) : (
      <PageError error={list.error} />
    );
  } else if (view === "opportunities") {
    const list = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/opportunities", {
            params: {
              path,
              query: { perPage: PER_PAGE, page, stage: (query.stage as "open") ?? "open", ...(q ? { q } : {}) },
            },
          })
        ).data!,
    );
    body = list.data ? (
      <>
        <PartnerTable
          caption={t("views.opportunities")}
          rows={list.data.data}
          rowKey={(row) => row.id}
          rowHref={(row) => `/crm/opportunities/${row.id}`}
          empty={
            <EmptyState
              icon="handshake"
              title={t("opportunities.empty")}
              description={t("opportunities.emptyBody")}
              action={newOpportunity("primary")}
            />
          }
          columns={[
            { key: "t", header: t("opportunities.title"), primary: true, cell: (row) => row.title },
            { key: "c", header: tCommon("customer"), cell: (row) => row.customer?.name ?? row.lead?.name ?? "—" },
            { key: "v", header: t("opportunities.value"), align: "end", cell: (row) => format.thb(row.value) },
            {
              key: "p",
              header: t("opportunities.chance"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => `${row.probabilityPct}%`,
            },
            {
              key: "d",
              header: t("opportunities.close"),
              hideOnPhone: true,
              cell: (row) => (row.expectedCloseOn ? format.date(row.expectedCloseOn) : "—"),
            },
            {
              key: "st",
              header: tCommon("status"),
              cell: (row) => <StatusChip map={ERP_OPPORTUNITY_STAGE} value={row.stage} />,
            },
          ]}
        />
        <Pager
          page={page}
          perPage={PER_PAGE}
          total={list.data.meta.total}
          hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
          labels={labels}
        />
      </>
    ) : (
      <PageError error={list.error} />
    );
  } else if (view === "activities") {
    const [list, people] = await Promise.all([
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/activities", {
              params: { path, query: { perPage: 100, view: "open" } },
            })
          ).data!,
      ),
      attempt(async () => erpSalespeople(contract, context.factoryId)),
    ]);
    body = list.data ? (
      <Activities activities={list.data.data} people={people.data ?? []} canManage={manage} showSubject />
    ) : (
      <PageError error={list.error} />
    );
  } else {
    const [report, people] = await Promise.all([
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/sales/report", {
              params: { path, query: { month } },
            })
          ).data!,
      ),
      attempt(async () => erpSalespeople(contract, context.factoryId)),
    ]);
    body = report.data ? (
      <>
        <PartnerStats
          label={t("report.summary")}
          items={[
            { key: "net", label: t("report.invoicedNet"), value: format.thb(report.data.invoicedNet) },
            { key: "target", label: t("report.target"), value: format.thb(report.data.targetNet) },
            {
              key: "gp",
              label: t("report.grossProfit"),
              value: format.thb(report.data.grossProfit),
              hint: t("report.grossProfitHint"),
            },
            { key: "com", label: t("report.commission"), value: format.thb(report.data.commission) },
          ]}
        />
        <PartnerTable
          caption={t("report.title")}
          rows={report.data.rows}
          rowKey={(row) => row.salesperson?.id ?? "none"}
          empty={<EmptyState icon="chart" title={t("report.empty")} />}
          columns={[
            {
              key: "p",
              header: tCommon("salesperson"),
              primary: true,
              cell: (row) => row.salesperson?.name ?? tCommon("noSalesperson"),
            },
            {
              key: "t",
              header: t("report.target"),
              align: "end",
              cell: (row) => (row.targetNet ? format.thb(row.targetNet) : "—"),
            },
            { key: "n", header: t("report.invoicedNet"), align: "end", cell: (row) => format.thb(row.invoicedNet) },
            {
              key: "a",
              header: t("report.achievement"),
              align: "end",
              cell: (row) => (row.achievementPct ? `${formatPlain(row.achievementPct, locale, 1)}%` : "—"),
            },
            {
              key: "c",
              header: t("report.collected"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.collected),
            },
            { key: "m", header: t("report.commission"), align: "end", cell: (row) => format.thb(row.commission) },
          ]}
        />
        {canAt(context, "factory_sales.approve") ? (
          <PartnerSection title={t("report.setTarget")} description={t("report.setTargetBody", { month })}>
            <TargetForm people={people.data ?? []} month={month} />
          </PartnerSection>
        ) : null}
      </>
    ) : (
      <PageError error={report.error} />
    );
  }

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        manage ? (
          <>
            <Button asChild size="lg" iconStart="user-plus">
              <Link href="/crm/leads/new">{t("newLead")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" iconStart="handshake">
              <Link href="/crm/opportunities/new">{t("newOpportunity")}</Link>
            </Button>
          </>
        ) : undefined
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
        />
        {view === "leads" || view === "opportunities" ? (
          <SearchBar
            id="crm-q"
            action="/crm"
            hidden={{ view }}
            q={q}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            button={tCommon("search")}
          />
        ) : view === "report" ? (
          <form className="flex flex-wrap items-end gap-2" action="/crm">
            <input type="hidden" name="view" value="report" />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("report.month")}</span>
              <Input type="month" name="month" defaultValue={month} className="w-48" />
            </label>
            <Button type="submit" variant="secondary">
              {t("report.show")}
            </Button>
          </form>
        ) : null}
      </ListToolbar>
      {body}
    </PartnerPage>
  );
}
