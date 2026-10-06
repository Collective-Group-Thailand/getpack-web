import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getMyRfq, specInWords } from "@/features/customer/rfq/api.server";
import { DeclineRfq } from "@/features/customer/rfq/DeclineRfq";
import { FileLink } from "@/features/customer/files/FileLink";
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
 *
 * The files sent with it open through `store.files.download`; the customer may close the request
 * while it offers `rfq.decline`.
 *
 * CONTRACT-GAP store.rfqs — a decline names a reason code only, not the words of it.
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
  const [t, format, locale, found] = await Promise.all([
    getTranslations("quoteRequests.detail"),
    getFormat(),
    getLocale(),
    getMyRfq(rfqId),
  ]);
  if (!found) notFound();
  const { rfq, accepted, form } = found;
  const dimensions = [rfq.lengthMm, rfq.widthMm, rfq.heightMm].filter((value): value is number => value !== null);

  return (
    <div>
      <Link href="/account/rfqs" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] leading-tight">{t("heading", { type: rfq.productTypeName })}</h1>
        <StatusChip map={RFQ_STATUS} value={rfq.status} size="md" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="text-muted font-mono text-sm">{rfq.rfqCode}</p>
        {rfq.nextActions.some((action) => action.key === "rfq.decline" && !action.disabledReason) ? (
          <DeclineRfq rfqId={rfq.id} rfqCode={rfq.rfqCode} />
        ) : null}
      </div>

      {submitted ? (
        <Callout tone="success" live className="mt-4">
          {t("submitted", { code: rfq.rfqCode })}
        </Callout>
      ) : null}
      {rfq.slaDueAt && ["submitted", "in_review", "need_info"].includes(rfq.status) ? (
        <Callout tone="info" className="mt-4">
          {t("respondBy", { date: format.dateTime(rfq.slaDueAt) })}
        </Callout>
      ) : null}
      {rfq.status === "declined" ? (
        <Callout
          tone="warning"
          className="mt-4"
          title={rfq.declineReasonCode === "customer_declined" ? t("withdrawnTitle") : t("declinedTitle")}
        >
          {rfq.declineReasonCode === "customer_declined" ? t("withdrawnBody") : t("declinedBody")}
        </Callout>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="rfq-quotes">
            <h2 id="rfq-quotes" className="mb-4 text-lg font-semibold">
              {t("quotesTitle")}
            </h2>
            <RfqQuotes rfq={rfq} accepted={accepted} />
          </section>
          <section aria-labelledby="rfq-thread">
            <h2 id="rfq-thread" className="mb-4 text-lg font-semibold">
              {t("threadTitle")}
            </h2>
            <RfqThread
              rfqId={rfq.id}
              messages={rfq.messages}
              askedForInfo={rfq.status === "need_info"}
              canPost={rfq.nextActions.some((action) => action.key === "rfq.post_message" && !action.disabledReason)}
            />
          </section>
        </div>
        <section aria-labelledby="rfq-spec">
          <h2 id="rfq-spec" className="mb-4 text-lg font-semibold">
            {t("specTitle")}
          </h2>
          <DescriptionList
            items={[
              ...specInWords(rfq, form, locale, { yes: t("yes"), no: t("no") }),
              ...(dimensions.length > 0
                ? [
                    {
                      term: t("dimensions"),
                      description: dimensions.map((value) => format.number(value)).join(" × ") + ` ${t("mm")}`,
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
            ]}
          />
          {rfq.files.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium">{t("files")}</h3>
              <ul className="mt-2 flex flex-col items-start gap-2">
                {rfq.files.map((file) => (
                  <li key={file.id}>
                    <FileLink
                      fileId={file.id}
                      label={file.originalName}
                      openLabel={t("openFile", { name: file.originalName })}
                      failed={t("fileFailed")}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
