import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JOURNAL_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ExportJournals, RecurringButton } from "@/features/partner/ledger/LedgerForms";
import { accountOptions } from "@/features/partner/ledger/server";
import { PeriodPicker } from "@/features/partner/period";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { SalesActions } from "@/features/partner/sales/SalesActions";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.journals"))("title") };
}

const VIEWS = ["all", "pending", "draft", "manual", "auto", "recurring"] as const;
type View = (typeof VIEWS)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** Journals (D-389): every entry with its document, the ones awaiting approval, and the recurring journals. */
export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string; month?: string; account?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "all";
  const page = pageOf(query.page);
  const month = query.month && MONTH.test(query.month) ? query.month : undefined;
  const [t, tc, tr, format, context] = await Promise.all([
    getTranslations("partnerLedger.journals"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.recurring"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canPost = canAt(context, "factory_ledger.post");
  const filterOf = (key: View) =>
    key === "pending"
      ? { status: "pending_approval" as const }
      : key === "draft"
        ? { status: "draft" as const }
        : key === "manual"
          ? { kind: "manual" as const }
          : key === "auto"
            ? { kind: "auto" as const }
            : {};
  const [list, recurring, accounts] = await Promise.all([
    view === "recurring"
      ? Promise.resolve(null)
      : attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals", {
                params: {
                  path,
                  query: {
                    page,
                    perPage: 25,
                    ...filterOf(view),
                    ...(month ? { month } : {}),
                    ...(query.account ? { accountCode: query.account } : {}),
                    ...(query.q ? { q: query.q } : {}),
                  },
                },
              })
            ).data!,
        ),
    view === "recurring"
      ? attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/recurring-journals", {
                params: { path },
              })
            ).data!,
        )
      : Promise.resolve(null),
    view === "recurring" && canPost ? accountOptions(contract, context.factoryId) : Promise.resolve([]),
  ]);
  // Every tab's count with the same search and filters, so a tab says exactly how many entries it opens.
  const counts = await viewTotals(VIEWS, async (key) =>
    key === "recurring"
      ? {
          meta: {
            total: (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/recurring-journals", {
                params: { path },
              })
            ).data!.length,
          },
        }
      : (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals", {
            params: {
              path,
              query: {
                perPage: 1,
                ...filterOf(key),
                ...(month ? { month } : {}),
                ...(query.account ? { accountCode: query.account } : {}),
                ...(query.q ? { q: query.q } : {}),
              },
            },
          })
        ).data,
  );
  const href = (next: Record<string, string | number | undefined>) =>
    `/ledger/journals${queryOf({ view: view === "all" ? undefined : view, q: query.q, month, account: query.account, ...next })}`;
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        <div className="flex flex-wrap gap-2">
          <ExportJournals month={month ?? thisMonth()} />
          {canPost ? (
            <Button asChild size="lg" iconStart="plus">
              <Link href="/ledger/journals/new">{t("new")}</Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({
            key,
            href: `/ledger/journals${queryOf({
              view: key === "all" ? undefined : key,
              ...(key === "recurring" ? {} : { q: query.q, month, account: query.account }),
            })}`,
            label: t(`views.${key}`),
            count: counts[key],
          }))}
        />
        {view !== "recurring" ? (
          <SearchBar
            id="journal-search"
            action="/ledger/journals"
            hidden={{ view: view === "all" ? undefined : view, month, account: query.account }}
            q={query.q}
            label={t("search")}
            placeholder={t("searchPlaceholder")}
            button={t("searchButton")}
          />
        ) : null}
      </ListToolbar>
      {recurring ? (
        <PartnerSection
          title={t("recurringTitle")}
          description={t("recurringBody")}
          actions={canPost ? <RecurringButton accounts={accounts} label={t("recurringNew")} /> : null}
        >
          {recurring.data ? (
            <PartnerTable
              caption={t("recurringTitle")}
              rows={recurring.data}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon="calendar"
                  title={t("noRecurring")}
                  action={
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href="/ledger/journals">{t("views.all")}</Link>
                    </Button>
                  }
                />
              }
              columns={[
                { key: "n", header: tr("name"), primary: true, cell: (row) => row.name },
                { key: "d", header: tc("date"), cell: (row) => t("dayOfMonth", { n: row.dayOfMonth }) },
                { key: "a", header: tc("amount"), align: "end", cell: (row) => format.thb(row.total) },
                { key: "l", header: t("lastRun"), hideOnPhone: true, cell: (row) => row.lastRunMonth ?? t("never") },
                {
                  key: "s",
                  header: tc("status"),
                  cell: (row) => (
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={row.status === "active" ? "success" : "neutral"}>
                        {row.status === "active" ? t("active") : t("inactive")}
                      </Badge>
                      {row.autoReverse ? <Badge tone="info">{t("autoReverse")}</Badge> : null}
                    </span>
                  ),
                },
                {
                  key: "x",
                  header: "",
                  cell: (row) => (
                    <div className="flex flex-wrap gap-2">
                      {row.nextActions.some((a) => a.key === "erp_recurring.edit") ? (
                        <RecurringButton accounts={accounts} recurring={row} label={t("editRecurring")} />
                      ) : null}
                      <SalesActions
                        offered={row.nextActions.filter((a) => a.key === "erp_recurring.run")}
                        actions={[
                          {
                            key: "erp_recurring.run",
                            kind: "post",
                            path: "/ledger/recurring-journals/{recurringId}/actions/run",
                            params: { recurringId: row.id },
                            title: tr("runTitle"),
                            description: tr("runBody"),
                            done: tr("runDone"),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <PageError error={recurring.error} />
          )}
        </PartnerSection>
      ) : (
        <>
          {/* The month and account narrow the list on a lighter second line, under the one toolbar. */}
          <div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <PeriodPicker
              action="/ledger/journals"
              label={t("filter")}
              hidden={{ view: view === "all" ? undefined : view, q: query.q }}
              fields={[
                { name: "month", label: tc("month"), value: month ?? "", type: "month" },
                { name: "account", label: t("accountFilter"), value: query.account ?? "", type: "text" },
              ]}
              submit={t("filter")}
            />
            {month || query.account ? (
              <Link
                className="text-primary inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline md:min-h-8"
                href={`/ledger/journals${queryOf({ view: view === "all" ? undefined : view, q: query.q })}`}
              >
                {t("clearFilter")}
              </Link>
            ) : null}
          </div>
          {list?.data ? (
            <>
              <PartnerTable
                caption={t("title")}
                rows={list.data.data}
                rowKey={(row) => row.id}
                rowHref={(row) => `/ledger/journals/${row.id}`}
                rowTone={(row) => (row.status === "pending_approval" ? "warning" : undefined)}
                empty={
                  <EmptyState
                    icon="list-ordered"
                    title={t("empty")}
                    description={t("emptyBody")}
                    action={
                      view !== "all" || month || query.account || query.q ? (
                        <Button asChild variant="secondary" iconEnd="arrow-right">
                          <Link href="/ledger/journals">{t("views.all")}</Link>
                        </Button>
                      ) : canPost ? (
                        <Button asChild variant="secondary" iconStart="plus">
                          <Link href="/ledger/journals/new">{t("new")}</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                }
                columns={[
                  {
                    key: "no",
                    header: t("entryNo"),
                    primary: true,
                    cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.entryNo ?? "—"}</span>,
                  },
                  {
                    key: "d",
                    header: tc("date"),
                    className: "whitespace-nowrap",
                    cell: (row) => format.date(row.entryDate),
                  },
                  { key: "ds", header: tc("description"), cell: (row) => row.description },
                  {
                    key: "k",
                    header: t("kind"),
                    hideOnPhone: true,
                    className: "whitespace-nowrap",
                    cell: (row) => tc(`kinds.${row.kind}` as never),
                  },
                  {
                    key: "src",
                    header: t("source"),
                    hideOnPhone: true,
                    cell: (row) =>
                      row.source ? <span className="text-sm tabular-nums">{row.source.number}</span> : "—",
                  },
                  { key: "a", header: tc("amount"), align: "end", cell: (row) => format.thb(row.totalDebit) },
                  {
                    key: "s",
                    header: tc("status"),
                    cell: (row) => <StatusChip map={JOURNAL_STATUS} value={row.status} />,
                  },
                ]}
              />
              <Pager
                page={page}
                perPage={list.data.meta.perPage}
                total={list.data.meta.total}
                hrefFor={(p) => href({ page: p })}
                labels={{
                  nav: tc("pages"),
                  previous: tc("previous"),
                  next: tc("next"),
                  page: (n) => tc("page", { n }),
                }}
              />
            </>
          ) : list ? (
            <PageError error={list.error} />
          ) : null}
        </>
      )}
    </PartnerPage>
  );
}
