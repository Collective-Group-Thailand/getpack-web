import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ERP_GL_ASSET_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf } from "@/features/partner/erp/ui";
import { erpMachines } from "@/features/partner/insight/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { AssetButton, CategoryButton, DisposeAsset, RunDepreciation } from "@/features/partner/ledger/AssetBankForms";
import { accountOptions } from "@/features/partner/ledger/server";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.assets"))("title") };
}

const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** Fixed assets (D-393): the register, the categories, the monthly depreciation runs. */
export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = pageOf(query.page);
  const [t, tc, format, context] = await Promise.all([
    getTranslations("partnerLedger.assets"),
    getTranslations("partnerLedger.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canPost = canAt(context, "factory_ledger.post");
  const canConfigure = canAt(context, "factory_ledger.configure");
  const [assets, categories, runs, banks, accounts, machines] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/fixed-assets", {
            params: { path, query: { page, perPage: 25 } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/asset-categories", { params: { path } }))
          .data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/depreciation-runs", { params: { path } }))
          .data!,
    ),
    canPost
      ? attempt(
          async () =>
            (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/bank-accounts", { params: { path } }))
              .data!,
        )
      : Promise.resolve({ data: [] as never[] }),
    canConfigure ? accountOptions(contract, context.factoryId) : Promise.resolve([]),
    canPost ? erpMachines(contract, context.factoryId).catch(() => []) : Promise.resolve([]),
  ]);
  const active = (categories.data ?? []).filter((c) => c.status === "active");
  const bankOptions = (banks.data ?? [])
    .filter((b) => b.status === "active")
    .map((b) => ({ id: b.id, label: `${b.bankName} ${b.name} xx${b.accountNoLast4}` }));
  const categoriesSection = (
    <PartnerSection
      title={t("categories")}
      actions={canConfigure && categories.data?.length ? <CategoryButton accounts={accounts} /> : null}
    >
      {categories.data ? (
        <PartnerTable
          caption={t("categories")}
          rows={categories.data}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              icon="layers"
              title={t("noCategories")}
              action={canConfigure ? <CategoryButton accounts={accounts} /> : undefined}
            />
          }
          columns={[
            { key: "n", header: t("category"), primary: true, cell: (row) => row.name },
            { key: "l", header: t("life"), align: "end", cell: (row) => format.number(row.usefulLifeMonths) },
            {
              key: "a",
              header: t("accounts"),
              hideOnPhone: true,
              cell: (row) => (
                <span className="text-xs tabular-nums">
                  {[row.assetAccount, row.accumulatedAccount, row.expenseAccount, row.gainLossAccount]
                    .map((a) => a.code)
                    .join(" · ")}
                </span>
              ),
            },
            {
              key: "c",
              header: t("name"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.number(row.assets),
            },
            {
              key: "x",
              header: "",
              cell: (row) => (canConfigure ? <CategoryButton accounts={accounts} category={row} /> : null),
            },
          ]}
        />
      ) : (
        <PageError error={categories.error} />
      )}
    </PartnerSection>
  );
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canPost ? (
          <div className="flex flex-wrap gap-2">
            <RunDepreciation month={thisMonth()} />
            {active.length ? (
              <AssetButton categories={active} machines={machines.map((m) => ({ id: m.id, label: m.label }))} />
            ) : null}
          </div>
        ) : null
      }
    >
      {/* With no category nothing can be registered: the categories come first, as the first step. */}
      {!active.length ? categoriesSection : null}
      {assets.data ? (
        <>
          <PartnerTable
            caption={t("title")}
            rows={assets.data.data}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon="building"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canPost && active.length ? (
                    <AssetButton
                      variant="secondary"
                      categories={active}
                      machines={machines.map((m) => ({ id: m.id, label: m.label }))}
                    />
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("assetNo"),
                primary: true,
                cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.assetNo}</span>,
              },
              {
                key: "n",
                header: t("name"),
                cell: (row) => (row.machine ? `${row.name} · ${row.machine.name}` : row.name),
              },
              { key: "c", header: t("category"), hideOnPhone: true, cell: (row) => row.category.name },
              { key: "cost", header: t("cost"), align: "end", hideOnPhone: true, cell: (row) => format.thb(row.cost) },
              {
                key: "m",
                header: t("monthly"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.monthlyDepreciation),
              },
              {
                key: "a",
                header: t("accumulated"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.accumulated),
              },
              { key: "nbv", header: t("nbv"), align: "end", cell: (row) => format.thb(row.netBookValue) },
              {
                key: "s",
                header: tc("status"),
                cell: (row) => <StatusChip map={ERP_GL_ASSET_STATUS} value={row.status} />,
              },
              {
                key: "x",
                header: "",
                cell: (row) =>
                  row.nextActions.some((a) => a.key === "erp_asset.dispose") ? (
                    <DisposeAsset asset={row} etag={null} banks={bankOptions} />
                  ) : null,
              },
            ]}
          />
          <Pager
            page={page}
            perPage={assets.data.meta.perPage}
            total={assets.data.meta.total}
            hrefFor={(p) => `/ledger/assets${queryOf({ page: p })}`}
            labels={{ nav: tc("pages"), previous: tc("previous"), next: tc("next"), page: (n) => tc("page", { n }) }}
          />
        </>
      ) : (
        <PageError error={assets.error} />
      )}
      {assets.data?.data.length || runs.data?.length || runs.error ? (
        <PartnerSection title={t("runs")}>
          {runs.data ? (
            <PartnerTable
              caption={t("runs")}
              rows={runs.data}
              rowKey={(row) => row.id}
              rowHref={(row) => (row.entry ? `/ledger/journals/${row.entry.id}` : "/ledger/assets")}
              empty={
                <EmptyState
                  icon="calculator"
                  title={t("noRuns")}
                  action={canPost && assets.data?.data.length ? <RunDepreciation month={thisMonth()} /> : undefined}
                />
              }
              columns={[
                {
                  key: "m",
                  header: tc("month"),
                  primary: true,
                  cell: (row) => (
                    <span className="whitespace-nowrap">
                      {format.date(`${row.month.slice(0, 7)}-01`, { style: "month" })}
                    </span>
                  ),
                },
                {
                  key: "e",
                  header: t("entry"),
                  hideOnPhone: true,
                  cell: (row) => <span className="tabular-nums">{row.entry?.number ?? "—"}</span>,
                },
                {
                  key: "n",
                  header: t("assetCount"),
                  align: "end",
                  hideOnPhone: true,
                  cell: (row) => format.number(row.lines.length),
                },
                { key: "t", header: tc("total"), align: "end", cell: (row) => format.thb(row.total) },
              ]}
            />
          ) : (
            <PageError error={runs.error} />
          )}
        </PartnerSection>
      ) : null}
      {active.length ? categoriesSection : null}
    </PartnerPage>
  );
}
