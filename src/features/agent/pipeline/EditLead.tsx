"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { toE164, toLocalPhone, toMoneyInput } from "./phone";
import { useProblemText } from "./problem";

type Lead = Schemas["AgentLeadDto"];

/**
 * Editing a lead (`store.agentLeads.update`, If-Match). The contact keys (phone, e-mail, tax id) can change only while
 * the lead is protected and go through the same neutral check; once it is a customer they are read-only here.
 */
export function EditLead({ lead, etag }: { lead: Lead; etag: string | null }) {
  const t = useTranslations("agentSales.edit");
  const tNew = useTranslations("agentSales.newLead");
  const tCommon = useTranslations("common");
  const problemText = useProblemText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keysEditable = lead.status === "registered";
  const initial = {
    contactName: lead.contactName,
    organisationName: lead.organisationName ?? "",
    phone: toLocalPhone(lead.phone),
    email: lead.email ?? "",
    taxId: lead.taxId ?? "",
    lineId: lead.lineId ?? "",
    industry: lead.industry ?? "",
    tags: lead.tags.join(", "),
    expectedValue: lead.expectedValue ?? "",
    note: lead.note ?? "",
  };
  const [form, setForm] = useState(initial);
  const set = (field: keyof typeof initial) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const save = async () => {
    setError(null);
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    if (form.contactName.trim().length < 2) return setError(tNew("errors.name"));
    if (form.phone.trim() && !phone) return setError(tNew("errors.phone"));
    if (form.taxId.trim() && !/^\d{13}$/.test(form.taxId.trim())) return setError(tNew("errors.taxId"));
    const expectedValue = form.expectedValue.trim() ? toMoneyInput(form.expectedValue) : null;
    if (form.expectedValue.trim() && !expectedValue) return setError(tNew("errors.amount"));
    const body: Schemas["UpdateAgentLeadDto"] = {
      contactName: form.contactName.trim(),
      organisationName: form.organisationName.trim() || null,
      lineId: form.lineId.trim() || null,
      industry: form.industry.trim() || null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
      expectedValue,
      note: form.note.trim() || null,
    };
    if (keysEditable) {
      if (phone !== lead.phone) body.phone = phone;
      if ((form.email.trim() || null) !== lead.email) body.email = form.email.trim() || null;
      if ((form.taxId.trim() || null) !== lead.taxId) body.taxId = form.taxId.trim() || null;
    }
    setBusy(true);
    try {
      await browserApi().PATCH("/v1/store/agent/leads/{leadId}", {
        params: { path: { leadId: lead.id }, header: { "If-Match": etag ?? "" } },
        body,
      });
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(isApiError(failure) && failure.isStale ? t("stale") : problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" iconStart="edit" className="min-h-11 sm:min-h-8" onClick={() => { setForm(initial); setOpen(true); }}>
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !busy && setOpen(next)}
        size="lg"
        title={t("title")}
        closeLabel={tCommon("actions.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {tCommon("actions.cancel")}
            </Button>
            <Button loading={busy} onClick={() => void save()}>
              {tCommon("actions.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={tNew("contactName")} required>
            <Input value={form.contactName} onChange={set("contactName")} autoComplete="name" />
          </Field>
          <Field label={tNew("organisation")}>
            <Input value={form.organisationName} onChange={set("organisationName")} autoComplete="organization" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tNew("phone")} hint={keysEditable ? undefined : t("keysLocked")}>
              <Input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel-national" disabled={!keysEditable} />
            </Field>
            <Field label={tNew("email")} hint={keysEditable ? undefined : t("keysLocked")}>
              <Input value={form.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" disabled={!keysEditable} />
            </Field>
            <Field label={tNew("lineId")}>
              <Input value={form.lineId} onChange={set("lineId")} autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label={tNew("taxId")} hint={keysEditable ? undefined : t("keysLocked")}>
              <Input value={form.taxId} onChange={set("taxId")} inputMode="numeric" maxLength={13} disabled={!keysEditable} />
            </Field>
            <Field label={tNew("expectedValue")}>
              <Input value={form.expectedValue} onChange={set("expectedValue")} inputMode="decimal" />
            </Field>
            <Field label={tNew("industry")}>
              <Input value={form.industry} onChange={set("industry")} />
            </Field>
          </div>
          <Field label={tNew("tags")} hint={tNew("tagsHint")}>
            <Input value={form.tags} onChange={set("tags")} />
          </Field>
          <Field label={tNew("note")}>
            <Textarea rows={3} value={form.note} onChange={set("note")} />
          </Field>
          {error ? <Callout tone="danger" title={error} live /> : null}
        </div>
      </Dialog>
    </>
  );
}
