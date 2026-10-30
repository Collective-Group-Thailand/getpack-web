import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { filterByStatus, StatusSummary, StatusTabs } from "@/features/customer/account/StatusOverview";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { listMyStructuralRequests } from "@/features/customer/structural/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles.request");
  return { title: t("listTitle"), robots: { index: false, follow: false } };
}

/** My structural design requests (U3.6, D-273) and where each stands. */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [, search] = await Promise.all([requireCustomer(), searchParams]);
  const locale = await getLocale();
  const [t, format, requests, types] = await Promise.all([
    getTranslations("styles.request"),
    getFormat(),
    listMyStructuralRequests(),
    getProductTypeNames(locale),
  ]);
  const { current, rows } = filterByStatus(requests, search.status);
  return (
    <div>
      <AccountHeader
        title={t("listTitle")}
        lede={t("listIntro")}
        actions={
          <Button asChild iconStart="plus">
            <Link href="/account/structural-requests/new">{t("new")}</Link>
          </Button>
        }
      />
      {requests.length > 0 ? (
        <StatusSummary
          className="mt-6"
          rows={requests}
          map={STRUCTURAL_REQUEST_STATUS}
          statuses={["quoted", "assigned", "delivered", "published"]}
          highlight="quoted"
        />
      ) : null}
      {requests.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="ruler"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/account/structural-requests/new">{t("new")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatusTabs
            className="mt-6"
            rows={requests}
            map={STRUCTURAL_REQUEST_STATUS}
            basePath="/account/structural-requests"
            current={current}
            label={t("table.status")}
          />
          <PortalTable
            className="mt-4"
            caption={t("table.caption")}
            columns={[
              { key: "request", label: t("table.request"), className: "md:w-[44%]" },
              { key: "type", label: t("table.type") },
              { key: "sent", label: t("table.sent"), className: "md:whitespace-nowrap" },
              { key: "status", label: t("table.status"), className: "md:whitespace-nowrap" },
              {
                key: "actions",
                label: t("table.actions"),
                srOnly: true,
                className: "text-end md:w-px md:whitespace-nowrap",
              },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              cells: {
                request: (
                  <Link
                    href={`/account/structural-requests/${r.id}`}
                    className="text-fg line-clamp-2 font-semibold underline-offset-4 hover:underline"
                  >
                    {r.description}
                  </Link>
                ),
                type: types[r.productTypeCode] ?? r.productTypeCode,
                sent: format.date(r.createdAt),
                status: <StatusChip map={STRUCTURAL_REQUEST_STATUS} value={r.status} />,
                actions: (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/account/structural-requests/${r.id}`}>{t("table.view")}</Link>
                  </Button>
                ),
              },
            }))}
          />
        </>
      )}
    </div>
  );
}
