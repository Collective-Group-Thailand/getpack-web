"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber, trimZeros } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type Suggestion = Schemas["ErpWhtSuggestionDto"];
type IncomeType = Schemas["ErpWhtIncomeType"];
const INCOME: IncomeType[] = ["hire_of_work", "service", "transport", "advertising", "rent", "fees_commission", "prize", "other"];
const USUAL: Record<IncomeType, string> = {
  hire_of_work: "3",
  service: "3",
  transport: "1",
  advertising: "2",
  rent: "5",
  fees_commission: "3",
  prize: "5",
  other: "3",
};
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

interface Line {
  key: string;
  incomeType: IncomeType;
  description: string;
  ratePct: string;
  baseAmount: string;
  whtAmount: string;
}
let seq = 0;

/**
 * A 50 ทวิ for a supplier payment (D-366): the income lines withheld on, each with its rate, the amount paid and
 * the tax withheld — started from what the payment's invoices suggest. ภ.ง.ด.3 or 53 follows the supplier.
 */
export function WhtCertificateForm({ suggestion }: { suggestion: Suggestion }) {
  const t = useTranslations("partnerSales.tax.certificates.form");
  const tIncome = useTranslations("partnerSales.tax.income");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() =>
    (suggestion.lines.length
      ? suggestion.lines
      : [{ incomeType: "hire_of_work" as IncomeType, description: null, ratePct: "3", baseAmount: "", whtAmount: "" }]
    ).map((l) => ({
      key: `w-${(seq += 1)}`,
      incomeType: l.incomeType,
      description: l.description ?? "",
      ratePct: trimZeros(l.ratePct),
      baseAmount: l.baseAmount,
      whtAmount: l.whtAmount,
    })),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const update = (index: number, patch: Partial<Line>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  async function save() {
    if (lines.some((l) => !MONEY.test(plainNumber(l.baseAmount)) || !MONEY.test(plainNumber(l.whtAmount)))) {
      setError(t("amountInvalid"));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const created = await erpPost<{ id: string; certNo: string }>(
        factoryId,
        "/wht-certificates",
        {},
        {
          paymentId: suggestion.payment.id,
          lines: lines.map((l) => ({
            incomeType: l.incomeType,
            description: l.description.trim() || null,
            ratePct: plainNumber(l.ratePct),
            baseAmount: plainNumber(l.baseAmount),
            whtAmount: plainNumber(l.whtAmount),
          })),
        },
        { idempotencyKey: key },
      );
      toast.success(t("saved", { no: created.certNo }));
      router.push(`/tax/certificates/${created.id}`);
    } catch (e) {
      toast.error(problemMessage(e, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-sm">
        {t("about", {
          supplier: suggestion.supplier.name,
          payment: suggestion.payment.code,
          date: format.date(suggestion.paidOn),
          form: t(`forms.${suggestion.form}`),
        })}
      </p>
      <ol className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <li key={line.key} className="border-border bg-surface rounded-xl border p-3 md:p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted text-sm font-medium">{t("line", { n: index + 1 })}</span>
              {lines.length > 1 ? (
                <IconButton
                  name="trash"
                  size="sm"
                  label={t("remove", { n: index + 1 })}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                />
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <Field label={t("incomeType")}>
                <Select
                  value={line.incomeType}
                  onValueChange={(value) =>
                    update(index, { incomeType: value as IncomeType, ratePct: USUAL[value as IncomeType] })
                  }
                  options={INCOME.map((i) => ({ value: i, label: tIncome(i) }))}
                />
              </Field>
              <Field label={t("description")}>
                <Input value={line.description} onChange={(event) => update(index, { description: event.target.value })} />
              </Field>
              <Field label={t("rate")}>
                <NumberInput step="any" min={0} max={100} unit="%" value={line.ratePct} onChange={(event) => update(index, { ratePct: event.target.value })} />
              </Field>
              <Field label={t("base")}>
                <NumberInput step="any" min={0} unit="฿" value={line.baseAmount} onChange={(event) => update(index, { baseAmount: event.target.value })} />
              </Field>
              <Field label={t("wht")}>
                <NumberInput step="any" min={0} unit="฿" value={line.whtAmount} onChange={(event) => update(index, { whtAmount: event.target.value })} />
              </Field>
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        iconStart="plus"
        className="self-start"
        onClick={() =>
          setLines([...lines, { key: `w-${(seq += 1)}`, incomeType: "service", description: "", ratePct: "3", baseAmount: "", whtAmount: "" }])
        }
      >
        {t("add")}
      </Button>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <Button size="xl" loading={busy} iconStart="stamp" className="self-start" onClick={() => void save()}>
        {t("save")}
      </Button>
    </div>
  );
}

/** A certificate's actions (D-366): print the 50 ทวิ, or void it to issue a corrected one. */
export function WhtActions({ certificate }: { certificate: Schemas["ErpWhtCertificateDto"] }) {
  const t = useTranslations("partnerSales.tax.certificates.actions");
  const tCommon = useTranslations("partnerSales.common");
  const params = { certificateId: certificate.id };
  return (
    <SalesActions
      offered={certificate.nextActions}
      actions={[
        { key: "erp_wht.pdf", kind: "pdf", path: "/wht-certificates/{certificateId}/pdf", params },
        {
          key: "erp_wht.void",
          kind: "post",
          path: "/wht-certificates/{certificateId}/actions/void",
          params,
          body: (reason) => ({ reason }),
          title: t("voidTitle"),
          description: t("voidBody", { no: certificate.certNo }),
          phrase: certificate.certNo,
          reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
          done: t("voided"),
        },
      ]}
    />
  );
}

type Report = Schemas["ErpTaxExportReport"];

/** Downloads of the month's tax reports for the factory's accountant or software (D-367). */
export function TaxExports({ month }: { month: string }) {
  const t = useTranslations("partnerSales.tax.exports");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const [busy, setBusy] = useState<string | null>(null);
  const reports: { report: Report; format: "csv" | "xlsx" }[] = [
    { report: "sales_vat", format: "csv" },
    { report: "purchase_vat", format: "csv" },
    { report: "pnd3", format: "csv" },
    { report: "pnd53", format: "csv" },
    { report: "accounting", format: "xlsx" },
  ];

  async function run(report: Report, fmt: "csv" | "xlsx") {
    setBusy(`${report}.${fmt}`);
    const tab = window.open("", "_blank");
    try {
      const result = await erpPost<{ url: string; rows: number }>(factoryId, "/tax/exports", {}, { report, month, format: fmt });
      if (tab) tab.location.href = result.url;
      else window.location.assign(result.url);
      toast.success(t("ready", { rows: result.rows }));
    } catch (e) {
      tab?.close();
      toast.error(problemMessage(e, tCommon("failed")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {reports.map(({ report, format: fmt }) => (
        <li key={report} className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
          <span className="font-medium">{t(`reports.${report}.title`)}</span>
          <span className="text-muted text-sm">{t(`reports.${report}.body`)}</span>
          <div className="flex flex-wrap gap-2">
            {(fmt === "xlsx" ? (["xlsx", "csv"] as const) : (["csv", "xlsx"] as const)).map((f) => (
              <Button
                key={f}
                variant={f === fmt ? "primary" : "secondary"}
                iconStart="download"
                loading={busy === `${report}.${f}`}
                onClick={() => void run(report, f)}
              >
                {t(f)}
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
