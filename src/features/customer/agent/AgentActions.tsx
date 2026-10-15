"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

const TABS = [
  { key: "home", href: "/account/agent" },
  { key: "customers", href: "/account/agent/customers" },
  { key: "leads", href: "/account/agent/leads" },
  { key: "commissions", href: "/account/agent/commissions" },
  { key: "statements", href: "/account/agent/statements" },
] as const;

/** The agent pages' sections, as tabs under the account frame. */
export function AgentNav() {
  const t = useTranslations("agent.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="border-border -mx-1 flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const current = tab.key === "home" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              current ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Withdraws my open application (`store.agent.withdrawApplication`). */
export function WithdrawApplication() {
  const t = useTranslations("agent.application");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await browserApi().POST("/v1/store/agent/application/actions/withdraw");
          router.refresh();
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
          setBusy(false);
        }
      }}
    >
      {t("withdraw")}
    </Button>
  );
}

type LeadKind = Schemas["AgentLeadKind"];

/**
 * Registering a prospect (D-417, D-419): a customer or a factory with a phone, e-mail or tax id, who
 * agreed to be contacted. Refusals say why — already a customer, already another agent's.
 */
export function RegisterLead({ protectionDays }: { protectionDays: number }) {
  const t = useTranslations("agent.leads");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LeadKind>("customer");
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
          kind,
          contactName: form.contactName.trim(),
          organisationName: form.organisationName.trim() || null,
          phone: e164,
          email: form.email.trim() || null,
          taxId: form.taxId || null,
          note: form.note.trim() || null,
          consentConfirmed: consent,
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
      <Button iconStart="user-plus" onClick={() => setOpen(true)}>
        {t("register")}
      </Button>
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
          <SegmentedControl
            label={t("kind")}
            value={kind}
            onValueChange={(value) => setKind(value as LeadKind)}
            options={(["customer", "factory"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
          <Field label={t("contactName")} required>
            <Input value={form.contactName} onChange={set("contactName")} placeholder={t("contactNameExample")} />
          </Field>
          <Field label={kind === "factory" ? t("factoryName") : t("organisation")}>
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

/** Opens the 50 ทวิ of a paid statement in a new tab (a short-lived link). */
export function CertificateButton({ statementId }: { statementId: string }) {
  const t = useTranslations("agent.statements");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="download"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { data } = await browserApi().GET("/v1/store/agent/statements/{statementId}/wht-certificate", {
            params: { path: { statementId } },
          });
          if (data) window.open(data.url, "_blank", "noopener");
        } catch (error) {
          toast.error(isApiError(error) ? error.detail : t("failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("certificate")}
    </Button>
  );
}
