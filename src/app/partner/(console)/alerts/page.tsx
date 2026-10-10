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
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon, type IconName } from "@/ui/icons";

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
};
const TONE: Record<Kind, "danger" | "warning" | "info"> = {
  price_rise: "warning",
  quote_expiring: "info",
  supplier_review_due: "info",
  maintenance_due: "warning",
  machine_breakdown: "danger",
  document_expiring: "warning",
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
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerOps.alerts"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
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
    });
  };

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      actions={view === "open" && list.data?.data.length ? <AcknowledgeAll /> : undefined}
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href({ view: key, page: 1 }), label: t(`views.${key}`) }))}
      />
      <ViewTabs
        label={t("kinds.label")}
        current={kind ?? "all"}
        items={[
          { key: "all", href: href({ kind: undefined, page: 1 }), label: t("kinds.all") },
          ...KINDS.map((k) => ({ key: k, href: href({ kind: k, page: 1 }), label: t(`kinds.${k}`) })),
        ]}
      />
      {list.data ? (
        list.data.data.length ? (
          <>
            <ul className="flex flex-col gap-2">
              {list.data.data.map((alert) => {
                const to = hrefOf(alert);
                return (
                  <li
                    key={alert.id}
                    className="border-border bg-surface flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon name={ICON[alert.kind]} size={22} className="mt-0.5 shrink-0" aria-hidden />
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <Badge tone={TONE[alert.kind]}>{t(`kinds.${alert.kind}`)}</Badge>
                          <span className="text-muted text-sm">{format.dateTime(alert.createdAt)}</span>
                          {alert.dueOn ? (
                            <span className="text-muted text-sm">{t("due", { date: format.date(alert.dueOn) })}</span>
                          ) : null}
                        </p>
                        <p className="font-medium">{text(alert)}</p>
                        {alert.acknowledgedAt ? (
                          <p className="text-muted text-sm">
                            {t("acknowledgedBy", {
                              name: alert.acknowledgedBy ?? "—",
                              at: format.dateTime(alert.acknowledgedAt),
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {to ? (
                        <Link
                          href={to}
                          className="border-border hover:bg-surface-subtle inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium"
                        >
                          {t("open")}
                        </Link>
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
          <EmptyState icon="bell" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
