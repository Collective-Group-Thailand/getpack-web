import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { PortalTable } from "@/features/customer/account/PortalTable";
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
export default async function Page() {
  await requireCustomer();
  const locale = await getLocale();
  const [t, format, requests, types] = await Promise.all([
    getTranslations("styles.request"),
    getFormat(),
    listMyStructuralRequests(),
    getProductTypeNames(locale),
  ]);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title leading-tight">{t("listTitle")}</h1>
          <p className="text-muted mt-1">{t("listIntro")}</p>
        </div>
        <Button asChild iconStart="plus">
          <Link href="/account/structural-requests/new">{t("new")}</Link>
        </Button>
      </div>
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
        <PortalTable
          className="mt-6"
          caption={t("table.caption")}
          columns={[
            { key: "request", label: t("table.request"), className: "md:w-[44%]" },
            { key: "type", label: t("table.type") },
            { key: "sent", label: t("table.sent") },
            { key: "status", label: t("table.status") },
            { key: "actions", label: t("table.actions"), srOnly: true, className: "text-end" },
          ]}
          rows={requests.map((r) => ({
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
      )}
    </div>
  );
}
