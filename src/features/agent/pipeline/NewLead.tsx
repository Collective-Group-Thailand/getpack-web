"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { announceDraftsChanged, requestBackgroundSync, saveDraft } from "@/features/agent/drafts/drafts";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Kbd } from "@/ui/components/Kbd";
import { Sheet } from "@/ui/components/Sheet";
import { Spinner } from "@/ui/components/Spinner";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { fromLocalInput, quickFollowUp, toLocalInput, type QuickFollowUp } from "./dates";
import { toE164, toLocalPhone, toMoneyInput } from "./phone";
import { useProblemText } from "./problem";
import { useMinWidth } from "./useMinWidth";

type Scanned = Schemas["ScannedCardDto"];
type Availability = Schemas["AgentLeadAvailabilityDto"];
type FieldKey = "contactName" | "organisationName" | "phone" | "email" | "taxId" | "lineId";
/** Below this the scan's reading is shown as "check this" (the OCR's confidence, 0–1). */
const LOW_CONFIDENCE = 0.8;

const EMPTY = {
  contactName: "",
  organisationName: "",
  phone: "",
  email: "",
  taxId: "",
  lineId: "",
  industry: "",
  tags: "",
  expectedValue: "",
  nextFollowUpAt: "",
  note: "",
};

/**
 * A new lead (D-468, PROMPT P3 Web 2). One form, three ways in: the FAB above the phone's tab bar, the header button
 * from 640 px, and the N key on a desktop. A bottom sheet on a phone (thumb zone), a dialog from 640 px.
 *
 * - The phone, e-mail and tax id are checked when the agent leaves each field (`store.agentLeads.check`): an own lead
 *   links to it; anything else gets one neutral sentence — never who holds the contact (D-440).
 * - "สแกนนามบัตร" opens the rear camera, uploads the photo (purpose `agent_card_scan`, deleted after the retention
 *   days), reads it (`store.agentLeads.scanCard`) and fills the form; readings the OCR was unsure of are marked to
 *   check. Nothing is saved until the agent presses save (`source: card_scan`).
 * - Without a connection the lead is kept on this device and sent when the connection returns ("รอส่ง").
 */
export function NewLead({
  protectionDays,
  partnerPageUrl,
  fab = true,
}: {
  protectionDays: number;
  partnerPageUrl: string;
  fab?: boolean;
}) {
  const t = useTranslations("agentSales.newLead");
  const tCommon = useTranslations("common");
  const tProblems = useTranslations("problems");
  const problemText = useProblemText();
  const router = useRouter();
  const wide = useMinWidth(640);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY | "consent" | "contact", string>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Partial<Record<"phone" | "email" | "taxId", Availability>>>({});
  const [scan, setScan] = useState<{ state: "idle" | "reading" | "done" | "failed"; card?: Scanned; preview?: string }>(
    { state: "idle" },
  );
  const [confidence, setConfidence] = useState<Partial<Record<FieldKey, number>>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = useId();

  const reset = () => {
    setForm(EMPTY);
    setConsent(false);
    setErrors({});
    setProblem(null);
    setChecks({});
    setConfidence({});
    if (scan.preview) URL.revokeObjectURL(scan.preview);
    setScan({ state: "idle" });
  };

  const openForm = useCallback(() => setOpen(true), []);

  // N opens the form on a desktop, unless the agent is typing somewhere (PROMPT <responsive>: shortcut N).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      event.preventDefault();
      openForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openForm]);

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, contact: undefined }));
    if (field === "phone" || field === "email" || field === "taxId")
      setChecks((current) => ({ ...current, [field]: undefined }));
    if (field in confidence) setConfidence((current) => ({ ...current, [field]: undefined }));
  };

  /** The neutral duplicate check, on leaving the phone, e-mail or tax id field (offline: skipped). */
  const check = async (field: "phone" | "email" | "taxId") => {
    const raw = form[field].trim();
    if (!raw || !navigator.onLine) return;
    const value = field === "phone" ? toE164(raw) : field === "taxId" ? (/^\d{13}$/.test(raw) ? raw : null) : raw;
    if (!value || (field === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))) return;
    try {
      const { data } = await browserApi().POST("/v1/store/agent/leads/actions/check", { body: { [field]: value } });
      if (data) setChecks((current) => ({ ...current, [field]: data }));
    } catch {
      // The check is a courtesy; saving runs the same rule on the API.
    }
  };

  const readCard = async (file: File) => {
    if (scan.preview) URL.revokeObjectURL(scan.preview);
    setScan({ state: "reading", preview: URL.createObjectURL(file) });
    setProblem(null);
    try {
      const uploaded = await uploadFile("agent", file, "agent_card_scan");
      let card: Scanned | undefined;
      for (let attempt = 0; attempt < 4 && !card; attempt += 1) {
        try {
          card = (
            await browserApi().POST("/v1/store/agent/leads/actions/scan-card", {
              body: { fileId: uploaded.id, languages: ["tha", "eng"] },
            })
          ).data;
        } catch (error) {
          // The virus scan may still be running (`file.not_ready`): wait a moment and read again.
          if (isApiError(error) && error.code === "file.not_ready" && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
      if (!card) throw new Error("no card");
      const filled: Partial<typeof EMPTY> = {};
      const sure: Partial<Record<FieldKey, number>> = {};
      const take = (key: FieldKey, field: Schemas["ScannedFieldDto"] | null, map?: (value: string) => string) => {
        if (!field) return;
        filled[key] = map ? map(field.value) : field.value;
        sure[key] = field.confidence;
      };
      take("contactName", card.contactName);
      take("organisationName", card.organisationName);
      take("phone", card.phone, toLocalPhone);
      take("email", card.email);
      take("taxId", card.taxId);
      take("lineId", card.lineId);
      setForm((current) => ({ ...current, ...filled }));
      setConfidence(sure);
      setChecks({});
      setScan((current) => ({ ...current, state: "done", card }));
    } catch (error) {
      setScan((current) => ({ ...current, state: "failed" }));
      setProblem(isApiError(error) ? problemText(error) : t("scanFailed"));
    }
  };

  const bodyOf = (): Schemas["RegisterAgentLeadDto"] | null => {
    const next: typeof errors = {};
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    const email = form.email.trim() || null;
    const taxId = form.taxId.trim() || null;
    const expectedValue = form.expectedValue.trim() ? toMoneyInput(form.expectedValue) : null;
    if (form.contactName.trim().length < 2) next.contactName = t("errors.name");
    if (form.phone.trim() && !phone) next.phone = t("errors.phone");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = t("errors.email");
    if (taxId && !/^\d{13}$/.test(taxId)) next.taxId = t("errors.taxId");
    if (!phone && !email && !taxId) next.contact = t("errors.contact");
    if (form.expectedValue.trim() && !expectedValue) next.expectedValue = t("errors.amount");
    if (!consent) next.consent = t("errors.consent");
    setErrors(next);
    if (Object.values(next).some(Boolean)) return null;
    const tags = form.tags
      .split(/[,،]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10);
    return {
      kind: "customer",
      source: scan.state === "done" ? "card_scan" : "manual",
      contactName: form.contactName.trim(),
      organisationName: form.organisationName.trim() || null,
      phone,
      email,
      taxId,
      lineId: form.lineId.trim() || null,
      industry: form.industry.trim() || null,
      tags,
      expectedValue,
      nextFollowUpAt: form.nextFollowUpAt ? fromLocalInput(form.nextFollowUpAt) : null,
      note: form.note.trim() || null,
      consentConfirmed: true,
    };
  };

  const keepOffline = async (body: Schemas["RegisterAgentLeadDto"]) => {
    await saveDraft(body as unknown as Parameters<typeof saveDraft>[0]);
    announceDraftsChanged();
    void requestBackgroundSync();
    toast.success(t("savedOffline"));
    setOpen(false);
    reset();
  };

  const submit = async () => {
    setProblem(null);
    const body = bodyOf();
    if (!body) return;
    setBusy(true);
    try {
      if (!navigator.onLine) return await keepOffline(body);
      const { data } = await browserApi().POST("/v1/store/agent/leads", { body });
      toast.success(t("registered", { days: protectionDays }));
      setOpen(false);
      reset();
      if (data) router.push(`/leads/${data.id}`);
      else router.refresh();
    } catch (error) {
      if (!isApiError(error)) return await keepOffline(body);
      setProblem(problemText(error));
    } finally {
      setBusy(false);
    }
  };

  const unsure = (key: FieldKey) => confidence[key] !== undefined && confidence[key]! < LOW_CONFIDENCE;
  const scanned = (key: FieldKey) => confidence[key] !== undefined;
  const fieldHint = (key: FieldKey, hint?: string) =>
    unsure(key) ? t("checkReading") : scanned(key) ? t("fromCard") : hint;
  const ring = (key: FieldKey) => (unsure(key) ? "ring-warning/70 ring-2 ring-offset-1" : undefined);

  const availabilityNote = (field: "phone" | "email" | "taxId") => {
    const result = checks[field];
    if (!result || result.available) return null;
    return result.reason === "own_lead" ? (
      <Callout tone="info" title={t("ownLead")} live>
        {result.leadId ? (
          <Link href={`/leads/${result.leadId}`} className="text-link font-medium underline-offset-2 hover:underline">
            {t("openOwnLead")}
          </Link>
        ) : null}
      </Callout>
    ) : (
      <Callout tone="warning" title={tProblems("agents.lead_unavailable")} live>
        {t("unavailableHint")}
      </Callout>
    );
  };

  const followUpChoice = (choice: QuickFollowUp) => {
    setForm((current) => ({ ...current, nextFollowUpAt: toLocalInput(quickFollowUp(choice)) }));
  };

  const content = (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="bg-surface-subtle rounded-card flex items-center gap-3 p-3">
        {scan.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the photo just taken
          <img src={scan.preview} alt={t("cardPhoto")} className="border-border h-14 w-20 rounded-md border object-cover" />
        ) : (
          <span className="bg-surface text-primary grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="scan" size={22} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {scan.state === "done" ? t("scanDone") : scan.state === "reading" ? t("scanReading") : t("scanTitle")}
          </p>
          <p className="text-muted text-xs" role="status">
            {scan.state === "done" ? t("scanDoneHint") : t("scanHint")}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="card-scan-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readCard(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          iconStart={scan.state === "reading" ? undefined : "scan"}
          className="min-h-11 shrink-0"
          disabled={scan.state === "reading"}
          onClick={() => fileInput.current?.click()}
        >
          {scan.state === "reading" ? <Spinner size={16} label={t("scanReading")} /> : null}
          {scan.state === "done" ? t("scanAgain") : t("scan")}
        </Button>
      </div>

      <Field label={t("contactName")} required error={errors.contactName} hint={fieldHint("contactName")}>
        <Input
          value={form.contactName}
          onChange={set("contactName")}
          autoComplete="name"
          enterKeyHint="next"
          placeholder={t("contactNameExample")}
          className={ring("contactName")}
        />
      </Field>
      <Field label={t("organisation")} hint={fieldHint("organisationName")}>
        <Input
          value={form.organisationName}
          onChange={set("organisationName")}
          autoComplete="organization"
          enterKeyHint="next"
          className={ring("organisationName")}
        />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("contactLegend")}</legend>
        <p className="text-muted -mt-1 text-xs">{t("contactHint", { days: protectionDays })}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("phone")} error={errors.phone} hint={fieldHint("phone")}>
            <Input
              value={form.phone}
              onChange={set("phone")}
              onBlur={() => void check("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={t("phoneExample")}
              className={ring("phone")}
            />
          </Field>
          <Field label={t("email")} error={errors.email} hint={fieldHint("email")}>
            <Input
              value={form.email}
              onChange={set("email")}
              onBlur={() => void check("email")}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className={ring("email")}
            />
          </Field>
        </div>
        {availabilityNote("phone")}
        {availabilityNote("email")}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("lineId")} hint={fieldHint("lineId", t("lineIdHint"))}>
            <Input
              value={form.lineId}
              onChange={set("lineId")}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className={ring("lineId")}
            />
          </Field>
          <Field label={t("taxId")} error={errors.taxId} hint={fieldHint("taxId", t("taxIdHint"))}>
            <Input
              value={form.taxId}
              onChange={set("taxId")}
              onBlur={() => void check("taxId")}
              inputMode="numeric"
              autoComplete="off"
              maxLength={13}
              className={ring("taxId")}
            />
          </Field>
        </div>
        {availabilityNote("taxId")}
        {errors.contact ? <Callout tone="danger" title={errors.contact} live /> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("dealLegend")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("expectedValue")} error={errors.expectedValue} hint={t("expectedValueHint")}>
            <Input value={form.expectedValue} onChange={set("expectedValue")} inputMode="decimal" autoComplete="off" />
          </Field>
          <Field label={t("industry")}>
            <Input value={form.industry} onChange={set("industry")} placeholder={t("industryExample")} />
          </Field>
        </div>
        <Field label={t("followUp")} hint={t("followUpHint")}>
          <Input
            type="datetime-local"
            value={form.nextFollowUpAt}
            onChange={set("nextFollowUpAt")}
            className="min-h-11 sm:min-h-0"
          />
        </Field>
        <div className="-mt-1 flex flex-wrap gap-2">
          {(["tomorrow", "threeDays", "week"] as const).map((choice) => (
            <Button
              key={choice}
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 sm:min-h-8"
              onClick={() => followUpChoice(choice)}
            >
              {t(`quick.${choice}`)}
            </Button>
          ))}
        </div>
        <Field label={t("tags")} hint={t("tagsHint")}>
          <Input value={form.tags} onChange={set("tags")} />
        </Field>
        <Field label={t("note")}>
          <Textarea rows={2} value={form.note} onChange={set("note")} placeholder={t("noteExample")} />
        </Field>
      </fieldset>

      <div className={cn("flex flex-col gap-1", errors.consent && "text-danger-subtle-fg")}>
        <Checkbox
          label={t("consent")}
          checked={consent}
          onCheckedChange={(on) => {
            setConsent(on === true);
            setErrors((current) => ({ ...current, consent: undefined }));
          }}
        />
        {errors.consent ? (
          <p className="ms-7 text-xs" role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>
      {problem ? <Callout tone="danger" title={problem} live /> : null}
      <p className="text-muted text-xs">
        {t("partnerNote")}{" "}
        <a href={partnerPageUrl} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-2 hover:underline">
          {t("partnerLink")}
        </a>
      </p>
    </form>
  );

  const footer = (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy} className="max-sm:flex-1">
        {tCommon("actions.cancel")}
      </Button>
      <Button type="submit" form={formId} loading={busy} className="max-sm:flex-1">
        {t("save")}
      </Button>
    </>
  );

  const close = (next: boolean) => {
    if (busy) return;
    setOpen(next);
  };

  return (
    <>
      <Button iconStart="user-plus" onClick={openForm} className="max-sm:hidden">
        {t("open")}
        <Kbd className="ms-1 hidden lg:inline-flex" aria-hidden="true">
          {t("shortcutKey")}
        </Kbd>
      </Button>
      {fab ? (
        <Button
          iconStart="plus"
          size="lg"
          onClick={openForm}
          className="shadow-overlay z-sticky fixed end-[max(1rem,env(safe-area-inset-right))] bottom-[calc(var(--mobile-tab-h)+1rem)] sm:hidden"
          data-testid="new-lead-fab"
        >
          {t("open")}
        </Button>
      ) : null}
      {wide ? (
        <Dialog
          open={open}
          onOpenChange={close}
          size="lg"
          title={t("title")}
          description={t("intro", { days: protectionDays })}
          closeLabel={tCommon("actions.close")}
          footer={footer}
        >
          {content}
        </Dialog>
      ) : (
        <Sheet
          open={open}
          onOpenChange={close}
          side="bottom"
          title={t("title")}
          description={t("intro", { days: protectionDays })}
          closeLabel={tCommon("actions.close")}
          footer={footer}
          className="max-h-[92dvh]"
        >
          {content}
        </Sheet>
      )}
    </>
  );
}
