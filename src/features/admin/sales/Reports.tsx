"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError, useCan } from "../console";
import { HistoryBody } from "./approvals/ApprovalDetail";
import { Figure } from "./figure";
import { QUANTITY_BANDS } from "./resources";

const RANGES = ["30", "90", "180", "365"] as const;
const bangkokDay = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function useUrlParam(name: string, fallback: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = (next: string | null) => {
    const search = new URLSearchParams(params.toString());
    if (!next || next === fallback) search.delete(name);
    else search.set(name, next);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return [value, set] as const;
}

function RangeControl() {
  const t = useTranslations("sales.reports");
  const [range, setRange] = useUrlParam("range", "90");
  return (
    <SegmentedControl
      label={t("range")}
      value={range}
      onValueChange={setRange}
      options={RANGES.map((value) => ({ value, label: t("lastDays", { days: value }) }))}
    />
  );
}

/**
 * Negotiation history (D-470 §7) of one customer, company or lead: rounds per quote, the average approved discount,
 * wins and losses with their reasons, the last competitor named, and whether the customer is "negotiation-heavy"
 * (which raises the approval level). Opened from a lead or an approval; the desk's recent quotes are quick picks.
 */
export function NegotiationsReport() {
  const t = useTranslations("sales.reports.negotiations");
  const tLost = useTranslations("agentSales.lead.lostReasons");
  const format = useFormat();
  const params = useSearchParams();
  const router = useRouter();
  const pipeline = useCan("sales.pipeline.manage");
  const subject = (["leadId", "customerId", "companyId"] as const).find((key) => params.get(key));
  const id = subject ? params.get(subject)! : null;
  const [typed, setTyped] = useState("");
  const history = useQuery({
    queryKey: ["admin", "sales_negotiation_history", subject, id],
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/sales/negotiations/history", {
          params: { query: { [subject!]: id! } },
        })
      ).data!,
    enabled: Boolean(subject && id),
  });
  const picks = useQuery({
    queryKey: queryKeys.list("admin", "sales_quote", { perPage: 20, purpose: "history-picks" }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/quotes", { params: { query: { perPage: 20 } } })).data!,
    enabled: pipeline,
  });
  const leads = (picks.data?.data ?? []).filter(
    (row, at, all) => all.findIndex((other) => other.lead.id === row.lead.id) === at,
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4">
        <h2 className="text-sm font-semibold">{t("pick")}</h2>
        {leads.length ? (
          <ul className="flex flex-col">
            {leads.map((row) => (
              <li key={row.lead.id}>
                <Link
                  href={`/sales/reports/negotiations?leadId=${row.lead.id}`}
                  aria-current={id === row.lead.id ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-focus-ring flex flex-col rounded-lg px-2.5 py-2 outline-none focus-visible:ring-2",
                    id === row.lead.id ? "bg-primary-subtle text-primary-subtle-fg" : "hover:bg-surface-subtle",
                  )}
                >
                  <span className="truncate text-sm font-medium">
                    {row.lead.organisationName ?? row.lead.contactName}
                  </span>
                  <span className="text-muted truncate text-xs">{row.lead.contactName}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim()) router.push(`/sales/reports/negotiations?customerId=${encodeURIComponent(typed.trim())}`);
          }}
        >
          <Field label={t("byCustomerId")} hint={t("byCustomerIdHint")}>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} spellCheck={false} />
          </Field>
          <Button type="submit" size="sm" variant="secondary" className="self-start">
            {t("show")}
          </Button>
        </form>
      </aside>
      <section className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-4 border p-4 sm:p-5">
        {!subject ? (
          <EmptyState
            title={t("none")}
            description={t("noneHint")}
            icon="history"
            action={
              <Button asChild variant="secondary" iconStart="stamp">
                <Link href="/sales/approvals">{t("toApprovals")}</Link>
              </Button>
            }
          />
        ) : history.isError ? (
          <QueryError error={history.error} onRetry={() => void history.refetch()} />
        ) : history.data ? (
          <>
            <header>
              <h2 className="text-base font-semibold">{t("title")}</h2>
              <p className="text-muted text-sm">
                {t("rule", {
                  rounds: history.data.minRounds,
                  quotes: history.data.minQuotes,
                  last: history.data.lastQuotes,
                })}
              </p>
            </header>
            <HistoryBody history={history.data} tLost={tLost} format={format} />
          </>
        ) : (
          <div className="bg-surface-subtle h-48 animate-pulse rounded-md motion-reduce:animate-none" />
        )}
      </section>
    </div>
  );
}

/**
 * Lost to price (D-470 §7): of the deals closed in the range, how many were lost on price, by product class and
 * quantity band — a table whose cells are shaded by share in one hue (darker = more lost), with the count beside the
 * percentage so nothing rests on the shade. Feeds the pricing tables.
 */
export function LostToPriceReport() {
  const t = useTranslations("sales.reports.lostToPrice");
  const format = useFormat();
  const [range] = useUrlParam("range", "90");
  const query = { from: bangkokDay(Number(range)), to: bangkokDay(0) };
  const report = useQuery({
    queryKey: ["admin", "sales_lost_to_price", query],
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/negotiations/lost-to-price", { params: { query } }))
        .data!,
    placeholderData: keepPreviousData,
  });
  if (report.isError) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const d = report.data;
  const classes = d ? [...new Set(d.rows.map((row) => row.productClass))] : [];
  const cell = (productClass: string, band: Schemas["SalesQuantityBand"]) =>
    d?.rows.find((row) => row.productClass === productClass && row.quantityBand === band);
  const shade = (pct: string | null) => {
    const value = pct === null ? 0 : Number(pct);
    return value >= 40 ? "bg-primary/35" : value >= 25 ? "bg-primary/20" : value >= 10 ? "bg-primary/10" : "";
  };
  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", report.isFetching && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <RangeControl />
        {d ? (
          <p className="text-muted text-xs">{t("scope", { from: format.date(d.from), to: format.date(d.to) })}</p>
        ) : null}
      </div>
      <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
        <header>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-muted text-sm">{t("hint")}</p>
        </header>
        {!d ? (
          <div className="bg-surface-subtle h-48 animate-pulse rounded-md motion-reduce:animate-none" />
        ) : classes.length === 0 ? (
          <EmptyState
            title={t("empty")}
            icon="chart"
            action={
              <Button asChild variant="secondary">
                <Link href="/sales/dashboard">{t("toDashboard")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="text-muted text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t("productClass")}
                  </th>
                  {QUANTITY_BANDS.map((band) => (
                    <th key={band} scope="col" className="px-2 py-2 text-end font-medium">
                      {t(`bands.${band}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((productClass) => (
                  <tr key={productClass} className="border-border border-b last:border-0">
                    <th scope="row" className="py-2 pe-3 text-start font-medium">
                      {t.has(`classes.${productClass}`) ? t(`classes.${productClass}`) : productClass}
                    </th>
                    {QUANTITY_BANDS.map((band) => {
                      const row = cell(productClass, band);
                      return (
                        <td key={band} className={cn("px-2 py-2 text-end", row && shade(row.lostToPricePct))}>
                          {row ? (
                            <span className="flex flex-col items-end">
                              <Figure
                                name="lostToPricePct"
                                source={{ label: t("title") }}
                                className="font-semibold tabular-nums"
                              >
                                {row.lostToPricePct === null ? "—" : format.percent(row.lostToPricePct, 0)}
                              </Figure>
                              <span className="text-muted text-xs tabular-nums">
                                {t("ofClosed", {
                                  lost: format.number(row.lostToPrice),
                                  closed: format.number(row.closed),
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span>{t("legend")}</span>
              {(["bg-primary/10", "bg-primary/20", "bg-primary/35"] as const).map((tone, at) => (
                <span key={tone} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn("border-border size-3 rounded-sm border", tone)} />
                  {t(`legendSteps.${at}`)}
                </span>
              ))}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type Figures = Schemas["PostDealRowDto"]["approved"];

/**
 * Post-deal review (D-470 §10): each won deal with an approval, the margin it was approved at against what it actually
 * made, grouped by approver, agent or customer. Managers get percentages; the full tier gets the amounts too — the
 * page draws the variant the API sent.
 */
export function PostDealReport() {
  const t = useTranslations("sales.reports.postDeal");
  const format = useFormat();
  const [range] = useUrlParam("range", "90");
  const [groupBy, setGroupBy] = useUrlParam("groupBy", "approver");
  const query = {
    from: bangkokDay(Number(range)),
    to: bangkokDay(0),
    groupBy: groupBy as Schemas["SalesPostDealGroupBy"],
  };
  const report = useQuery({
    queryKey: ["admin", "sales_post_deal", query],
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/post-deal-review", { params: { query } })).data!,
    placeholderData: keepPreviousData,
  });
  if (report.isError) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const d = report.data;
  const full = d?.deals[0]?.approved.visibility === "full" || d?.groups[0]?.approved.visibility === "full";
  const pair = (name: string, approved: string, actual: string, kind: "pct" | "thb") => (
    <span className="flex flex-col items-end">
      <Figure name={name} source={{ label: t("title") }} className="font-medium tabular-nums">
        {kind === "pct" ? format.percent(actual) : format.thb(actual)}
      </Figure>
      <span className="text-muted text-xs tabular-nums">
        {t("approvedAt", { value: kind === "pct" ? format.percent(approved) : format.thb(approved) })}
      </span>
    </span>
  );
  const columns = (approved: Figures, actual: Figures) =>
    approved.visibility === "full" && actual.visibility === "full" ? (
      <>
        <td className="px-2 py-2.5 text-end">{pair("netRevenue", approved.netRevenue, actual.netRevenue, "thb")}</td>
        <td className="px-2 py-2.5 text-end">
          {pair("grossMarginPct", approved.grossMarginPct, actual.grossMarginPct, "pct")}
        </td>
        <td className="px-2 py-2.5 text-end">
          {pair("contributionPct", approved.contributionPct, actual.contributionPct, "pct")}
        </td>
        <td className="px-2 py-2.5 text-end">
          {pair("contributionAfterCommission", approved.contribution, actual.contribution, "thb")}
        </td>
      </>
    ) : (
      <>
        <td className="px-2 py-2.5 text-end">
          {pair("grossMarginPct", approved.grossMarginPct, actual.grossMarginPct, "pct")}
        </td>
        <td className="px-2 py-2.5 text-end">
          {pair("contributionPct", approved.contributionPct, actual.contributionPct, "pct")}
        </td>
      </>
    );
  const heads = full
    ? (["netRevenue", "grossMarginPct", "contributionPct", "contribution"] as const)
    : (["grossMarginPct", "contributionPct"] as const);
  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", report.isFetching && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <RangeControl />
        <SegmentedControl
          label={t("groupBy")}
          value={groupBy}
          onValueChange={setGroupBy}
          options={(["approver", "agent", "customer"] as const).map((value) => ({
            value,
            label: t(`groups.${value}`),
          }))}
        />
        {d ? <p className="text-muted text-xs">{t(full ? "tierFull" : "tierPct")}</p> : null}
      </div>
      {!d ? (
        <div className="bg-surface-subtle h-48 animate-pulse rounded-md motion-reduce:animate-none" />
      ) : d.deals.length === 0 ? (
        <EmptyState
          title={t("empty")}
          icon="chart"
          action={
            <Button asChild variant="secondary" iconStart="stamp">
              <Link href="/sales/approvals">{t("toApprovals")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t("byGroup", { group: t(`groups.${groupBy}`) })}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">{t("byGroup", { group: t(`groups.${groupBy}`) })}</caption>
                <thead className="text-muted text-xs">
                  <tr className="border-border border-b">
                    <th scope="col" className="py-2 pe-3 text-start font-medium">
                      {t(`groups.${groupBy}`)}
                    </th>
                    <th scope="col" className="px-2 py-2 text-end font-medium">
                      {t("deals")}
                    </th>
                    {heads.map((head) => (
                      <th key={head} scope="col" className="px-2 py-2 text-end font-medium">
                        {t(`heads.${head}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.groups.map((group) => (
                    <tr key={group.key} className="border-border border-b last:border-0">
                      <th scope="row" className="py-2.5 pe-3 text-start font-medium">
                        {group.key}
                      </th>
                      <td className="px-2 py-2.5 text-end tabular-nums">{format.number(group.deals)}</td>
                      {columns(group.approved, group.actual)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t("dealsTitle")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <caption className="sr-only">{t("dealsTitle")}</caption>
                <thead className="text-muted text-xs">
                  <tr className="border-border border-b">
                    <th scope="col" className="py-2 pe-3 text-start font-medium">
                      {t("deal")}
                    </th>
                    <th scope="col" className="px-2 py-2 text-end font-medium">
                      {t("discount")}
                    </th>
                    {heads.map((head) => (
                      <th key={head} scope="col" className="px-2 py-2 text-end font-medium">
                        {t(`heads.${head}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.deals.map((deal) => (
                    <tr key={deal.approvalId} className="border-border border-b last:border-0">
                      <th scope="row" className="py-2.5 pe-3 text-start font-normal">
                        <span className="block font-medium">{deal.customerName}</span>
                        <span className="text-muted block text-xs tabular-nums">
                          {t("dealLine", {
                            code: deal.quoteCode ?? "—",
                            seller: deal.agentName,
                            agentCode: deal.agentCode,
                            approver: deal.approverName ?? "—",
                            orders: deal.orders,
                          })}
                        </span>
                      </th>
                      <td className="px-2 py-2.5 text-end">
                        <Figure
                          name="requestedPct"
                          source={{ label: deal.quoteCode ?? t("deal") }}
                          className="tabular-nums"
                        >
                          {format.percent(deal.approvedDiscountPct)}
                        </Figure>
                      </td>
                      {columns(deal.approved, deal.actual)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
