"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ToggleChips } from "@/features/customer/help/contact/Chips";
import { Honeypot } from "@/features/customer/help/contact/Honeypot";
import {
  EMAIL,
  focusFirstInvalid,
  newKey,
  PHONE,
  sendContact,
  trapped,
  type Ticket,
} from "@/features/customer/help/contact/send";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackBusiness } from "@/lib/analytics/business";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { PhoneInput } from "@/ui/components/PhoneInput";

const SYSTEMS = ["spreadsheet", "accounting", "erp", "none"] as const;

/**
 * The partner-factory application (pack Phase 3 item 8): factory name, contact, mobile, province, capabilities (the
 * catalogue's product types — real values, not a hand-made list), current system → a contact ticket with the topic
 * `partnership` and those details, routed to the Partner team (D-458; reference `CS-…`, D-440).
 */
export function FactoryApplyForm({
  capabilities,
  provinces,
}: {
  capabilities: { value: string; label: string }[];
  provinces: { value: string; label: string }[];
}) {
  const t = useTranslations("pages.partner.applySection");
  const format = useFormat();
  const form = useRef<HTMLFormElement>(null);
  const key = useRef(newKey());
  const [factory, setFactory] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [system, setSystem] = useState<(typeof SYSTEMS)[number]>("spreadsheet");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!factory.trim()) found.factory = t("errors.factory");
    if (!contact.trim()) found.contact = t("errors.contact");
    if (!PHONE.test(phone)) found.phone = t("errors.phone");
    if (email.trim() && !EMAIL.test(email.trim())) found.email = t("errors.email");
    if (provinces.length > 0 && !province) found.province = t("errors.province");
    if (capabilities.length > 0 && caps.length === 0) found.capabilities = t("errors.capabilities");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return focusFirstInvalid(form.current);
    if (trapped(form.current)) return;
    setBusy(true);
    try {
      const provinceName = provinces.find((candidate) => candidate.value === province)?.label;
      const sent = await sendContact(
        {
          contact: { name: contact.trim(), phone, ...(email.trim() ? { email: email.trim() } : {}) },
          topic: "partnership",
          message: message.trim() || t("summary", { factory: factory.trim() }),
          details: {
            company: factory.trim(),
            ...(provinceName ? { province: provinceName } : {}),
            ...(caps.length > 0 ? { capabilities: caps } : {}),
            currentSystem: system,
          },
          replyChannel: email.trim() ? "email" : "line",
        },
        key.current,
      );
      trackBusiness("fx_apply_submit", { capabilities: caps.length });
      setTicket(sent);
    } catch (error) {
      key.current = newKey();
      setFailure(
        isApiError(error) && error.status === 429 ? t("rateLimited") : isApiError(error) ? error.detail : t("failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (ticket)
    return (
      <div role="status" className="bg-surface border-border rounded-card flex flex-col gap-3.5 border p-5">
        <Callout tone="success" title={t("sentTitle", { ticket: ticket.ticketNo })}>
          <span className="block">{t("sent", { date: format.dateTime(ticket.respondBy) })}</span>
          <span className="block">{t("next")}</span>
        </Callout>
        {ticket.lineUrl ? (
          <Button asChild variant="secondary" iconStart="chat" className="self-start">
            <a href={ticket.lineUrl} target="_blank" rel="noopener noreferrer">
              {t("openLine")}
            </a>
          </Button>
        ) : null}
      </div>
    );

  const required = t("required");
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-labelledby="factory-apply-title"
      className="bg-surface border-border rounded-card relative grid gap-3.5 border p-5 sm:grid-cols-2"
    >
      <Honeypot />
      {failure ? (
        <Callout tone="danger" role="alert" className="sm:col-span-2">
          {failure}
        </Callout>
      ) : null}
      <Field label={t("factory")} required requiredLabel={required} error={errors.factory}>
        <Input autoComplete="organization" value={factory} onChange={(event) => setFactory(event.target.value)} />
      </Field>
      <Field label={t("contact")} required requiredLabel={required} error={errors.contact}>
        <Input autoComplete="name" value={contact} onChange={(event) => setContact(event.target.value)} />
      </Field>
      <Field label={t("phone")} required requiredLabel={required} error={errors.phone}>
        <PhoneInput value={phone} onChange={setPhone} />
      </Field>
      {provinces.length > 0 ? (
        <Field label={t("province")} required requiredLabel={required} error={errors.province}>
          <SearchableSelect
            value={province}
            onValueChange={setProvince}
            options={[{ value: "", label: t("provincePlaceholder") }, ...provinces]}
          />
        </Field>
      ) : null}
      <Field label={t("email")} error={errors.email} className={provinces.length > 0 ? "sm:col-span-2" : undefined}>
        <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      {capabilities.length > 0 ? (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span id="factory-caps" className="text-sm font-medium">
            {t("capabilities")} <span className="text-muted font-normal">· {t("capabilitiesHint")}</span>
          </span>
          <ToggleChips
            label={t("capabilities")}
            values={caps}
            options={capabilities}
            onChange={setCaps}
            invalid={Boolean(errors.capabilities)}
            describedBy={errors.capabilities ? "factory-caps-error" : undefined}
          />
          {errors.capabilities ? (
            <p id="factory-caps-error" className="text-danger-subtle-fg text-xs">
              {errors.capabilities}
            </p>
          ) : null}
        </div>
      ) : null}
      <Field label={t("system")} className="sm:col-span-2">
        <SearchableSelect
          value={system}
          onValueChange={setSystem}
          options={SYSTEMS.map((value) => ({ value, label: t(`systems.${value}`) }))}
        />
      </Field>
      <Field label={t("message")} className="sm:col-span-2">
        <Textarea rows={3} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} />
      </Field>
      <Button type="submit" size="lg" block loading={busy} className="sm:col-span-2">
        {t("submit")}
      </Button>
      <p className="text-muted text-xs sm:col-span-2">
        {t("pdpa")}{" "}
        <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
          {t("privacy")}
        </Link>
      </p>
    </form>
  );
}
