import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { FileLink } from "@/features/customer/files/FileLink";
import { CancelRequest } from "@/features/customer/structural/CancelRequest";
import { getMyStructuralRequest } from "@/features/customer/structural/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles.request");
  return { title: t("detailTitle"), robots: { index: false, follow: false } };
}

type Props = { params: Promise<{ requestId: string }> };

/**
 * One structural design request (U3.6, D-273): what was asked, where it stands — a designer on it,
 * a fee quoted (its RFQ in my quote requests), the design delivered and approved, published in the
 * library — or why it was declined; withdrawn while nothing is delivered.
 */
export default async function Page({ params }: Props) {
  await requireCustomer();
  const { requestId } = await params;
  const locale = await getLocale();
  const [t, format, r, types] = await Promise.all([
    getTranslations("styles.request"),
    getFormat(),
    getMyStructuralRequest(requestId),
    getProductTypeNames(locale),
  ]);
  if (!r) notFound();
  const steps = [
    { label: t("steps.submitted"), at: r.createdAt },
    { label: t("steps.assigned"), at: r.assignedAt },
    { label: t("steps.approved"), at: r.approvedAt },
    { label: t(r.status === "published" ? "steps.published" : "steps.closed"), at: r.closedAt },
  ].filter((s) => s.at);
  const sizes = r.sizes
    ? [r.sizes.lengthMm, r.sizes.widthMm, r.sizes.heightMm]
        .map((n) => (n === null ? "—" : format.number(n)))
        .join(" × ")
    : null;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/account/structural-requests" className="text-primary text-sm underline">
            {t("back")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{t("detailTitle")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip map={STRUCTURAL_REQUEST_STATUS} value={r.status} size="md" />
          {["submitted", "assigned", "quoted"].includes(r.status) ? <CancelRequest requestId={r.id} /> : null}
        </div>
      </div>
      <p className="text-muted">{t(`explain.${r.status}`)}</p>
      <DescriptionList
        columns={2}
        items={[
          { term: t("productType"), description: types[r.productTypeCode] ?? r.productTypeCode },
          { term: t("description"), description: <span className="whitespace-pre-line">{r.description}</span> },
          {
            term: t("sizes"),
            description: sizes ? t("sizesValue", { sizes, basis: t(`bases.${r.sizes!.measurementBasis}`) }) : "—",
          },
          { term: t("quantity"), description: r.quantity === null ? "—" : format.number(r.quantity) },
          ...(r.closedReason && r.status === "declined"
            ? [{ term: t("declinedBecause"), description: r.closedReason }]
            : []),
          ...(r.publishedBaseCode
            ? [
                {
                  term: t("publishedAs"),
                  description: (
                    <Link
                      href={`/styles?q=${encodeURIComponent(r.publishedBaseCode)}`}
                      className="text-primary underline"
                    >
                      {r.publishedBaseCode}
                    </Link>
                  ),
                },
              ]
            : []),
        ]}
      />
      {r.deliveredFile && (r.status === "approved" || r.status === "published") ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted text-sm">{t("delivered")}</span>
          <FileLink
            fileId={r.deliveredFile.id}
            label={r.deliveredFile.originalName}
            openLabel={t("open")}
            failed={t("failed")}
          />
        </div>
      ) : null}
      {r.serviceRfqId ? (
        <p className="text-sm">
          {t("feeQuoted")}{" "}
          <Link href="/account/rfqs" className="text-primary underline">
            {t("toQuoteRequests")}
          </Link>
        </p>
      ) : null}
      <section aria-labelledby="request-steps">
        <h2 id="request-steps" className="mb-2 font-semibold">
          {t("stepsTitle")}
        </h2>
        <ol className="flex flex-col gap-1 text-sm">
          {steps.map((s) => (
            <li key={s.label}>{t("step", { label: s.label, date: format.dateTime(s.at!) })}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
