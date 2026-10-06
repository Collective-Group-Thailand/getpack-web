import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listMySamples } from "@/features/customer/samples/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myOrders.samples");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** My samples (U2.F3): asked for before ordering, or attached to an order, and where each stands. */
export default async function Page() {
  await requireCustomer();
  const [t, format, samples] = await Promise.all([getTranslations("myOrders.samples"), getFormat(), listMySamples()]);
  return (
    <div>
      <h1 className="text-[2rem] leading-tight">{t("title")}</h1>
      <p className="text-muted mt-1">{t("intro")}</p>
      {samples.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon="package-check"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/account/quotes">{t("toQuotes")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {samples.map((sample) => (
            <li key={sample.id} className="border-border rounded-xl border">
              <Link
                href={`/account/samples/${sample.id}`}
                className="hover:bg-bg-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t(`mockup.${sample.mockupOption}`)}
                    {sample.orderCode ? (
                      <span className="text-muted ms-2 font-mono text-sm">{sample.orderCode}</span>
                    ) : null}
                  </p>
                  <p className="text-muted text-sm">
                    {[
                      t("asked", { date: format.date(sample.createdAt) }),
                      sample.sellGrossAmount ? format.thb(sample.sellGrossAmount) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip map={SAMPLE_KIND} value={sample.kind} />
                  <StatusChip map={SAMPLE_STATUS} value={sample.status} size="md" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
