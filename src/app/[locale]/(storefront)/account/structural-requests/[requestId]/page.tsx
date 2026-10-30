import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { STRUCTURAL_REQUEST_STATUS } from "@/domain/status";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { Panel } from "@/features/customer/account/Panel";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { FileLink } from "@/features/customer/files/FileLink";
import { CancelRequest } from "@/features/customer/structural/CancelRequest";
import { getMyStructuralRequest } from "@/features/customer/structural/api.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Icon } from "@/ui/icons";

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
    <div>
      <AccountHeader
        back={{ href: "/account/structural-requests", label: t("back") }}
        title={t("detailTitle")}
        status={<StatusChip map={STRUCTURAL_REQUEST_STATUS} value={r.status} size="md" />}
        lede={t(`explain.${r.status}`)}
        actions={["submitted", "assigned", "quoted"].includes(r.status) ? <CancelRequest requestId={r.id} /> : null}
      />
      {/* Project B3: what was asked in a card, what the customer acts on (the fee to confirm, the die-line to
          download) as tinted cards under it, and the progress so far as a timeline beside them. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {r.serviceRfqId ? (
            <div className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm font-medium">{t("feeQuoted")}</p>
              <Button asChild size="sm">
                <Link href="/account/rfqs">{t("toQuoteRequests")}</Link>
              </Button>
            </div>
          ) : null}
          {r.deliveredFile && (r.status === "approved" || r.status === "published") ? (
            <div className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-wrap items-center gap-4 p-4">
              <span
                aria-hidden="true"
                className="border-border bg-surface text-muted grid size-12 shrink-0 place-items-center rounded-lg border"
              >
                <Icon name="document" size={22} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{t("delivered")}</span>
              <FileLink
                fileId={r.deliveredFile.id}
                label={r.deliveredFile.originalName}
                openLabel={t("open")}
                failed={t("failed")}
              />
            </div>
          ) : null}
          <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
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
          </div>
        </div>
        <Panel
          id="request-steps"
          title={t("stepsTitle")}
          className="lg:sticky lg:top-[calc(var(--site-sticky-top,0px)+1rem)]"
        >
          <ol className="flex flex-col">
            {steps.map((step, index) => (
              <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
                {index < steps.length - 1 ? (
                  <span aria-hidden="true" className="bg-border absolute start-[0.6875rem] top-6 bottom-0 w-px" />
                ) : null}
                <span
                  aria-hidden="true"
                  className="bg-primary-subtle text-primary-subtle-fg grid size-6 shrink-0 place-items-center rounded-full"
                >
                  <Icon name="check" size={14} />
                </span>
                <span className="text-sm">{t("step", { label: step.label, date: format.dateTime(step.at!) })}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
