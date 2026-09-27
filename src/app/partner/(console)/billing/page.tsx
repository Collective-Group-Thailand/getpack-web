import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, INPUT_VAT_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling"))("title") };
}

/**
 * The factory's billing statements (F5 5.3, D-090): what Packio owes for each period, generated
 * from PO + POD, waiting for the factory to confirm — then for its own tax invoice.
 */
export default async function BillingPage() {
  const t = await getTranslations("partnerBilling");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const statements = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/billing-statements", {
      path: { factoryId: context.factoryId },
      query: { perPage: 50 },
    }),
  );

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_payouts.read") ? (
          <Link href="/payouts" className="text-primary inline-flex min-h-12 items-center gap-1 underline">
            <Icon name="coins" size={20} />
            {t("payoutsLink")}
          </Link>
        ) : null
      }
    >
      {statements.data ? (
        statements.data.data.length ? (
          <ul className="flex flex-col gap-2">
            {statements.data.data.map((statement) => (
              <li key={statement.id}>
                <Link
                  href={`/billing/${statement.id}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-20 flex-col gap-1 rounded-xl border p-3"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{statement.bsNumber}</span>
                    <StatusChip map={BILLING_STATEMENT_STATUS} value={statement.status} />
                    <Icon name="chevron-right" size={24} className="text-muted ms-auto" />
                  </span>
                  <span className="text-muted text-sm">
                    {t("period", { from: format.date(statement.periodFrom), to: format.date(statement.periodTo) })}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-lg font-semibold tabular-nums">{format.thb(statement.totals.gross)}</span>
                    <StatusChip map={INPUT_VAT_STATUS} value={statement.inputVatStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="receipt" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={statements.error} />
      )}
    </PartnerPage>
  );
}
