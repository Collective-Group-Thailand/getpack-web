import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PaymentActions } from "@/features/partner/erp/PayablesActions";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.payables"))("title") };
}

/** One supplier payment (D-338): how it was paid and which invoices it settled; its reversal if any. */
export default async function SupplierPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const [{ paymentId }, t, tSales, format, context] = await Promise.all([
    params,
    getTranslations("partnerFactory.payables"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-payments/{paymentId}", {
          params: { path: { factoryId: context.factoryId, paymentId } },
        })
      ).data!,
  );
  const back = { href: "/payables?view=payments", label: t("title") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const p = read.data;
  // E4 (D-366): the 50 ทวิ the factory issues for what it withheld on this payment.
  const wht = p.reverses
    ? null
    : await attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/erp/supplier-payments/{paymentId}/wht", {
              params: { path: { factoryId: context.factoryId, paymentId } },
            })
          ).data!,
      );
  const tWht = await getTranslations("partnerSales.tax.certificates");
  const canIssue = Boolean(wht?.data && !wht.data.certificate && canAt(context, "factory_ap.manage"));
  return (
    <PartnerPage
      full
      title={p.paymentNo}
      description={p.supplier.name}
      back={back}
      status={
        p.reverses ? (
          <Badge tone="danger">{t("reversal", { no: p.reverses.code })}</Badge>
        ) : p.reversedBy ? (
          <Badge tone="neutral">{t("reversed")}</Badge>
        ) : null
      }
    >
      <PartnerDetail
        aside={
          <ActionPanel id="pay-next" tone="neutral" title={tSales("nextSteps")}>
            <dl className="border-border grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3">
              <dt className="text-muted text-sm">{t("table.amount")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(p.amount)}</dd>
              <dt className="text-muted text-sm">{t("table.paidOn")}</dt>
              <dd className="text-end tabular-nums">{format.date(p.paidOn)}</dd>
            </dl>
            {canIssue ? (
              <div data-fill="row" className="flex flex-col gap-2">
                <Button asChild iconStart="stamp">
                  <Link href={`/tax/certificates/new?payment=${p.id}`}>{tWht("issue")}</Link>
                </Button>
              </div>
            ) : null}
            <PaymentActions payment={p} layout="panel" />
          </ActionPanel>
        }
      >
        <Card padding="md">
          <DescriptionList
            columns={2}
            items={[
              { term: t("table.supplier"), description: p.supplier.name },
              { term: t("table.paidOn"), description: format.date(p.paidOn) },
              { term: t("table.method"), description: t(`pay.methods.${p.method}` as never) },
              { term: t("pay.reference"), description: p.reference ?? "—" },
              { term: t("table.amount"), description: <strong className="text-lg">{format.thb(p.amount)}</strong> },
              { term: t("detail.by"), description: `${p.by} · ${format.dateTime(p.createdAt)}` },
              ...(p.reverses
                ? [
                    {
                      term: t("detail.reverses"),
                      description: (
                        <Link
                          href={`/payables/payments/${p.reverses.id}`}
                          className="text-primary tabular-nums underline-offset-4 hover:underline"
                        >
                          {p.reverses.code}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(p.reversedBy
                ? [
                    {
                      term: t("detail.reversedBy"),
                      description: (
                        <Link
                          href={`/payables/payments/${p.reversedBy.id}`}
                          className="text-primary tabular-nums underline-offset-4 hover:underline"
                        >
                          {p.reversedBy.code}
                        </Link>
                      ),
                    },
                  ]
                : []),
              ...(p.note ? [{ term: t("detail.note"), description: p.note }] : []),
            ]}
          />
        </Card>
        {wht?.data ? (
          <PartnerSection title={tWht("onPayment")}>
            {wht.data.certificate ? (
              <Link className="text-primary underline" href={`/tax/certificates/${wht.data.certificate.id}`}>
                {tWht("issuedAs", { no: wht.data.certificate.code })}
              </Link>
            ) : (
              <p className="text-muted text-sm">{tWht("notYet")}</p>
            )}
          </PartnerSection>
        ) : null}
        <PartnerSection title={t("detail.allocations")}>
          <PartnerTable
            caption={t("detail.allocations")}
            rows={p.allocations}
            rowKey={(a) => a.invoice.id}
            rowHref={(a) => `/payables/invoices/${a.invoice.id}`}
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (a) => <span className="tabular-nums">{a.invoice.code}</span>,
              },
              { key: "inv", header: t("detail.invoiceNo"), cell: (a) => a.invoice.name },
              { key: "amount", header: t("table.amount"), align: "end", cell: (a) => format.thb(a.amount) },
            ]}
          />
        </PartnerSection>
        <PostedEntries sourceId={p.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
