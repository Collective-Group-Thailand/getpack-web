import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { AcknowledgeAlert, AcknowledgeAll } from "@/features/partner/ops/AlertActions";
import { ViewTabs } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOps.alerts"))("title") };
}

type Alert = Schemas["ErpAlertDto"];
type Kind = Alert["kind"];
const KINDS: Kind[] = [
  "machine_breakdown",
  "maintenance_due",
  "price_rise",
  "quote_expiring",
  "supplier_review_due",
  "document_expiring",
  "invoice_overdue",
  "quote_follow_up",
  "activity_overdue",
  "ncr_overdue",
  "oee_low",
];
const VIEWS = ["open", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 30;

const ICON: Record<Kind, IconName> = {
  price_rise: "trend-up",
  quote_expiring: "hourglass",
  supplier_review_due: "shield",
  maintenance_due: "wrench",
  machine_breakdown: "warning",
  document_expiring: "document",
  quote_follow_up: "send",
  invoice_overdue: "coins",
  activity_overdue: "phone",
  ncr_overdue: "shield-alert",
  oee_low: "activity",
};
const TONE: Record<Kind, "danger" | "warning" | "info"> = {
  price_rise: "warning",
  quote_expiring: "info",
  supplier_review_due: "info",
  maintenance_due: "warning",
  machine_breakdown: "danger",
  document_expiring: "warning",
  quote_follow_up: "info",
  invoice_overdue: "danger",
  activity_overdue: "warning",
  ncr_overdue: "danger",
  oee_low: "warning",
};

/** Where an alert takes its reader: what it is about. */
function hrefOf(alert: Alert): string | null {
  switch (alert.subjectType) {
    case "item":
      return `/stock/items/${alert.subjectId}`;
    case "maintenance_order":
      return `/maintenance/${alert.subjectId}`;
    case "maintenance_plan":
      return `/maintenance/plans/${alert.subjectId}`;
    case "document":
      return `/documents/${alert.subjectId}`;
    case "quotation":
      return `/quotations/${alert.subjectId}`;
    case "sales_invoice":
      return `/invoices/${alert.subjectId}`;
    case "activity":
      return "/crm?view=activities";
    case "erp_ncr":
      return `/quality/ncrs/${alert.subjectId}`;
    case "machine":
      return "/insight/oee";
    default:
      return null;
  }
}

/**
 * The factory's ERP alerts (D-347, D-358): price rises, quotations and supplier reviews ending, maintenance due,
 * breakdowns and expiring documents — open ones first, each opening what it is about.
 */
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; kind?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const kind = KINDS.includes(query.kind as Kind) ? (query.kind as Kind) : undefined;
  const page = pageOf(query.page);
  const [t, tCommon, format, context, tNav] = await Promise.all([
    getTranslations("partnerOps.alerts"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
    getTranslations("partner.sidebar.items"),
  ]);
  const { contract } = await partnerServerApis();
  // The two views' counts for their tabs (each read for its total only).
  const totals = Promise.all(
    VIEWS.map((key) =>
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/alerts", {
              params: {
                path: { factoryId: context.factoryId },
                query: {
                  perPage: 1,
                  ...(key === "open" ? { status: "open" as const } : {}),
                  ...(kind ? { kind } : {}),
                },
              },
            })
          ).data!.meta.total,
      ).then((result) => [key, result.data ?? null] as const),
    ),
  );
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/alerts", {
          params: {
            path: { factoryId: context.factoryId },
            query: {
              perPage: PER_PAGE,
              page,
              ...(view === "open" ? { status: "open" as const } : {}),
              ...(kind ? { kind } : {}),
            },
          },
        })
      ).data!,
  );
  const href = (next: { view?: View; kind?: Kind; page?: number }) =>
    `/alerts${queryOf({
      view: (next.view ?? view) === "open" ? undefined : (next.view ?? view),
      kind: "kind" in next ? next.kind : kind,
      page: next.page && next.page > 1 ? next.page : undefined,
    })}`;
  const text = (alert: Alert) => {
    const p = alert.payload as Record<string, string | number | null>;
    const s = (key: string) => (p[key] === null || p[key] === undefined ? "" : String(p[key]));
    const day = (key: string) => (p[key] ? format.date(String(p[key])) : "");
    return t(`text.${alert.kind}`, {
      item: s("item"),
      supplier: s("supplier"),
      price: s("price") ? format.thb(s("price")) : "",
      previous: s("previous") ? format.thb(s("previous")) : "",
      unit: s("unit") ? tCommon(`units.${s("unit")}` as never) : "",
      changePct: s("changePct"),
      documentNo: s("documentNo"),
      validUntil: day("validUntil"),
      reviewOn: day("reviewOn"),
      machine: s("machine"),
      title: s("title"),
      mtNo: s("mtNo"),
      reportedBy: s("reportedBy"),
      expiresOn: day("expiresOn"),
      quoteNo: s("quoteNo"),
      customer: s("customer"),
      invoiceNo: s("invoiceNo"),
      open: s("open") ? format.thb(s("open")) : "",
      dueDate: day("dueDate"),
      subject: s("subject"),
      assignee: s("assignee"),
      ncrNo: s("ncrNo"),
      owner: s("owner"),
      dueOn: day("dueOn"),
      oeePct: s("oeePct"),
      thresholdPct: s("thresholdPct"),
      day: day("day"),
    });
  };

  const counts = Object.fromEntries(await totals) as Record<View, number | null>;
  const EDGE = { danger: "border-s-danger", warning: "border-s-warning", info: "border-s-info" } as const;
  const GLYPH = {
    danger: "bg-danger-subtle text-danger-subtle-fg",
    warning: "bg-warning-subtle text-warning-subtle-fg",
    info: "bg-info-subtle text-info-subtle-fg",
  } as const;
  const kinds = [
    { key: "all", href: href({ kind: undefined, page: 1 }), label: t("kinds.all") },
    ...KINDS.map((k) => ({ key: k, href: href({ kind: k, page: 1 }), label: t(`kinds.${k}`) })),
  ];

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={t("body")}
      actions={view === "open" && list.data?.data.length ? <AcknowledgeAll /> : undefined}
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({
          key,
          href: href({ view: key, page: 1 }),
          label: t(`views.${key}`),
          count: counts[key],
        }))}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        {/* The kinds: a row to swipe on a phone, a list beside the alerts on a desk. */}
        <ViewTabs label={t("kinds.label")} current={kind ?? "all"} items={kinds} className="lg:hidden" />
        <nav aria-label={t("kinds.label")} className="hidden lg:sticky lg:top-20 lg:block">
          <p className="text-muted mb-2 px-3 text-sm font-medium">{t("kinds.label")}</p>
          <ul className="flex flex-col gap-0.5">
            {kinds.map((item) => {
              const selected = item.key === (kind ?? "all");
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "focus-visible:ring-focus-ring flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm outline-none focus-visible:ring-2",
                      selected
                        ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                        : "text-muted hover:bg-surface-subtle hover:text-fg",
                    )}
                  >
                    {item.key !== "all" ? (
                      <Icon name={ICON[item.key as Kind]} size={16} aria-hidden="true" className="shrink-0" />
                    ) : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {list.data ? (
            list.data.data.length ? (
              <>
                <ul className="flex flex-col gap-2">
                  {list.data.data.map((alert) => {
                    const to = hrefOf(alert);
                    const tone = TONE[alert.kind];
                    return (
                      <li
                        key={alert.id}
                        className={cn(
                          "border-border bg-surface rounded-card grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 border border-s-4 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto]",
                          alert.status === "open" ? EDGE[tone] : "border-s-border",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn("grid size-10 place-items-center rounded-lg", GLYPH[tone])}
                        >
                          <Icon name={ICON[alert.kind]} size={20} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge tone={tone}>{t(`kinds.${alert.kind}`)}</Badge>
                            {alert.dueOn ? (
                              <span className="text-sm font-medium">
                                {t("due", { date: format.date(alert.dueOn) })}
                              </span>
                            ) : null}
                          </p>
                          <p className="font-medium text-pretty [overflow-wrap:anywhere] break-keep">{text(alert)}</p>
                          <p className="text-muted text-sm">
                            {alert.acknowledgedAt
                              ? t("acknowledgedBy", {
                                  name: alert.acknowledgedBy ?? "—",
                                  at: format.dateTime(alert.acknowledgedAt),
                                })
                              : format.dateTime(alert.createdAt)}
                          </p>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:flex-col md:items-end">
                          {to ? (
                            <Button
                              asChild
                              variant="primary"
                              size="nav"
                              iconEnd="arrow-right"
                              className="md:h-9 md:px-3 md:text-sm"
                            >
                              <Link href={to}>{t("open")}</Link>
                            </Button>
                          ) : null}
                          {alert.status === "open" ? <AcknowledgeAlert alertId={alert.id} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pager
                  page={page}
                  perPage={PER_PAGE}
                  total={list.data.meta.total}
                  hrefFor={(n) => href({ page: n })}
                  labels={{
                    nav: tCommon("pagination.nav"),
                    previous: tCommon("pagination.previous"),
                    next: tCommon("pagination.next"),
                    page: (n: number) => tCommon("pagination.page", { n }),
                  }}
                />
              </>
            ) : (
              <EmptyState
                icon="bell"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  view === "open" ? (
                    <Button asChild variant="secondary" size="nav">
                      <Link href={href({ view: "all", page: 1 })}>{t("views.all")}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary" size="nav" iconEnd="arrow-right">
                      <Link href="/">{tNav("today")}</Link>
                    </Button>
                  )
                }
              />
            )
          ) : (
            <PageError error={list.error} />
          )}
        </div>
      </div>
    </PartnerPage>
  );
}
