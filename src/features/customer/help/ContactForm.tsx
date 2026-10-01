"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Select } from "@/ui/components/Select";

type Ticket = Schemas["SupportTicketDto"];
/** The storefront's topic keys; the API takes any `snake_case` key (`SupportContactDto.topic`). */
const TOPICS = ["order", "quote", "artwork", "payment", "delivery", "business", "partnership", "other"] as const;
type Topic = (typeof TOPICS)[number];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * A message to the team (F3 3.7, `store.support.contact`, D-221). Phone or e-mail, at least one;
 * a 429 says how long to wait rather than failing silently. The ticket number comes back to quote
 * later, with the first-response target the API sets and, once LINE is set up, a LINE link
 * carrying only the ticket number.
 */
export function ContactForm({ defaultTopic }: { defaultTopic?: Topic }) {
  const t = useTranslations("help.contact");
  const format = useFormat();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>(defaultTopic ?? "order");
  const [orderCode, setOrderCode] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("errors.name");
    if (!phone && !email.trim()) found.phone = t("errors.reach");
    if (phone && !/^0\d{8,9}$/.test(phone)) found.phone = t("errors.phone");
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) found.email = t("errors.email");
    if (message.trim().length < 10) found.message = t("errors.message");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/store/support/actions/contact", {
        params: { header: { "Idempotency-Key": key.current } },
        body: {
          contact: {
            name: name.trim(),
            ...(phone ? { phone } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
          },
          topic,
          ...(orderCode.trim() ? { orderCode: orderCode.trim() } : {}),
          message: message.trim(),
        },
      });
      setTicket(data!);
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
      <Callout tone="success" title={t("sentTitle", { ticket: ticket.ticketNo })} role="status">
        {t("sent", { date: format.dateTime(ticket.respondBy) })}
        {ticket.lineUrl ? (
          <a
            href={ticket.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block underline underline-offset-4"
          >
            {t("openLine")}
          </a>
        ) : null}
      </Callout>
    );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}
      <Field label={t("name")} required requiredLabel={t("required")} error={errors.name}>
        <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("phone")} hint={t("reachHint")} error={errors.phone}>
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label={t("email")} error={errors.email}>
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("topic")}>
          <Select
            value={topic}
            onValueChange={setTopic}
            options={TOPICS.map((value) => ({ value, label: t(`topics.${value}`) }))}
          />
        </Field>
        <Field label={t("orderCode")} hint={t("orderCodeHint")}>
          <Input value={orderCode} onChange={(event) => setOrderCode(event.target.value)} />
        </Field>
      </div>
      <Field label={t("message")} required requiredLabel={t("required")} error={errors.message}>
        <Textarea rows={5} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} />
      </Field>
      <Button type="submit" className="self-start" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
