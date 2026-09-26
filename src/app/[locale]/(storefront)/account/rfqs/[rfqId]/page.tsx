import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyRfq } from "@/features/customer/rfq/api.server";
import { RfqQuotes } from "@/features/customer/rfq/RfqQuotes";
import { RfqThread } from "@/features/customer/rfq/RfqThread";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { RFQ_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Params = { rfqId: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quoteRequests.detail");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * One request for quotation (F3 3.2): what was asked, when CS will answer, the quotes sent, the
 * conversation, and — once a quote is accepted — the way to the cart.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  await requireCustomer();
  const [{ rfqId }, { submitted }] = await Promise.all([params, searchParams]);
  const [t, format, found] = await Promise.all([getTranslations("quoteRequests.detail"), getFormat(), getMyRfq(rfqId)]);
  if (!found) notFound();
  const { rfq, messages } = found;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/account/rfqs" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("heading", { type: rfq.productType.name })}</h1>
        <StatusChip map={RFQ_STATUS} value={rfq.status} size="md" />
      </div>
      <p className="text-muted mt-1 font-mono text-sm">{rfq.rfqCode}</p>

      {submitted ? (
        <Callout tone="success" live className="mt-4">
          {t("submitted", { code: rfq.rfqCode })}
        </Callout>
      ) : null}
      {rfq.respondBy ? (
        <Callout tone="info" className="mt-4">
          {t("respondBy", { date: format.dateTime(rfq.respondBy) })}
        </Callout>
      ) : null}
      {rfq.declineReason ? (
        <Callout tone="warning" className="mt-4" title={t("declinedTitle")}>
          {rfq.declineReason}
        </Callout>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="rfq-quotes">
            <h2 id="rfq-quotes" className="mb-4 text-lg font-semibold">
              {t("quotesTitle")}
            </h2>
            <RfqQuotes rfq={rfq} />
          </section>
          <section aria-labelledby="rfq-thread">
            <h2 id="rfq-thread" className="mb-4 text-lg font-semibold">
              {t("threadTitle")}
            </h2>
            <RfqThread rfqId={rfq.id} messages={messages} askedForInfo={rfq.status === "need_info"} />
          </section>
        </div>
        <section aria-labelledby="rfq-spec">
          <h2 id="rfq-spec" className="mb-4 text-lg font-semibold">
            {t("specTitle")}
          </h2>
          <DescriptionList
            items={[
              ...rfq.spec.map((item) => ({ term: item.label, description: item.value })),
              ...(rfq.dimensions
                ? [
                    {
                      term: t("dimensions"),
                      description:
                        [rfq.dimensions.lengthMm, rfq.dimensions.widthMm, rfq.dimensions.heightMm]
                          .filter((value): value is number => value !== null)
                          .map((value) => format.number(value))
                          .join(" × ") + ` ${t("mm")}`,
                    },
                  ]
                : []),
              {
                term: t("quantities"),
                description: rfq.quantities.map((quantity) => format.number(quantity)).join(", "),
              },
              { term: t("postcode"), description: rfq.deliveryPostcode },
              ...(rfq.targetDate ? [{ term: t("targetDate"), description: format.date(rfq.targetDate) }] : []),
              ...(rfq.notes ? [{ term: t("notes"), description: rfq.notes }] : []),
              { term: t("submittedAt"), description: format.dateTime(rfq.submittedAt) },
              ...(rfq.files.length > 0
                ? [{ term: t("files"), description: rfq.files.map((file) => file.originalName).join(", ") }]
                : []),
            ]}
          />
        </section>
      </div>
    </div>
  );
}
