import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { LedgerSettingsForm, ProposeAccountChange } from "@/features/partner/ledger/LedgerForms";
import { ledgerAccounts } from "@/features/partner/ledger/server";
import { ViewTabs } from "@/features/partner/rows";
import { ChangeDecision } from "@/features/partner/ledger/LedgerActions";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.accounts"))("title") };
}

const VIEWS = ["chart", "changes", "rules", "settings"] as const;
type View = (typeof VIEWS)[number];
type Account = Schemas["ErpGlAccountDto"];

/** The chart of accounts (D-386), its changes under maker-checker, the posting rules (D-388) and the settings (D-387). */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "chart";
  const page = pageOf(query.page);
  const [t, tc, tl, ts, format, context] = await Promise.all([
    getTranslations("partnerLedger.accounts"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.reports.lines"),
    getTranslations("partnerLedger.settings"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canConfigure = canAt(context, "factory_ledger.configure");
  const tabs = <ViewTabs label={t("views.label")} current={view} items={VIEWS.map((key) => ({ key, href: `/ledger/accounts${queryOf({ view: key === "chart" ? undefined : key })}`, label: t(`views.${key}`) }))} />;
  const all = canConfigure && (view === "chart" || view === "changes") ? ((await ledgerAccounts(contract, context.factoryId, false)) as unknown as Account[]) : [];
  const page$ = (body: React.ReactNode) => (
    <PartnerPage full title={t("title")} description={t("body")} actions={canConfigure && view !== "settings" && view !== "rules" ? <ProposeAccountChange accounts={all} /> : null}>
      {tabs}
      <p className="text-muted text-sm">{tc("cpaCaveat")}</p>
      {body}
    </PartnerPage>
  );

  if (view === "settings") {
    const read = await attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/settings", { params: { path } });
      return { settings: data!, etag: response.headers.get("etag") };
    });
    return page$(read.data ? <PartnerSection title={ts("title")}><LedgerSettingsForm settings={read.data.settings} etag={read.data.etag} canConfigure={canConfigure} /></PartnerSection> : <PageError error={read.error} />);
  }

  if (view === "rules") {
    const read = await attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/rules", { params: { path } })).data!);
    return page$(
      read.data ? (
        <PartnerSection title={t("views.rules")} description={t("rulesBody")}>
          <PartnerTable
            caption={t("views.rules")}
            rows={read.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/ledger/accounts/rules/${row.id}`}
            rowTone={(row) => (row.pending ? "warning" : undefined)}
            columns={[
              { key: "k", header: t("ruleKey"), primary: true, cell: (row) => <span className="font-mono">{row.key}</span> },
              {
                key: "n",
                header: t("name"),
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <span>{row.name}</span>
                    {row.pending ? <Badge tone="warning">{t("rulePending")}</Badge> : null}
                  </span>
                ),
              },
              { key: "e", header: t("event"), hideOnPhone: true, cell: (row) => <span className="font-mono text-xs">{row.eventType}</span> },
              { key: "a", header: t("postsTo"), hideOnPhone: true, cell: (row) => <span className="font-mono text-xs">{row.accountCodes.join(" ") || "—"}</span> },
              { key: "v", header: t("version"), align: "end", hideOnPhone: true, cell: (row) => row.versionNo ?? "—" },
              { key: "c", header: t("entries"), align: "end", cell: (row) => format.number(row.entries) },
            ]}
          />
        </PartnerSection>
      ) : (
        <PageError error={read.error} />
      ),
    );
  }

  if (view === "changes") {
    const read = await attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/account-changes", { params: { path, query: { page, perPage: 25 } } })).data!);
    return page$(
      read.data ? (
        <>
          <PartnerTable
            caption={t("views.changes")}
            rows={read.data.data}
            rowKey={(row) => row.id}
            rowTone={(row) => (row.status === "proposed" ? "warning" : undefined)}
            empty={<EmptyState icon="layers" title={t("changesEmpty")} />}
            columns={[
              { key: "k", header: t("kind"), primary: true, cell: (row) => t(`kinds.${row.kind}` as never) },
              { key: "a", header: t("name"), cell: (row) => (row.account ? `${row.account.code} ${row.account.name}` : `${row.proposed.code ?? ""} ${row.proposed.nameTh ?? ""}`) },
              { key: "r", header: t("reason"), hideOnPhone: true, cell: (row) => row.reason },
              { key: "b", header: t("requestedBy"), hideOnPhone: true, cell: (row) => `${row.createdBy} · ${format.date(row.createdAt)}` },
              {
                key: "s",
                header: t("decision"),
                cell: (row) =>
                  row.status === "proposed" ? (
                    <ChangeDecision change={row} />
                  ) : (
                    <Badge tone={row.status === "approved" ? "success" : "neutral"}>{row.status === "approved" ? t("decided") : row.decisionNote ?? row.status}</Badge>
                  ),
              },
            ]}
          />
          <Pager page={page} perPage={read.data.meta.perPage} total={read.data.meta.total} hrefFor={(p) => `/ledger/accounts${queryOf({ view, page: p })}`} labels={{ nav: tc("pages"), previous: tc("previous"), next: tc("next"), page: (n) => tc("page", { n }) }} />
        </>
      ) : (
        <PageError error={read.error} />
      ),
    );
  }

  const read = await attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/accounts", { params: { path, query: { page, perPage: 100, ...(query.q ? { q: query.q } : {}) } } })).data!);
  return page$(
    <>
      <SearchBar id="account-search" action="/ledger/accounts" q={query.q} label={t("search")} placeholder={t("searchPlaceholder")} button={t("searchButton")} />
      {read.data ? (
        <>
          <PartnerTable
            caption={t("views.chart")}
            rows={read.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => (row.isPostable ? `/ledger/reports${queryOf({ tab: "gl", account: row.code })}` : `/ledger/accounts${queryOf({ q: row.code.slice(0, 2) })}`)}
            columns={[
              { key: "c", header: t("code"), primary: true, cell: (row) => <span className={row.isPostable ? "font-mono" : "font-mono font-semibold"}>{row.code}</span> },
              {
                key: "n",
                header: t("name"),
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className={row.isPostable ? (row.parent ? "ps-3" : "") : "font-semibold"}>{row.nameTh}</span>
                    {row.isControl ? <Badge tone="info">{t("control")}</Badge> : null}
                    {row.status === "inactive" ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
                    {row.changePending ? <Badge tone="warning">{t("pending")}</Badge> : null}
                  </span>
                ),
              },
              { key: "t", header: t("type"), hideOnPhone: true, cell: (row) => tc(`types.${row.accountType}` as never) },
              { key: "l", header: t("line"), hideOnPhone: true, cell: (row) => <span className="text-sm">{tl(row.statementLine as never)}</span> },
              { key: "b", header: t("balance"), align: "end", cell: (row) => (row.isPostable ? format.thb(row.balance) : "") },
            ]}
          />
          <Pager page={page} perPage={read.data.meta.perPage} total={read.data.meta.total} hrefFor={(p) => `/ledger/accounts${queryOf({ q: query.q, page: p })}`} labels={{ nav: tc("pages"), previous: tc("previous"), next: tc("next"), page: (n) => tc("page", { n }) }} />
        </>
      ) : (
        <PageError error={read.error} />
      )}
    </>,
  );
}
