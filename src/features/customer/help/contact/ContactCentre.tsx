"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { trackBusiness } from "@/lib/analytics/business";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { RadioChips, ToggleChips } from "./Chips";
import { Honeypot } from "./Honeypot";
import { INTENTS, type Intent } from "./intents";
import { EMAIL, focusFirstInvalid, newKey, PHONE, sendContact, trapped, type Ticket } from "./send";

const ICONS: Record<Intent, IconName> = {
  order: "package",
  quote: "document",
  artwork: "file-check",
  payment: "credit-card",
  delivery: "truck",
  business: "building",
  partnership: "factory",
  other: "chat",
};
/** 2–3 real answers per intent (copy only claims what the system does) and the self-serve links beside them. */
const ANSWERS: Record<Intent, { questions: string[]; links: { key: string; href: string; icon: IconName }[] }> = {
  order: {
    questions: ["status", "short", "lead"],
    links: [
      { key: "track", href: "#track", icon: "truck" },
      { key: "orders", href: "/account/orders", icon: "document" },
    ],
  },
  quote: {
    questions: ["how", "volume"],
    links: [
      { key: "products", href: "/products", icon: "calculator" },
      { key: "sales", href: "/business#sales", icon: "users" },
    ],
  },
  artwork: {
    questions: ["files", "proof"],
    links: [
      { key: "upload", href: "/studio/upload", icon: "upload" },
      { key: "studio", href: "/studio", icon: "pen-tool" },
    ],
  },
  payment: {
    questions: ["methods", "invoice", "overdue"],
    links: [
      { key: "orders", href: "/account/orders", icon: "document" },
      { key: "help", href: "/help", icon: "help" },
    ],
  },
  delivery: {
    questions: ["cost", "track"],
    links: [
      { key: "track", href: "#track", icon: "truck" },
      { key: "orders", href: "/account/orders", icon: "document" },
    ],
  },
  business: {
    questions: ["open", "credit"],
    links: [
      { key: "business", href: "/business", icon: "building" },
      { key: "apply", href: "/business/apply", icon: "arrow-right" },
    ],
  },
  partnership: {
    questions: ["what", "privacy"],
    links: [
      { key: "factory", href: "/partner-with-us", icon: "factory" },
      { key: "factoryApply", href: "/partner-with-us#apply", icon: "arrow-right" },
    ],
  },
  other: {
    questions: ["samples", "help"],
    links: [
      { key: "samples", href: "/samples", icon: "package-open" },
      { key: "help", href: "/help", icon: "help" },
      { key: "faq", href: "/faq", icon: "chat" },
    ],
  },
};
const VOLUMES = ["under_1000", "1000_5000", "5000_20000", "over_20000"] as const;
type Channel = Schemas["SupportReplyChannel"];

export interface ContactFacts {
  claimWindowDays: number | null;
  priceLockDays: number | null;
  /** The payment methods offered now, already worded. */
  methods: string[];
  issuer: string | null;
}

export interface ContactCentreProps {
  initialIntent: Intent;
  lineAvailable: boolean;
  options: Schemas["SupportContactOptionsDto"] | null;
  facts: ContactFacts;
  capabilities: { value: string; label: string }[];
  provinces: { value: string; label: string }[];
  /** The side column (LINE, channels, company), rendered on the server. */
  side: React.ReactNode;
}

/**
 * /contact's body (business pack Phase 2 items 2–4): 8 intent cards → the intent's common answers and self-serve
 * links, and a form whose fields follow the intent; common fields, reply channel (LINE / e-mail / call back with a
 * day of the next 5 business days and a window, both from the API). Submitting opens a contact ticket routed by
 * intent (D-458); the success panel shows the API's `CS-…` reference, the reply target and "คุยต่อทาง LINE".
 */
export function ContactCentre(props: ContactCentreProps) {
  const { initialIntent, lineAvailable, options, facts, capabilities, provinces, side } = props;
  const t = useTranslations("help.contact");
  const tSales = useTranslations("business.landing.sales");
  const locale = useLocale();
  const format = useFormat();
  const form = useRef<HTMLFormElement>(null);
  const key = useRef(newKey());
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [ticket, setTicket] = useState<(Ticket & { callbackText: string | null }) | null>(null);
  const [fields, setFields] = useState({
    name: "",
    phone: "",
    email: "",
    orderCode: "",
    product: "",
    quantity: "",
    insideSize: "",
    postcode: "",
    company: "",
    volume: "under_1000" as (typeof VOLUMES)[number],
    province: "",
    message: "",
  });
  const [caps, setCaps] = useState<string[]>([]);
  const channels: Channel[] = [
    ...(lineAvailable ? ["line" as const] : []),
    "email",
    ...(options?.callback ? ["callback" as const] : []),
  ];
  const [channel, setChannel] = useState<Channel>(channels[0]!);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (name: keyof typeof fields) => (value: string) => setFields((current) => ({ ...current, [name]: value }));
  const intentTitle = (value: Intent) => t(`intents.${value}.title`);
  const replyDays = options ? (options.replyBusinessDaysByTopic[intent] ?? options.replyBusinessDays) : null;
  const dayLabel = (value: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "th-TH", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(`${value}T12:00:00+07:00`));
  const methods = new Intl.ListFormat(locale === "en" ? "en" : "th", { type: "conjunction" }).format(facts.methods);

  function choose(next: Intent) {
    if (next === intent) return;
    setIntent(next);
    setErrors({});
    setFailure(null);
    trackBusiness("contact_intent", { intent: next });
  }

  function answer(question: string): string {
    const base = `answers.${intent}.${question}`;
    if (intent === "order" && question === "short")
      return facts.claimWindowDays ? t(`${base}.a`, { days: facts.claimWindowDays }) : t(`${base}.aNoDays`);
    if (intent === "quote" && question === "how")
      return facts.priceLockDays ? t(`${base}.a`, { days: facts.priceLockDays }) : t(`${base}.aNoDays`);
    if (intent === "payment" && question === "methods") return t(`${base}.a`, { methods });
    if (intent === "payment" && question === "invoice")
      return facts.issuer ? t(`${base}.a`, { issuer: facts.issuer }) : t(`${base}.aPlain`);
    return t(`${base}.a`);
  }
  const questions = ANSWERS[intent].questions.filter(
    (question) => !(intent === "payment" && question === "methods" && facts.methods.length === 0),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const phone = fields.phone;
    const email = fields.email.trim();
    if (!fields.name.trim()) found.name = t("errors.name");
    if (!phone && !email) found.phone = t("errors.reach");
    if (phone && !PHONE.test(phone)) found.phone = t("errors.phone");
    if (email && !EMAIL.test(email)) found.email = t("errors.email");
    if (fields.message.trim().length < 10) found.message = t("errors.message");
    if (intent === "order" && !fields.orderCode.trim()) found.orderCode = t("errors.orderCode");
    if (fields.quantity && !/^\d+$/.test(fields.quantity.trim())) found.quantity = t("errors.quantity");
    if (fields.postcode && !/^\d{5}$/.test(fields.postcode.trim())) found.postcode = t("errors.postcode");
    if ((intent === "partnership" || intent === "business") && !fields.company.trim())
      found.company = t("errors.company");
    if (channel === "callback") {
      if (!phone) found.phone = t("errors.callbackPhone");
      if (!day || !slot) found.callback = t("errors.callbackSlot");
    }
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return focusFirstInvalid(form.current);
    if (trapped(form.current)) return;
    setBusy(true);
    const details: Schemas["SupportContactDetailsDto"] = {
      ...(intent === "quote" && fields.product.trim() ? { product: fields.product.trim() } : {}),
      ...(intent === "quote" && fields.quantity.trim() ? { quantity: Number(fields.quantity.trim()) } : {}),
      ...(intent === "quote" && fields.insideSize.trim() ? { insideSize: fields.insideSize.trim() } : {}),
      ...(intent === "delivery" && fields.postcode.trim() ? { postcode: fields.postcode.trim() } : {}),
      ...(intent === "business" || intent === "partnership" ? { company: fields.company.trim() } : {}),
      ...(intent === "business" ? { monthlyVolume: fields.volume } : {}),
      ...(intent === "partnership" && caps.length > 0 ? { capabilities: caps } : {}),
      ...(intent === "partnership" && fields.province ? { province: fields.province } : {}),
    };
    try {
      const sent = await sendContact(
        {
          contact: { name: fields.name.trim(), ...(phone ? { phone } : {}), ...(email ? { email } : {}) },
          topic: intent,
          ...(fields.orderCode.trim() && ["order", "artwork", "payment", "delivery"].includes(intent)
            ? { orderCode: fields.orderCode.trim() }
            : {}),
          message: fields.message.trim(),
          ...(Object.keys(details).length > 0 ? { details } : {}),
          replyChannel: channel,
          ...(channel === "callback" && day && slot ? { callback: { date: day, slot } } : {}),
        },
        key.current,
      );
      trackBusiness("contact_submit", { intent, channel });
      const chosenSlot = options?.callback?.slots.find((candidate) => candidate.key === slot);
      setTicket({
        ...sent,
        callbackText:
          channel === "callback" && day && chosenSlot
            ? t("sentCallback", { day: dayLabel(day), slot: t("slot", { from: chosenSlot.from, to: chosenSlot.to }) })
            : null,
      });
      key.current = newKey();
    } catch (error) {
      key.current = newKey();
      setFailure(
        isApiError(error) && error.status === 429 ? t("rateLimited") : isApiError(error) ? error.detail : t("failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  const required = t("required");
  return (
    <>
      <section aria-labelledby="contact-intents" className="pt-7">
        <h2 id="contact-intents" className="sr-only">
          {t("intentsLabel")}
        </h2>
        <div role="radiogroup" aria-labelledby="contact-intents" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {INTENTS.map((value) => {
            const on = value === intent;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(value)}
                className={cn(
                  "rounded-card bg-surface flex min-h-[7.25rem] flex-col gap-1.5 border p-4 text-left transition-colors",
                  on
                    ? "border-primary bg-primary-subtle/50 ring-primary ring-1 ring-inset"
                    : "border-border hover:border-subtle",
                )}
              >
                <Icon name={ICONS[value]} size={22} aria-hidden="true" className="text-primary" />
                <b className="text-[15px] font-semibold">{intentTitle(value)}</b>
                <small className="text-subtle text-[12.5px]">{t(`intents.${value}.body`)}</small>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23.75rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <section
            aria-labelledby="contact-answers"
            className="border-border bg-surface rounded-panel flex flex-col gap-3.5 border p-5.5"
          >
            <h3 id="contact-answers" className="text-lg font-semibold">
              {t("answersTitle", { intent: intentTitle(intent) })}
            </h3>
            <div>
              {questions.map((question) => (
                <details
                  key={`${intent}.${question}`}
                  className="border-border group border-b"
                  onToggle={(event) => {
                    if ((event.currentTarget as HTMLDetailsElement).open)
                      trackBusiness("contact_answer_open", { q: `${intent}.${question}` });
                  }}
                >
                  <summary className="focus-visible:ring-focus-ring flex cursor-pointer list-none items-start justify-between gap-3 py-3 text-[14.5px] font-semibold outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                    {t(`answers.${intent}.${question}.q`)}
                    <Icon
                      name="chevron-down"
                      size={16}
                      aria-hidden="true"
                      className="text-subtle mt-1 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="text-muted mb-3 text-sm">{answer(question)}</p>
                </details>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ANSWERS[intent].links.map((link) =>
                link.href.startsWith("#") ? (
                  <a
                    key={link.key}
                    href={link.href}
                    className="bg-bg-subtle hover:bg-primary-subtle hover:text-primary rounded-control inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold"
                  >
                    <Icon name={link.icon} size={16} aria-hidden="true" />
                    {t(`links.${link.key}`)}
                  </a>
                ) : (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="bg-bg-subtle hover:bg-primary-subtle hover:text-primary rounded-control inline-flex h-10 items-center gap-2 px-3.5 text-sm font-semibold"
                  >
                    <Icon name={link.icon} size={16} aria-hidden="true" />
                    {t(`links.${link.key}`)}
                  </Link>
                ),
              )}
            </div>
          </section>

          <section aria-labelledby="contact-form" className="border-border bg-surface rounded-panel border p-5.5">
            <h3 id="contact-form" className="mb-4 text-lg font-semibold">
              {t("formTitle", { intent: intentTitle(intent) })}
            </h3>
            {ticket ? (
              <div role="status" className="flex flex-col gap-3.5">
                <Callout tone="success" title={t("sentTitle", { ticket: ticket.ticketNo })}>
                  <span className="block">{t("sentTopic", { topic: intentTitle(intent) })}</span>
                  <span className="block">
                    {ticket.callbackText ?? t("sent", { date: format.dateTime(ticket.respondBy) })}
                  </span>
                  <span className="block">{t("keepRef")}</span>
                </Callout>
                <div className="flex flex-wrap gap-2.5">
                  {ticket.lineUrl ? (
                    <Button asChild iconStart="chat">
                      <a href={ticket.lineUrl} target="_blank" rel="noopener noreferrer">
                        {t("openLine")}
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => setTicket(null)}>
                    {t("another")}
                  </Button>
                </div>
              </div>
            ) : (
              <form
                ref={form}
                noValidate
                onSubmit={(event) => void submit(event)}
                className="relative flex flex-col gap-4"
              >
                <Honeypot />
                {failure ? (
                  <Callout tone="danger" role="alert">
                    {failure}
                  </Callout>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("name")} required requiredLabel={required} error={errors.name}>
                    <Input
                      autoComplete="name"
                      value={fields.name}
                      onChange={(event) => set("name")(event.target.value)}
                    />
                  </Field>
                  {intent === "order" ? (
                    <Field
                      label={t("orderCode")}
                      hint={t("orderCodeHint")}
                      required
                      requiredLabel={required}
                      error={errors.orderCode}
                    >
                      <Input
                        value={fields.orderCode}
                        placeholder={t("orderCodePlaceholder")}
                        className="tabular-nums"
                        onChange={(event) => set("orderCode")(event.target.value)}
                      />
                    </Field>
                  ) : ["artwork", "payment", "delivery"].includes(intent) ? (
                    <Field label={t("orderCodeOptional")} hint={t("orderCodeHint")}>
                      <Input
                        value={fields.orderCode}
                        placeholder={t("orderCodePlaceholder")}
                        className="tabular-nums"
                        onChange={(event) => set("orderCode")(event.target.value)}
                      />
                    </Field>
                  ) : intent === "business" || intent === "partnership" ? (
                    <Field
                      label={intent === "partnership" ? t("factoryName") : t("company")}
                      required
                      requiredLabel={required}
                      error={errors.company}
                    >
                      <Input
                        autoComplete="organization"
                        value={fields.company}
                        onChange={(event) => set("company")(event.target.value)}
                      />
                    </Field>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <Field
                    label={t("phone")}
                    hint={channel === "callback" ? t("callbackPhone") : t("reachHint")}
                    error={errors.phone}
                  >
                    <PhoneInput value={fields.phone} onChange={set("phone")} />
                  </Field>
                  <Field label={t("email")} error={errors.email}>
                    <Input
                      type="email"
                      autoComplete="email"
                      value={fields.email}
                      onChange={(event) => set("email")(event.target.value)}
                    />
                  </Field>
                  {intent === "quote" ? (
                    <>
                      <Field label={t("product")}>
                        <Input
                          value={fields.product}
                          placeholder={t("productPlaceholder")}
                          onChange={(event) => set("product")(event.target.value)}
                        />
                      </Field>
                      <Field label={t("quantity")} error={errors.quantity}>
                        <Input
                          inputMode="numeric"
                          value={fields.quantity}
                          className="tabular-nums"
                          onChange={(event) => set("quantity")(event.target.value)}
                        />
                      </Field>
                      <Field label={t("insideSize")} className="sm:col-span-2">
                        <Input
                          value={fields.insideSize}
                          placeholder={t("insideSizePlaceholder")}
                          className="tabular-nums"
                          onChange={(event) => set("insideSize")(event.target.value)}
                        />
                      </Field>
                    </>
                  ) : null}
                  {intent === "delivery" ? (
                    <Field label={t("postcode")} error={errors.postcode}>
                      <Input
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={5}
                        value={fields.postcode}
                        className="tabular-nums"
                        onChange={(event) => set("postcode")(event.target.value)}
                      />
                    </Field>
                  ) : null}
                  {intent === "business" ? (
                    <Field label={t("volume")}>
                      <NativeSelect
                        value={fields.volume}
                        onValueChange={(value) => setFields((current) => ({ ...current, volume: value }))}
                        options={VOLUMES.map((value) => ({ value, label: tSales(`volumes.${value}`) }))}
                      />
                    </Field>
                  ) : null}
                  {intent === "partnership" && provinces.length > 0 ? (
                    <Field label={t("province")}>
                      <NativeSelect
                        value={fields.province}
                        onValueChange={set("province")}
                        options={[{ value: "", label: t("provincePlaceholder") }, ...provinces]}
                      />
                    </Field>
                  ) : null}
                </div>
                {intent === "partnership" ? (
                  <div className="flex flex-col gap-2">
                    {capabilities.length > 0 ? (
                      <>
                        <span className="text-sm font-medium">{t("capabilities")}</span>
                        <ToggleChips
                          label={t("capabilities")}
                          values={caps}
                          options={capabilities}
                          onChange={setCaps}
                        />
                      </>
                    ) : null}
                    <Link
                      href="/partner-with-us#apply"
                      className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {t("partnerDeep")} →
                    </Link>
                  </div>
                ) : null}
                {intent === "quote" || intent === "artwork" ? (
                  <p className="text-subtle inline-flex items-start gap-2 text-[13px]">
                    <Icon name="paperclip" size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                    {t("attachHint")}
                  </p>
                ) : null}
                <Field label={t("message")} required requiredLabel={required} error={errors.message}>
                  <Textarea
                    rows={4}
                    maxLength={3000}
                    placeholder={t("messagePlaceholder")}
                    value={fields.message}
                    onChange={(event) => set("message")(event.target.value)}
                  />
                </Field>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("replyVia")}</span>
                  <RadioChips
                    label={t("replyVia")}
                    value={channel}
                    options={channels.map((value) => ({ value, label: t(`reply.${value}`) }))}
                    onChange={setChannel}
                  />
                </div>
                {channel === "callback" && options?.callback ? (
                  <div className="bg-bg-subtle rounded-card flex flex-col gap-3 p-3.5">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("callbackDay")}</span>
                      <RadioChips
                        label={t("callbackDay")}
                        value={day}
                        options={options.callback.days.map((value) => ({ value, label: dayLabel(value) }))}
                        onChange={setDay}
                        invalid={Boolean(errors.callback) && !day}
                        describedBy={errors.callback ? "callback-error" : undefined}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">{t("callbackSlot")}</span>
                      <RadioChips
                        label={t("callbackSlot")}
                        value={slot}
                        options={options.callback.slots.map((value) => ({
                          value: value.key,
                          label: <span className="tabular-nums">{t("slot", { from: value.from, to: value.to })}</span>,
                        }))}
                        onChange={setSlot}
                        invalid={Boolean(errors.callback) && Boolean(day) && !slot}
                        describedBy={errors.callback ? "callback-error" : undefined}
                      />
                    </div>
                    {errors.callback ? (
                      <p id="callback-error" className="text-danger-subtle-fg text-xs">
                        {errors.callback}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-subtle text-xs">
                    {replyDays !== null ? <>{t("replyTime", { days: replyDays })} · </> : null}
                    {t("pdpa")}{" "}
                    <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
                      {t("privacy")}
                    </Link>
                  </p>
                  <Button type="submit" loading={busy}>
                    {t("submit")}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-3.5">{side}</aside>
      </div>
    </>
  );
}
