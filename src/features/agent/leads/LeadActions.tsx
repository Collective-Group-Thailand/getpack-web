"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * Registering a prospect (D-417, D-464): a customer with a phone, e-mail or tax id, who agreed to be
 * contacted. Agents register customers only (P-03) — a short note sends manufacturers to the storefront's
 * /partner-with-us (D-464). On a phone the button floats above the tab bar; from a tablet up it sits in the header.
 */
export function RegisterLead({
  protectionDays,
  partnerPageUrl,
  fab = false,
}: {
  protectionDays: number;
  /** The storefront's page for manufacturers (D-464: agents register customers only). */
  partnerPageUrl: string;
  /** Also a floating button above the phone's tab bar (PROMPT <responsive>: the page's primary action). */
  fab?: boolean;
}) {
  const t = useTranslations("agent.leads");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contactName: "",
    organisationName: "",
    phone: "",
    email: "",
    taxId: "",
    note: "",
  });
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const phone = form.phone.replace(/[^0-9]/g, "");
  const e164 = /^0\d{8,9}$/.test(phone) ? `+66${phone.slice(1)}` : null;

  const send = async () => {
    setProblem(null);
    if (form.contactName.trim().length < 2) return setProblem(t("errors.name"));
    if (form.phone && !e164) return setProblem(t("errors.phone"));
    if (form.taxId && !/^\d{13}$/.test(form.taxId)) return setProblem(t("errors.taxId"));
    if (!e164 && !form.email.trim() && !form.taxId) return setProblem(t("errors.contact"));
    if (!consent) return setProblem(t("errors.consent"));
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/leads", {
        body: {
          kind: "customer",
          contactName: form.contactName.trim(),
          organisationName: form.organisationName.trim() || null,
          phone: e164,
          email: form.email.trim() || null,
          taxId: form.taxId || null,
          note: form.note.trim() || null,
          consentConfirmed: consent,
          source: "manual",
        },
      });
      toast.success(t("registered", { days: protectionDays }));
      setOpen(false);
      setForm({ contactName: "", organisationName: "", phone: "", email: "", taxId: "", note: "" });
      setConsent(false);
      router.refresh();
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button iconStart="user-plus" onClick={() => setOpen(true)} className={fab ? "max-sm:hidden" : undefined}>
        {t("register")}
      </Button>
      {fab ? (
        <Button
          iconStart="plus"
          size="lg"
          onClick={() => setOpen(true)}
          className="shadow-overlay z-sticky fixed end-[max(1rem,env(safe-area-inset-right))] bottom-[calc(var(--mobile-tab-h)+1rem)] sm:hidden"
        >
          {t("register")}
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(next) => !next && !busy && setOpen(false)}
        title={t("registerTitle")}
        description={t("registerBody", { days: protectionDays })}
        closeLabel={tCommon("actions.close")}
        footer={
          <Button loading={busy} onClick={() => void send()}>
            {t("register")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t("contactName")} required>
            <Input value={form.contactName} onChange={set("contactName")} placeholder={t("contactNameExample")} />
          </Field>
          <Field label={t("organisation")}>
            <Input value={form.organisationName} onChange={set("organisationName")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("phone")}>
              <Input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder={t("phoneExample")} />
            </Field>
            <Field label={t("email")}>
              <Input value={form.email} onChange={set("email")} type="email" />
            </Field>
          </div>
          <Field label={t("taxId")} hint={t("taxIdHint")}>
            <Input value={form.taxId} onChange={set("taxId")} inputMode="numeric" maxLength={13} />
          </Field>
          <Field label={t("note")}>
            <Textarea rows={2} value={form.note} onChange={set("note")} placeholder={t("noteExample")} />
          </Field>
          <Checkbox label={t("consent")} checked={consent} onCheckedChange={(on) => setConsent(on === true)} />
          {problem ? <Callout tone="danger" title={problem} /> : null}
          <p className="text-muted text-xs">
            {t("partnerNote")}{" "}
            <a
              href={partnerPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline-offset-2 hover:underline"
            >
              {t("partnerLink")}
            </a>
          </p>
        </div>
      </Dialog>
    </>
  );
}

/** Withdraws a protected lead (`store.agent.withdrawLead`). */
export function WithdrawLead({ leadId, name }: { leadId: string; name: string }) {
  const t = useTranslations("agent.leads");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await browserApi().POST("/v1/store/agent/leads/{leadId}/actions/withdraw", { params: { path: { leadId } } });
          router.refresh();
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
          setBusy(false);
        }
      }}
    >
      {t("withdraw")}
      <span className="sr-only"> {name}</span>
    </Button>
  );
}
