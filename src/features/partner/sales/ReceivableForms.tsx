"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { erpGet, erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type Method = Schemas["ErpPaymentMethod"];
type InvoiceRow = Schemas["ErpSalesInvoiceSummaryDto"];
const METHODS: Method[] = ["transfer", "cash", "cheque", "other"];
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** Satang from a decimal string, exactly (a form's running figure — the API checks and totals for real). */
const satang = (value: string) => {
  const [int = "0", dec = ""] = plainNumber(value || "0").split(".");
  return BigInt(int || "0") * 100n + BigInt((dec + "00").slice(0, 2));
};
const baht = (value: bigint) => {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};

/** A customer's invoices still owed (or, for a refund, owed back), for a receipt or billing note. */
function useOpenInvoices(customerId: string, refund = false) {
  const { factoryId } = useFactory();
  const [rows, setRows] = useState<{ customerId: string; rows: InvoiceRow[] }>({ customerId: "", rows: [] });
  useEffect(() => {
    if (!customerId) return;
    let live = true;
    erpGet<{ data: InvoiceRow[] }>(
      factoryId,
      "/sales-invoices",
      {},
      { customerId, perPage: "100", ...(refund ? {} : { status: "open" }) },
    )
      .then((page) => {
        if (live)
          setRows({
            customerId,
            rows: page.data.filter((row) =>
              refund ? row.openAmount.startsWith("-") : !row.openAmount.startsWith("-") && row.status !== "draft",
            ),
          });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [factoryId, customerId, refund]);
  return rows.customerId === customerId ? rows.rows : [];
}

/**
 * A receipt from a customer (D-365): what came in, how, the withholding tax the customer kept (with its 50 ทวิ
 * number), and which invoices it settles — each settled gross (cash + WHT). A refund pays back a credit.
 */
export function ReceiptForm({
  customers,
  preset,
}: {
  customers: { id: string; code: string; name: string }[];
  preset: { customerId?: string; invoiceId?: string };
}) {
  const t = useTranslations("partnerSales.receipts.form");
  const tMethods = useTranslations("partnerSales.methods");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [customerId, setCustomerId] = useState(preset.customerId ?? "");
  const [kind, setKind] = useState<"receipt" | "refund">("receipt");
  const [receivedOn, setReceivedOn] = useState(bangkokToday());
  const [method, setMethod] = useState<Method>("transfer");
  const [reference, setReference] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [wht, setWht] = useState("");
  const [whtCertNo, setWhtCertNo] = useState("");
  const [whtCertDate, setWhtCertDate] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const refund = kind === "refund";
  const invoices = useOpenInvoices(customerId, refund);
  const abs = (v: string) => v.replace(/^-/, "");

  // Start with the invoice the screen was opened for, settled in full, until the person changes the choice.
  const [chosenByHand, setChosenByHand] = useState(false);
  const first = invoices.find((row) => row.id === preset.invoiceId);
  const alloc = chosenByHand ? picked : first ? { [first.id]: abs(first.openAmount) } : {};
  const setAlloc = (next: Record<string, string>) => {
    setChosenByHand(true);
    setPicked(next);
  };

  const allocated = Object.values(alloc).reduce((sum, v) => sum + (MONEY.test(plainNumber(v)) ? satang(v) : 0n), 0n);
  const expected = baht(allocated - (refund ? 0n : satang(wht)));
  const cash = touched ? amount : allocated > 0n ? expected : "";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const allocations = Object.entries(alloc)
      .map(([invoiceId, value]) => ({ invoiceId, amount: plainNumber(value) }))
      .filter((a) => a.amount && satang(a.amount) > 0n);
    if (!customerId) return setError(t("customerRequired"));
    if (!allocations.length) return setError(t("allocationRequired"));
    if (
      allocations.some((a) => !MONEY.test(a.amount)) ||
      !MONEY.test(plainNumber(cash)) ||
      (wht && !MONEY.test(plainNumber(wht)))
    )
      return setError(t("amountInvalid"));
    setError(undefined);
    setBusy(true);
    try {
      const created = await erpPost<{ id: string; receiptNo: string }>(
        factoryId,
        "/receipts",
        {},
        {
          customerId,
          kind,
          receivedOn,
          method,
          reference: reference.trim() || null,
          ...(method === "cheque"
            ? {
                chequeNo: chequeNo.trim() || null,
                chequeBank: chequeBank.trim() || null,
                chequeDate: chequeDate || null,
              }
            : {}),
          amount: plainNumber(cash),
          ...(!refund && wht
            ? { whtAmount: plainNumber(wht), whtCertNo: whtCertNo.trim() || null, whtCertDate: whtCertDate || null }
            : {}),
          note: note.trim() || null,
          allocations,
        },
        { idempotencyKey: key },
      );
      toast.success(t("saved", { no: created.receiptNo }));
      router.push(`/receivables/receipts/${created.id}`);
    } catch (e) {
      toast.error(problemMessage(e, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={tCommon("customer")} required requiredLabel={tCommon("required")}>
          <Select
            value={customerId || null}
            placeholder={t("customerPlaceholder")}
            onValueChange={(id) => {
              setCustomerId(id);
              setAlloc({});
            }}
            options={customers.map((c) => ({ value: c.id, label: c.name, description: c.code }))}
          />
        </Field>
        <SegmentedControl
          label={t("kind")}
          size="md"
          value={kind}
          onValueChange={(next) => {
            setKind(next);
            setAlloc({});
          }}
          options={[
            { value: "receipt", label: t("kinds.receipt") },
            { value: "refund", label: t("kinds.refund") },
          ]}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{refund ? t("refundInvoices") : t("invoices")}</legend>
        {!customerId ? (
          <p className="text-muted text-sm">{t("pickCustomer")}</p>
        ) : invoices.length ? (
          invoices.map((row) => (
            <div
              key={row.id}
              className="border-border bg-surface grid items-center gap-2 rounded-xl border p-3 md:grid-cols-[1fr_12rem]"
            >
              <Checkbox
                checked={row.id in alloc}
                onCheckedChange={(on) => {
                  const next = { ...alloc };
                  if (on) next[row.id] = abs(row.openAmount);
                  else delete next[row.id];
                  setAlloc(next);
                }}
                label={`${row.invoiceNo ?? ""} · ${format.date(row.issueDate)}`}
                description={t("openLine", { open: format.thb(abs(row.openAmount)), due: format.date(row.dueDate) })}
              />
              {row.id in alloc ? (
                <NumberInput
                  aria-label={t("settle", { no: row.invoiceNo ?? "" })}
                  step="any"
                  min={0}
                  unit="฿"
                  value={alloc[row.id]}
                  onChange={(event) => setAlloc({ ...alloc, [row.id]: event.target.value })}
                />
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-muted text-sm">{refund ? t("noRefunds") : t("noInvoices")}</p>
        )}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("receivedOn")}>
          <Input
            type="date"
            value={receivedOn}
            onChange={(event) => setReceivedOn(event.target.value || bangkokToday())}
          />
        </Field>
        <Field label={t("method")}>
          <Select
            value={method}
            onValueChange={(value) => setMethod(value as Method)}
            options={METHODS.map((m) => ({ value: m, label: tMethods(m) }))}
          />
        </Field>
        <Field label={t("reference")}>
          <Input
            value={reference}
            placeholder={t("referencePlaceholder")}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
        {method === "cheque" ? (
          <>
            <Field label={t("chequeNo")}>
              <Input value={chequeNo} onChange={(event) => setChequeNo(event.target.value)} />
            </Field>
            <Field label={t("chequeBank")}>
              <Input value={chequeBank} onChange={(event) => setChequeBank(event.target.value)} />
            </Field>
            <Field label={t("chequeDate")}>
              <Input type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} />
            </Field>
          </>
        ) : null}
      </div>
      {!refund ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("wht")} hint={t("whtHint")}>
            <NumberInput step="any" min={0} unit="฿" value={wht} onChange={(event) => setWht(event.target.value)} />
          </Field>
          <Field label={t("whtCertNo")}>
            <Input value={whtCertNo} onChange={(event) => setWhtCertNo(event.target.value)} />
          </Field>
          <Field label={t("whtCertDate")}>
            <Input type="date" value={whtCertDate} onChange={(event) => setWhtCertDate(event.target.value)} />
          </Field>
        </div>
      ) : null}
      <Field label={refund ? t("refundAmount") : t("amount")} hint={t("amountHint")} error={error}>
        <NumberInput
          step="any"
          min={0}
          unit="฿"
          value={cash}
          onChange={(event) => {
            setTouched(true);
            setAmount(event.target.value);
          }}
        />
      </Field>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {refund ? t("saveRefund") : t("save")}
      </Button>
    </form>
  );
}

/** A billing note (D-365): the invoices a customer is asked to pay together, and when it will be collected. */
export function BillingForm({
  customers,
  preset,
}: {
  customers: { id: string; code: string; name: string }[];
  preset: { customerId?: string };
}) {
  const t = useTranslations("partnerSales.billing.form");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [customerId, setCustomerId] = useState(preset.customerId ?? "");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [billingDate, setBillingDate] = useState(bangkokToday());
  const [collectOn, setCollectOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);
  const invoices = useOpenInvoices(customerId);

  async function save() {
    if (!chosen.size) {
      toast.error(t("nothingChosen"));
      return;
    }
    setBusy(true);
    try {
      const created = await erpPost<{ id: string; billingNo: string }>(
        factoryId,
        "/billing-notes",
        {},
        { customerId, invoiceIds: [...chosen], billingDate, collectOn: collectOn || null, note: note.trim() || null },
        { idempotencyKey: key },
      );
      toast.success(t("saved", { no: created.billingNo }));
      router.push(`/receivables/billing/${created.id}`);
    } catch (e) {
      toast.error(problemMessage(e, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label={tCommon("customer")} required requiredLabel={tCommon("required")}>
        <Select
          value={customerId || null}
          placeholder={t("customerPlaceholder")}
          onValueChange={(id) => {
            setCustomerId(id);
            setChosen(new Set());
          }}
          options={customers.map((c) => ({ value: c.id, label: c.name, description: c.code }))}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("invoices")}</legend>
        {!customerId ? (
          <p className="text-muted text-sm">{t("pickCustomer")}</p>
        ) : invoices.length ? (
          invoices.map((row) => (
            <Checkbox
              key={row.id}
              checked={chosen.has(row.id)}
              onCheckedChange={(on) => {
                const next = new Set(chosen);
                if (on) next.add(row.id);
                else next.delete(row.id);
                setChosen(next);
              }}
              label={`${row.invoiceNo ?? ""} · ${format.thb(row.openAmount)}`}
              description={t("dueLine", { date: format.date(row.dueDate) })}
            />
          ))
        ) : (
          <p className="text-muted text-sm">{t("noInvoices")}</p>
        )}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("billingDate")}>
          <Input
            type="date"
            value={billingDate}
            onChange={(event) => setBillingDate(event.target.value || bangkokToday())}
          />
        </Field>
        <Field label={t("collectOn")} hint={t("collectOnHint")}>
          <Input
            type="date"
            min={billingDate}
            value={collectOn}
            onChange={(event) => setCollectOn(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button size="xl" loading={busy} iconStart="save" className="self-start" onClick={() => void save()}>
        {t("save")}
      </Button>
    </div>
  );
}

/** A receipt's actions (D-365): print it, or cancel it (what it settled is owed again). */
export function ReceiptActions({ receipt }: { receipt: Schemas["ErpCustomerReceiptDto"] }) {
  const t = useTranslations("partnerSales.receipts.actions");
  const tCommon = useTranslations("partnerSales.common");
  const params = { receiptId: receipt.id };
  return (
    <SalesActions
      offered={receipt.nextActions}
      actions={[
        { key: "erp_rc.pdf", kind: "pdf", path: "/receipts/{receiptId}/pdf", params },
        {
          key: "erp_rc.cancel",
          kind: "post",
          path: "/receipts/{receiptId}/actions/cancel",
          params,
          body: (reason) => ({ reason }),
          title: t("cancelTitle"),
          description: t("cancelBody", { no: receipt.receiptNo }),
          phrase: receipt.receiptNo,
          reason: { label: tCommon("reason"), placeholder: t("cancelPlaceholder") },
          done: t("cancelled"),
        },
      ]}
    />
  );
}

/** A billing note's actions (D-365): print or cancel it. */
export function BillingActions({ billing }: { billing: Schemas["ErpBillingNoteDto"] }) {
  const t = useTranslations("partnerSales.billing.actions");
  const tCommon = useTranslations("partnerSales.common");
  const params = { billingNoteId: billing.id };
  return (
    <SalesActions
      offered={billing.nextActions}
      actions={[
        { key: "erp_bn.pdf", kind: "pdf", path: "/billing-notes/{billingNoteId}/pdf", params },
        {
          key: "erp_bn.cancel",
          kind: "post",
          path: "/billing-notes/{billingNoteId}/actions/cancel",
          params,
          body: (reason) => ({ reason }),
          title: t("cancelTitle"),
          description: t("cancelBody", { no: billing.billingNo }),
          reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
          done: t("cancelled"),
        },
      ]}
    />
  );
}
