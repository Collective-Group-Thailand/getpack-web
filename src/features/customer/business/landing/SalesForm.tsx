"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

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
import { cn } from "@/ui/lib/cn";

const VOLUMES = ["under_1000", "1000_5000", "5000_20000", "over_20000"] as const;
const INTERESTS = ["credit", "branches", "contract", "design", "custom", "integration"] as const;

/**
 * The /business sales form (#sales, business pack Phase 1 item 7): a sales lead is a contact ticket with the topic
 * `business` and its details (company, volume bucket, interests), routed to the Sales queue by the API (D-458); the
 * reference is the API's `CS-…` (D-440). Success offers "เปิดบัญชีบริษัทระหว่างรอ".
 */
export function SalesForm({ applyHref }: { applyHref: string }) {
  const t = useTranslations("business.landing.sales");
  const format = useFormat();
  const form = useRef<HTMLFormElement>(null);
  const key = useRef(newKey());
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [volume, setVolume] = useState<(typeof VOLUMES)[number]>("under_1000");
  const [interests, setInterests] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!company.trim()) found.company = t("errors.company");
    if (!name.trim()) found.name = t("errors.contact");
    if (!email.trim() && !phone) found.email = t("errors.reach");
    if (email.trim() && !EMAIL.test(email.trim())) found.email = t("errors.email");
    if (phone && !PHONE.test(phone)) found.phone = t("errors.phone");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return focusFirstInvalid(form.current);
    if (trapped(form.current)) return;
    setBusy(true);
    try {
      const sent = await sendContact(
        {
          contact: {
            name: name.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(phone ? { phone } : {}),
          },
          topic: "business",
          message: message.trim() || t("summary", { volume: t(`volumes.${volume}`) }),
          details: { company: company.trim(), monthlyVolume: volume, interests },
          replyChannel: email.trim() ? "email" : "line",
        },
        key.current,
      );
      trackBusiness("biz_sales_submit", { volume });
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
      <div className="bg-surface border-border rounded-card flex flex-col gap-4 border p-5" role="status">
        <Callout tone="success" title={t("sentTitle", { ticket: ticket.ticketNo })}>
          {t("sent", { date: format.dateTime(ticket.respondBy) })}
        </Callout>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild iconEnd="arrow-right">
            <Link href={applyHref}>{t("applyWhile")}</Link>
          </Button>
          {ticket.lineUrl ? (
            <Button asChild variant="secondary" iconStart="chat">
              <a href={ticket.lineUrl} target="_blank" rel="noopener noreferrer">
                {t("openLine")}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    );

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-labelledby="sales-title"
      className="bg-surface border-border rounded-card relative grid gap-3.5 border p-5 sm:grid-cols-2"
    >
      <Honeypot />
      {failure ? (
        <Callout tone="danger" role="alert" className="sm:col-span-2">
          {failure}
        </Callout>
      ) : null}
      <Field label={t("company")} required requiredLabel={t("required")} error={errors.company}>
        <Input autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} />
      </Field>
      <Field label={t("contact")} required requiredLabel={t("required")} error={errors.name}>
        <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label={t("email")} hint={t("reachHint")} error={errors.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field label={t("phone")} error={errors.phone}>
        <PhoneInput value={phone} onChange={setPhone} />
      </Field>
      <Field label={t("volume")} className="sm:col-span-2">
        <SearchableSelect
          value={volume}
          onValueChange={setVolume}
          options={VOLUMES.map((value) => ({ value, label: t(`volumes.${value}`) }))}
        />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{t("interests")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((value) => {
            const on = interests.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setInterests((current) => (on ? current.filter((item) => item !== value) : [...current, value]))
                }
                className={cn(
                  "rounded-control border px-3 py-1.5 text-[13px] transition-colors",
                  on ? "border-primary bg-primary text-primary-fg" : "border-border-strong text-muted hover:text-fg",
                )}
              >
                {t(`interest.${value}`)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label={t("message")} className="sm:col-span-2">
        <Textarea
          rows={3}
          maxLength={3000}
          placeholder={t("messagePlaceholder")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
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
