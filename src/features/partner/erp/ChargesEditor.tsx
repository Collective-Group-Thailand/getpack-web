"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";

import { useErpCall } from "./call";
import { plainNumber } from "./format";

type Charge = Schemas["ErpChargeInput"];
type Kind = Charge["kind"];
type Allocation = NonNullable<Charge["allocation"]>;
type Partner = Pick<Schemas["ErpTradingPartnerDto"], "id" | "code" | "name">;

const KINDS: Kind[] = ["freight", "insurance", "duty", "handling", "other"];
const ALLOCATIONS: Allocation[] = ["by_value", "by_quantity"];
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const SAME = "same";

export interface ChargeRow {
  key: number;
  kind: Kind;
  amount: string;
  allocation: Allocation;
  partnerId: string;
  reference: string;
  description: string;
}

export const newCharge = (key: number): ChargeRow => ({
  key,
  kind: "freight",
  amount: "",
  allocation: "by_value",
  partnerId: "",
  reference: "",
  description: "",
});

/** A charge row as the API takes it (D-350); empty rows are left out by the caller. */
export const chargeBody = (row: ChargeRow): Charge => ({
  kind: row.kind,
  amount: plainNumber(row.amount),
  allocation: row.allocation,
  ...(row.partnerId ? { partnerId: row.partnerId } : {}),
  reference: row.reference.trim() || null,
  description: row.description.trim() || null,
});

export const chargeValid = (row: ChargeRow) =>
  AMOUNT.test(plainNumber(row.amount)) && Number(plainNumber(row.amount)) > 0;

/** One charge's fields: kind, amount, how it spreads, who billed it and their document (D-350). */
function ChargeFields({
  row,
  partners,
  error,
  onChange,
}: {
  row: ChargeRow;
  partners: Partner[];
  error?: string;
  onChange: (row: ChargeRow) => void;
}) {
  const t = useTranslations("partnerOps.receiving");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={t("kind")}>
        <Select
          value={row.kind}
          onValueChange={(kind) => onChange({ ...row, kind })}
          options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        />
      </Field>
      <Field label={t("amount")} error={error}>
        <NumberInput
          step="any"
          min={0}
          unit="฿"
          value={row.amount}
          onChange={(event) => onChange({ ...row, amount: event.target.value })}
        />
      </Field>
      <Field label={t("allocation")}>
        <Select
          value={row.allocation}
          onValueChange={(allocation) => onChange({ ...row, allocation })}
          options={ALLOCATIONS.map((a) => ({ value: a, label: t(`allocations.${a}`) }))}
        />
      </Field>
      <Field label={t("chargeParty")}>
        <Select
          value={row.partnerId || SAME}
          onValueChange={(id) => onChange({ ...row, partnerId: id === SAME ? "" : id })}
          options={[
            { value: SAME, label: t("chargePartyNone") },
            ...partners.map((p) => ({ value: p.id, label: p.name, description: p.code })),
          ]}
        />
      </Field>
      <Field label={t("reference")}>
        <Input value={row.reference} onChange={(event) => onChange({ ...row, reference: event.target.value })} />
      </Field>
      <Field label={t("description")}>
        <Input value={row.description} onChange={(event) => onChange({ ...row, description: event.target.value })} />
      </Field>
    </div>
  );
}

/** Charges entered with a goods receipt, spread into the stock cost of what is accepted (D-350). */
export function ChargesEditor({
  rows,
  onChange,
  partners,
  errors,
}: {
  rows: ChargeRow[];
  onChange: (rows: ChargeRow[]) => void;
  partners: Partner[];
  errors: Record<number, string>;
}) {
  const t = useTranslations("partnerOps.receiving");
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-semibold">{t("charges")}</legend>
      <p className="text-muted text-sm">{t("chargesHint")}</p>
      {rows.map((row, index) => (
        <div key={row.key} className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex justify-end">
            <IconButton
              name="trash"
              size="sm"
              label={t("removeCharge", { n: index + 1 })}
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            />
          </div>
          <ChargeFields
            row={row}
            partners={partners}
            error={errors[row.key]}
            onChange={(next) => onChange(rows.map((r) => (r.key === row.key ? next : r)))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        iconStart="plus"
        className="self-start"
        disabled={rows.length >= 10}
        onClick={() => onChange([...rows, newCharge(Math.max(0, ...rows.map((r) => r.key)) + 1)])}
      >
        {t("addCharge")}
      </Button>
    </fieldset>
  );
}

/** A charge that came after the receipt (the carrier's invoice): revalues what is still in stock (D-350). */
export function AddChargeForm({ receiptId, partners }: { receiptId: string; partners: Partner[] }) {
  const t = useTranslations("partnerOps.receiving");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<ChargeRow>(() => newCharge(0));
  const [error, setError] = useState<string>();
  const [key] = useState(() => newIdempotencyKey());

  if (!open)
    return (
      <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setOpen(true)}>
        {t("addChargeTitle")}
      </Button>
    );
  return (
    <form
      className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!chargeValid(row)) {
          setError(t("chargeInvalid"));
          return;
        }
        setError(undefined);
        void call(
          async () =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/goods-receipts/{grId}/charges", {
                params: { path: { factoryId, grId: receiptId }, header: { "Idempotency-Key": key } },
                body: chargeBody(row),
              })
            ).data,
          t("chargeAdded"),
        ).then((ok) => ok && setOpen(false));
      }}
    >
      <h3 className="font-semibold">{t("addChargeTitle")}</h3>
      <ChargeFields row={row} partners={partners} error={error} onChange={setRow} />
      <Button type="submit" iconStart="save" loading={busy} className="self-start">
        {t("addCharge")}
      </Button>
    </form>
  );
}
