"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useProblemText } from "@/features/agent/pipeline/problem";
import { toMoneyInput } from "@/features/agent/pipeline/phone";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input, Textarea } from "@/ui/components/Input";
import { ProgressTracker } from "@/ui/components/ProgressTracker";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Reason = Schemas["AgentDiscountReason"];
type GiveKey = "quantity" | "callOff" | "deposit" | "cash" | "leadTime" | "spec";
const GIVES: readonly { key: GiveKey; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { key: "quantity", icon: "package" },
  { key: "callOff", icon: "calendar" },
  { key: "deposit", icon: "wallet" },
  { key: "cash", icon: "coins" },
  { key: "leadTime", icon: "clock" },
  { key: "spec", icon: "sliders" },
];
const REASONS: readonly Reason[] = ["competitor_price", "budget", "volume", "strategic_account", "other"];

const whole = (value: string, min: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const pctOf = (value: string) => (/^\d{1,2}(\.\d{1,2})?$/.test(value.trim()) ? value.trim() : null);

/**
 * A discount request (D-468 §3, PROMPT P3 Web 5), give-get first:
 *   1 · ลูกค้าให้อะไรกลับมา — at least one thing the customer gives (more quantity, a call-off contract, deposit, cash,
 *       a longer lead time, a lighter spec) and the discount asked;
 *   2 · why — the reason, and for a cheaper competitor their quote (a file) and a like-for-like spec;
 *   3 · review, then send. getpack answers with options (Phase 4); until then the request waits, and says so.
 * The playbook card for the context sits beside the form (above it, collapsed, on a phone).
 */
export function DiscountFlow({
  agentQuoteId,
  quantity,
  previous,
  aside,
}: {
  agentQuoteId: string;
  /** The quantity the request is for (the quote's largest), for the copy. */
  quantity: number;
  /** The last round's give-get, so a new round can say it must differ. */
  previous: boolean;
  aside: React.ReactNode;
}) {
  const t = useTranslations("agentSales.discount");
  const format = useFormat();
  const problemText = useProblemText();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [gives, setGives] = useState<Set<GiveKey>>(new Set());
  const [values, setValues] = useState({ quantity: "", months: "6", deposit: "50", cash: "7", leadTime: "7", spec: "" });
  const [requestedPct, setRequestedPct] = useState("");
  const [reason, setReason] = useState<Reason | undefined>(undefined);
  const [reasonNote, setReasonNote] = useState("");
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [spec, setSpec] = useState({ boardGrade: "", flute: "", printSides: "", printColours: "", finish: "", quantity: "", leadTimeDays: "", price: "", shippingIncluded: false, vatIncluded: true, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (key: GiveKey) =>
    setGives((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setValue = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const setSpecValue = (key: keyof typeof spec) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSpec((current) => ({ ...current, [key]: event.target.value }));

  const giveGet = () => {
    const out: Partial<Schemas["RequestAgentDiscountDto"]> = { commitment: "one_off" };
    const next: Record<string, string> = {};
    if (gives.has("quantity")) {
      const n = whole(values.quantity, 1, 10_000_000);
      if (!n) next["quantity"] = t("errors.quantity");
      else out.quantityChange = n;
    }
    if (gives.has("callOff")) {
      const n = whole(values.months, 2, 24);
      if (!n) next["months"] = t("errors.months");
      else Object.assign(out, { commitment: "call_off", commitmentMonths: n });
    }
    if (gives.has("deposit")) {
      const pct = pctOf(values.deposit);
      if (!pct || Number(pct) > 100) next["deposit"] = t("errors.deposit");
      else out.depositPct = pct;
    }
    if (gives.has("cash")) {
      const n = whole(values.cash, 0, 60);
      if (n === null) next["cash"] = t("errors.cash");
      else out.cashWithinDays = n;
    }
    if (gives.has("leadTime")) {
      const n = whole(values.leadTime, 1, 90);
      if (!n) next["leadTime"] = t("errors.leadTime");
      else out.leadTimeFlexDays = n;
    }
    if (gives.has("spec")) {
      if (!values.spec.trim()) next["spec"] = t("errors.spec");
      else out.specChange = values.spec.trim();
    }
    return { out, next };
  };

  const next = () => {
    setProblem(null);
    if (step === 0) {
      const { next: found } = giveGet();
      if (gives.size === 0) found["gives"] = t("errors.gives");
      if (!pctOf(requestedPct) || Number(requestedPct) <= 0) found["pct"] = t("errors.pct");
      setErrors(found);
      if (Object.keys(found).length === 0) setStep(1);
      return;
    }
    if (step === 1) {
      const found: Record<string, string> = {};
      if (!reason) found["reason"] = t("errors.reason");
      if (reason === "competitor_price" && !file && !spec.price.trim() && !spec.boardGrade.trim())
        found["evidence"] = t("errors.evidence");
      if (spec.price.trim() && !toMoneyInput(spec.price)) found["price"] = t("errors.price");
      setErrors(found);
      if (Object.keys(found).length === 0) setStep(2);
    }
  };

  const competitorSpec = (): Schemas["CompetitorSpecDto"] | undefined => {
    if (reason !== "competitor_price") return undefined;
    const out: Schemas["CompetitorSpecDto"] = {};
    if (spec.boardGrade.trim()) out.boardGrade = spec.boardGrade.trim();
    if (spec.flute.trim()) out.flute = spec.flute.trim();
    if (spec.finish.trim()) out.finish = spec.finish.trim();
    if (spec.notes.trim()) out.notes = spec.notes.trim();
    const n = (value: string) => (value.trim() && Number.isInteger(Number(value)) ? Number(value) : undefined);
    const sides = n(spec.printSides);
    if (sides !== undefined) out.printSides = sides;
    const colours = n(spec.printColours);
    if (colours !== undefined) out.printColours = colours;
    const qty = n(spec.quantity);
    if (qty !== undefined) out.quantity = qty;
    const days = n(spec.leadTimeDays);
    if (days !== undefined) out.leadTimeDays = days;
    const price = toMoneyInput(spec.price);
    if (price) out.price = price;
    out.shippingIncluded = spec.shippingIncluded;
    out.vatIncluded = spec.vatIncluded;
    return Object.keys(out).length > 2 ? out : undefined;
  };

  const send = async () => {
    const { out } = giveGet();
    setBusy(true);
    setProblem(null);
    try {
      await browserApi().POST("/v1/store/agent/quotes/{agentQuoteId}/discount-requests", {
        params: { path: { agentQuoteId } },
        body: {
          ...out,
          commitment: out.commitment ?? "one_off",
          requestedPct: pctOf(requestedPct)!,
          reason: reason!,
          ...(reasonNote.trim() ? { reasonNote: reasonNote.trim() } : {}),
          ...(file ? { competitorFileId: file.id } : {}),
          ...(competitorSpec() ? { competitorSpec: competitorSpec() } : {}),
        },
      });
      toast.success(t("sent"));
      router.push(`/quotes/${agentQuoteId}`);
      router.refresh();
    } catch (error) {
      setProblem(problemText(error));
    } finally {
      setBusy(false);
    }
  };

  const giveSummary = () => {
    const { out } = giveGet();
    return [
      out.quantityChange ? t("giveGet.summary.quantity", { quantity: format.number(out.quantityChange) }) : null,
      out.commitment === "call_off" ? t("giveGet.summary.callOff", { months: out.commitmentMonths ?? 0 }) : null,
      out.depositPct ? t("giveGet.summary.deposit", { pct: format.percent(out.depositPct) }) : null,
      out.cashWithinDays !== undefined ? t("giveGet.summary.cash", { days: out.cashWithinDays }) : null,
      out.leadTimeFlexDays ? t("giveGet.summary.leadTime", { days: out.leadTimeFlexDays }) : null,
      out.specChange ? t("giveGet.summary.spec", { spec: out.specChange }) : null,
    ].filter(Boolean) as string[];
  };

  const stages = ["giveGet", "reason", "review"].map((key, index) => ({
    key,
    title: t(`steps.${key}`),
    state: (index < step ? "done" : index === step ? "current" : "upcoming") as "done" | "current" | "upcoming",
  }));

  const giveField = (key: GiveKey) => {
    switch (key) {
      case "quantity":
        return (
          <Field label={t("giveGet.quantityLabel", { current: format.number(quantity) })} error={errors["quantity"]}>
            <Input inputMode="numeric" value={values.quantity} onChange={setValue("quantity")} className="sm:max-w-40" />
          </Field>
        );
      case "callOff":
        return (
          <Field label={t("giveGet.monthsLabel")} hint={t("giveGet.monthsHint")} error={errors["months"]}>
            <Input inputMode="numeric" value={values.months} onChange={setValue("months")} className="sm:max-w-28" />
          </Field>
        );
      case "deposit":
        return (
          <Field label={t("giveGet.depositLabel")} error={errors["deposit"]}>
            <Input inputMode="decimal" value={values.deposit} onChange={setValue("deposit")} className="sm:max-w-28" />
          </Field>
        );
      case "cash":
        return (
          <Field label={t("giveGet.cashLabel")} error={errors["cash"]}>
            <Input inputMode="numeric" value={values.cash} onChange={setValue("cash")} className="sm:max-w-28" />
          </Field>
        );
      case "leadTime":
        return (
          <Field label={t("giveGet.leadTimeLabel")} error={errors["leadTime"]}>
            <Input inputMode="numeric" value={values.leadTime} onChange={setValue("leadTime")} className="sm:max-w-28" />
          </Field>
        );
      case "spec":
        return (
          <Field label={t("giveGet.specLabel")} error={errors["spec"]}>
            <Input value={values.spec} onChange={setValue("spec")} placeholder={t("giveGet.specExample")} />
          </Field>
        );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="lg:order-2">{aside}</div>
      <div className="flex min-w-0 flex-col gap-5 lg:order-1">
        <ProgressTracker
          label={t("progress")}
          stateLabels={{ done: t("stateDone"), current: t("stateCurrent"), upcoming: "", skipped: "" }}
          stages={stages}
          className="md:max-w-xl"
        />

        {step === 0 ? (
          <fieldset className="flex flex-col gap-4">
            <legend className="text-lg font-semibold">{t("steps.giveGet")}</legend>
            <p className="text-muted -mt-2 text-sm">{previous ? t("giveGet.introAgain") : t("giveGet.intro")}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {GIVES.map((give) => {
                const on = gives.has(give.key);
                return (
                  <li
                    key={give.key}
                    className={cn(
                      "border-border bg-surface rounded-card flex flex-col gap-3 border p-4 transition-colors duration-150 motion-reduce:transition-none",
                      on && "border-primary/50 bg-primary-subtle/40 sm:col-span-2",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon name={give.icon} size={20} aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                      <Checkbox
                        label={t(`giveGet.options.${give.key}.title`)}
                        description={t(`giveGet.options.${give.key}.body`)}
                        checked={on}
                        onCheckedChange={() => toggle(give.key)}
                      />
                    </div>
                    {on ? <div className="ps-8">{giveField(give.key)}</div> : null}
                  </li>
                );
              })}
            </ul>
            {errors["gives"] ? <Callout tone="danger" title={errors["gives"]} live /> : null}
            <Field label={t("pctLabel")} hint={t("pctHint")} error={errors["pct"]} className="sm:max-w-xs">
              <Input inputMode="decimal" value={requestedPct} onChange={(event) => setRequestedPct(event.target.value)} />
            </Field>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="flex flex-col gap-4">
            <legend className="text-lg font-semibold">{t("steps.reason")}</legend>
            <Field label={t("reasonLabel")} required error={errors["reason"]}>
              <RadioCards
                columns={2}
                value={reason}
                onValueChange={(value) => {
                  setReason(value);
                  setErrors({});
                }}
                options={REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
              />
            </Field>
            <Field label={t("reasonNote")}>
              <Textarea rows={2} maxLength={500} value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} />
            </Field>
            {reason === "competitor_price" ? (
              <section aria-labelledby="evidence" className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4">
                <div>
                  <h3 id="evidence" className="font-semibold">
                    {t("evidence.title")}
                  </h3>
                  <p className="text-muted text-sm">{t("evidence.body")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <FilePickButton
                    label={file ? t("evidence.replace") : t("evidence.attach")}
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    icon="paperclip"
                    loading={uploading}
                    onFiles={(files) => {
                      const picked = files[0];
                      if (!picked) return;
                      setUploading(true);
                      void uploadFile("agent", picked, "evidence")
                        .then((uploaded) => setFile({ id: uploaded.id, name: uploaded.originalName ?? picked.name }))
                        .catch((error: unknown) => toast.error(problemText(error)))
                        .finally(() => setUploading(false));
                    }}
                  />
                  {file ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Icon name="file-check" size={16} aria-hidden="true" className="text-success" />
                      {file.name}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("evidence.boardGrade")}>
                    <Input value={spec.boardGrade} onChange={setSpecValue("boardGrade")} placeholder={t("evidence.boardGradeExample")} />
                  </Field>
                  <Field label={t("evidence.flute")}>
                    <Input value={spec.flute} onChange={setSpecValue("flute")} placeholder={t("evidence.fluteExample")} />
                  </Field>
                  <Field label={t("evidence.printSides")}>
                    <Input inputMode="numeric" value={spec.printSides} onChange={setSpecValue("printSides")} />
                  </Field>
                  <Field label={t("evidence.printColours")}>
                    <Input inputMode="numeric" value={spec.printColours} onChange={setSpecValue("printColours")} />
                  </Field>
                  <Field label={t("evidence.finish")}>
                    <Input value={spec.finish} onChange={setSpecValue("finish")} />
                  </Field>
                  <Field label={t("evidence.quantity")}>
                    <Input inputMode="numeric" value={spec.quantity} onChange={setSpecValue("quantity")} />
                  </Field>
                  <Field label={t("evidence.leadTime")}>
                    <Input inputMode="numeric" value={spec.leadTimeDays} onChange={setSpecValue("leadTimeDays")} />
                  </Field>
                  <Field label={t("evidence.price")} error={errors["price"]}>
                    <Input inputMode="decimal" value={spec.price} onChange={setSpecValue("price")} />
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <Checkbox
                    label={t("evidence.shipping")}
                    checked={spec.shippingIncluded}
                    onCheckedChange={(on) => setSpec((current) => ({ ...current, shippingIncluded: on === true }))}
                  />
                  <Checkbox
                    label={t("evidence.vat")}
                    checked={spec.vatIncluded}
                    onCheckedChange={(on) => setSpec((current) => ({ ...current, vatIncluded: on === true }))}
                  />
                </div>
                <Field label={t("evidence.notes")}>
                  <Input value={spec.notes} onChange={setSpecValue("notes")} placeholder={t("evidence.notesExample")} />
                </Field>
                {errors["evidence"] ? <Callout tone="danger" title={errors["evidence"]} live /> : null}
              </section>
            ) : null}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="review" className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 sm:p-5">
            <h2 id="review" className="text-lg font-semibold">
              {t("steps.review")}
            </h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-muted text-xs">{t("review.pct")}</dt>
                <dd className="text-base font-semibold">{format.percent(pctOf(requestedPct) ?? "0")}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">{t("review.gives")}</dt>
                <dd>
                  <ul className="list-disc ps-5">
                    {giveSummary().map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs">{t("review.reason")}</dt>
                <dd>
                  {reason ? t(`reasons.${reason}`) : "—"}
                  {reasonNote.trim() ? ` · ${reasonNote.trim()}` : ""}
                </dd>
              </div>
              {reason === "competitor_price" ? (
                <div>
                  <dt className="text-muted text-xs">{t("review.evidence")}</dt>
                  <dd>{[file?.name, spec.price ? t("review.theirPrice", { price: format.thb(toMoneyInput(spec.price)) }) : null].filter(Boolean).join(" · ") || "—"}</dd>
                </div>
              ) : null}
            </dl>
            <Callout tone="info" title={t("review.whatNext")}>
              {t("review.whatNextBody")}
            </Callout>
          </section>
        ) : null}

        {problem ? <Callout tone="danger" title={problem} live /> : null}
        <div className="flex flex-wrap gap-2">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={busy}>
              {t("back")}
            </Button>
          ) : null}
          {step < 2 ? (
            <Button onClick={next} iconEnd="arrow-right">
              {t("next")}
            </Button>
          ) : (
            <Button iconStart="send" loading={busy} onClick={() => void send()}>
              {t("send")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
