import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_WHT_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { WhtActions } from "@/features/partner/sales/TaxForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ certificateId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.tax.certificates"))("title") };
}

/** One 50 ทวิ (D-366): payer and payee as printed, the income lines and the tax withheld. */
export default async function CertificatePage({ params }: Props) {
  const { certificateId } = await params;
  const [t, tTax, tIncome, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.tax.certificates"),
    getTranslations("partnerSales.tax"),
    getTranslations("partnerSales.tax.income"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/wht-certificates/{certificateId}", {
          params: { path: { factoryId: context.factoryId, certificateId } },
        })
      ).data!,
  );
  const back = { href: "/tax?view=certificates", label: t("back") };
  if (!read.data)
    return (
      <PartnerPage title={t("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const c = read.data;
  return (
    <PartnerPage full title={c.certNo} description={tTax(`wht.${c.form}`)} back={back} meta={<StatusChip map={ERP_WHT_STATUS} value={c.status} />}>
      <WhtActions certificate={c} />
      {c.voidReason ? <Callout tone="danger" title={t("voidedTitle")}>{c.voidReason}</Callout> : null}
      <Card padding="md">
        <DescriptionList
          columns={2}
          items={[
            { term: t("payee"), description: `${c.payee.name}${c.payee.taxId ? ` · ${c.payee.taxId}` : ""}` },
            {
              term: t("payment"),
              description: (
                <Link className="text-link underline" href={`/payables/payments/${c.payment.id}`}>
                  {c.payment.code}
                </Link>
              ),
            },
            { term: t("paidOn"), description: format.date(c.paidOn) },
            { term: tTax("wht.base"), description: format.thb(c.baseAmount) },
            { term: tTax("wht.wht"), description: format.thb(c.whtAmount) },
          ]}
        />
      </Card>
      <PartnerSection title={t("linesTitle")}>
        <PartnerTable
          caption={t("linesTitle")}
          rows={c.lines}
          rowKey={(row) => String(row.lineNo)}
          columns={[
            {
              key: "i",
              header: tTax("wht.income"),
              primary: true,
              cell: (row) => `${tIncome(row.incomeType)}${row.description ? ` — ${row.description}` : ""}`,
            },
            { key: "r", header: t("form.rate"), align: "end", cell: (row) => `${formatPlain(row.ratePct, locale)}%` },
            { key: "b", header: tTax("wht.base"), align: "end", cell: (row) => format.thb(row.baseAmount) },
            { key: "w", header: tTax("wht.wht"), align: "end", cell: (row) => format.thb(row.whtAmount) },
          ]}
        />
      </PartnerSection>
    </PartnerPage>
  );
}
