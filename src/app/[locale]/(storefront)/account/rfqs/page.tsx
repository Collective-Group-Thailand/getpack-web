import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMyRfqs } from "@/features/customer/rfq/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { RFQ_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quoteRequests.list");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The customer's requests for quotation and where each stands (F3 3.2). */
export default async function Page() {
  await requireCustomer();
  const [t, format, list] = await Promise.all([getTranslations("quoteRequests.list"), getFormat(), listMyRfqs()]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      {list.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="inbox"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {list.map((rfq) => (
            <li key={rfq.id} className="border-border rounded-xl border">
              <Link
                href={`/account/rfqs/${rfq.id}`}
                className="hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {rfq.productTypeName} <span className="text-muted font-mono text-sm">{rfq.rfqCode}</span>
                  </p>
                  <p className="text-muted text-sm">
                    {t("row", {
                      quantities: rfq.quantities.map((quantity) => format.number(quantity)).join(", "),
                      date: format.date(rfq.submittedAt),
                    })}
                  </p>
                </div>
                <StatusChip map={RFQ_STATUS} value={rfq.status} size="md" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
