"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, problemMessage } from "../console";

type EntryKind = Schemas["AgentLeadActivityEntryKind"];
type Reason = Schemas["AgentDiscountReason"];
const ENTRY_KINDS: readonly EntryKind[] = ["call", "line", "visit", "email", "note"];
const REASONS: readonly Reason[] = ["competitor_price", "budget", "volume", "strategic_account", "other"];

/** "บันทึกการติดต่อ": a call, a LINE chat, a visit, an e-mail or a note on the lead's timeline. */
export function LogActivity({ leadId }: { leadId: string }) {
  const t = useTranslations("sales.lead.log");
  const tKinds = useTranslations("agentSales.timeline.kinds");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EntryKind>("call");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" iconStart="edit" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title")}
          submitLabel={t("submit")}
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            if (!body.trim()) {
              setError(t("bodyRequired"));
              throw new Error("body");
            }
            try {
              await adminBrowserApis().contract.POST("/v1/admin/sales/leads/{leadId}/activities", {
                params: { path: { leadId } },
                body: { kind, body: body.trim() },
              });
              toast.success(t("done"));
              setOpen(false);
              router.refresh();
            } catch (failure) {
              toast.error(problemMessage(failure, t("failed")));
              throw failure;
            }
          }}
        >
          <Field label={t("kind")}>
            <RadioCards
              options={ENTRY_KINDS.map((value) => ({ value, label: tKinds(value) }))}
              value={kind}
              onValueChange={setKind}
              columns={3}
            />
          </Field>
          <Field label={t("body")} error={error ?? undefined} required>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} />
          </Field>
        </FormDialog>
      ) : null}
    </>
  );
}

/**
 * A quote for the lead, made from the desk (`admin.salesQuotes.create`): the rep starts from a spec the desk already
 * quoted (the configuration of an earlier sales quote) and sets the quantity and delivery postcode; getpack's pricing
 * path prices it. The staff zone has no configurator a rep may open (the catalogue is not theirs to read), so a lead
 * with nothing to start from is sent to the quotes list with the reason — recorded as a contract request.
 */
export function NewSalesQuote({ leadId, leadName }: { leadId: string; leadName: string }) {
  const t = useTranslations("sales.lead.quote");
  const format = useFormat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const specs = useQuery({
    queryKey: queryKeys.list("admin", "sales_quote", { perPage: 50, purpose: "specs" }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/quotes", { params: { query: { perPage: 50 } } })).data!,
    enabled: open,
  });
  // One starting point per product spec (the newest quote of each).
  const starts = (specs.data?.data ?? []).filter(
    (row, at, all) =>
      row.quote.configuration &&
      all.findIndex((other) => other.quote.summary.product?.slug === row.quote.summary.product?.slug) === at,
  );
  const chosen = starts.find((row) => row.id === base) ?? starts[0];
  return (
    <>
      <Button iconStart="plus" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title", { name: leadName })}
          description={t("description")}
          submitLabel={t("submit")}
          size="lg"
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            const count = Number.parseInt(quantity, 10);
            if (!chosen?.quote.configuration) {
              setError(t("noSpec"));
              throw new Error("spec");
            }
            if (!Number.isFinite(count) || count < 1) {
              setError(t("quantityRequired"));
              throw new Error("quantity");
            }
            try {
              await adminBrowserApis().contract.POST("/v1/admin/sales/quotes", {
                body: {
                  leadId,
                  productTypeCode: chosen.quote.productTypeCode,
                  configuration: { ...chosen.quote.configuration, quantities: [count] } as never,
                  ...(/^\d{5}$/.test(postcode) ? { deliveryPostcode: postcode } : {}),
                },
              });
              toast.success(t("done"));
              setOpen(false);
              router.refresh();
            } catch (failure) {
              toast.error(problemMessage(failure, t("failed")));
              throw failure;
            }
          }}
        >
          {specs.isLoading ? (
            <p className="text-muted text-sm">{t("loading")}</p>
          ) : starts.length === 0 ? (
            <Callout tone="warning" title={t("noSpecTitle")}>
              {t("noSpec")}
            </Callout>
          ) : (
            <Field label={t("spec")} hint={t("specHint")}>
              <RadioCards
                columns={2}
                value={chosen?.id}
                onValueChange={setBase}
                options={starts.map((row) => ({
                  value: row.id,
                  label: row.quote.summary.product?.nameTh ?? row.quote.quoteCode ?? row.id.slice(0, 8),
                  description: row.quote.summary.specs
                    .filter((spec) => spec.key !== "size")
                    .map((spec) => spec.valueTh)
                    .join(" · "),
                  badge: row.quote.quoteCode ?? undefined,
                  footer: t("quotedFor", {
                    quantity: format.number(row.quote.options[0]?.quantity ?? 0),
                    date: format.date(row.sentAt, { style: "dayMonth" }),
                  }),
                }))}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("quantity")} error={error ?? undefined} required>
              <Input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                enterKeyHint="next"
              />
            </Field>
            <Field label={t("postcode")} hint={t("postcodeHint")}>
              <Input
                value={postcode}
                onChange={(event) => setPostcode(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </Field>
          </div>
        </FormDialog>
      ) : null}
    </>
  );
}

/**
 * "ขอส่วนลด" on a sales quote (`admin.salesQuotes.requestDiscount`, opens the approval): what the customer gives back
 * first (at least one), then the percentage and the reason — the same give-get discipline as the agent zone.
 */
export function RequestDiscount({ agentQuoteId, quoteCode }: { agentQuoteId: string; quoteCode: string | null }) {
  const t = useTranslations("sales.lead.discount");
  const tReasons = useTranslations("agentSales.discount.reasons");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [give, setGive] = useState({
    depositPct: "",
    cashWithinDays: "",
    quantityChange: "",
    commitmentMonths: "",
    leadTimeFlexDays: "",
  });
  const [callOff, setCallOff] = useState(false);
  const [pct, setPct] = useState("");
  const [reason, setReason] = useState<Reason>("volume");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const number = (value: string) => (value.trim() ? Number(value) : undefined);
  const set = (key: keyof typeof give) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setGive((current) => ({ ...current, [key]: event.target.value.replace(/[^0-9.]/g, "") }));
  return (
    <>
      <Button size="sm" variant="secondary" iconStart="percent" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      {open ? (
        <FormDialog
          title={t("title", { code: quoteCode ?? "" })}
          description={t("description")}
          submitLabel={t("submit")}
          size="lg"
          onClose={() => setOpen(false)}
          onSubmit={async () => {
            const anyGive =
              Object.values(give).some((value) => value.trim()) || (callOff && give.commitmentMonths.trim());
            if (!anyGive) {
              setError(t("giveRequired"));
              throw new Error("give");
            }
            if (!pct.trim() || !(Number(pct) > 0)) {
              setError(t("pctRequired"));
              throw new Error("pct");
            }
            try {
              await adminBrowserApis().contract.POST("/v1/admin/sales/quotes/{agentQuoteId}/discount-requests", {
                params: { path: { agentQuoteId } },
                body: {
                  requestedPct: pct.trim(),
                  reason,
                  ...(note.trim() ? { reasonNote: note.trim() } : {}),
                  ...(give.depositPct.trim() ? { depositPct: give.depositPct.trim() } : {}),
                  ...(number(give.cashWithinDays) !== undefined
                    ? { cashWithinDays: number(give.cashWithinDays)! }
                    : {}),
                  ...(number(give.quantityChange) !== undefined
                    ? { quantityChange: number(give.quantityChange)! }
                    : {}),
                  ...(number(give.leadTimeFlexDays) !== undefined
                    ? { leadTimeFlexDays: number(give.leadTimeFlexDays)! }
                    : {}),
                  commitment: callOff && number(give.commitmentMonths) !== undefined ? "call_off" : "one_off",
                  ...(callOff && number(give.commitmentMonths) !== undefined
                    ? { commitmentMonths: number(give.commitmentMonths)! }
                    : {}),
                },
              });
              toast.success(t("done"));
              setOpen(false);
              router.refresh();
            } catch (failure) {
              toast.error(problemMessage(failure, t("failed")));
              throw failure;
            }
          }}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-semibold">{t("giveLegend")}</legend>
            <p className="text-muted -mt-1 text-sm">{t("giveHint")}</p>
            {error === t("giveRequired") ? <Callout tone="danger" title={error} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("give.depositPct")}>
                <Input value={give.depositPct} onChange={set("depositPct")} inputMode="decimal" />
              </Field>
              <Field label={t("give.cashWithinDays")}>
                <Input value={give.cashWithinDays} onChange={set("cashWithinDays")} inputMode="numeric" />
              </Field>
              <Field label={t("give.quantityChange")}>
                <Input value={give.quantityChange} onChange={set("quantityChange")} inputMode="numeric" />
              </Field>
              <Field label={t("give.leadTimeFlexDays")}>
                <Input value={give.leadTimeFlexDays} onChange={set("leadTimeFlexDays")} inputMode="numeric" />
              </Field>
            </div>
            <Checkbox
              checked={callOff}
              onCheckedChange={(next) => setCallOff(next === true)}
              label={t("give.callOff")}
            />
            {callOff ? (
              <Field label={t("give.commitmentMonths")}>
                <Input value={give.commitmentMonths} onChange={set("commitmentMonths")} inputMode="numeric" />
              </Field>
            ) : null}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("pct")} hint={t("pctHint")} error={error === t("pctRequired") ? error : undefined} required>
              <Input
                value={pct}
                onChange={(event) => setPct(event.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
              />
            </Field>
            <Field label={t("reason")}>
              <RadioCards
                columns={1}
                value={reason}
                onValueChange={setReason}
                options={REASONS.map((value) => ({ value, label: tReasons(value) }))}
              />
            </Field>
          </div>
          <Field label={t("note")}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </Field>
        </FormDialog>
      ) : null}
    </>
  );
}
