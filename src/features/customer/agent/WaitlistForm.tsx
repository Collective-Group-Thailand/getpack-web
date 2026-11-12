"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { isThaiMobile, normaliseThaiMobile, PhoneInput } from "@/ui/components/PhoneInput";
import { Icon } from "@/ui/icons";

type Consent = Schemas["AgentWaitlistConsentDto"];
type Channel = Schemas["AgentSalesChannel"];

const CHANNELS: Channel[] = [
  "line_groups",
  "facebook",
  "own_network",
  "agency",
  "print_shop",
  "design_studio",
  "other",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An account's phone (E.164 `+66…` or local) as the digits the field holds. */
function localPhone(phone: string): string {
  return phone.startsWith("+66") ? `0${phone.slice(3)}` : normaliseThaiMobile(phone);
}

/** `812345678` (typed without its zero) → `0812345678`: the API takes 0XXXXXXXXX or E.164. */
function apiPhone(digits: string): string {
  return digits.length === 9 ? `0${digits}` : digits;
}

/**
 * The waiting list for the agent programme (P7 pilot switch, `store.agentProgramme.joinWaitlist`): a name, a phone or
 * an e-mail, how they sell (optional) and the consent text the API publishes, accepted with its version. Every
 * accepted submission gets the same neutral thanks — the API answers the same whether the contact was listed already,
 * and so does this form. Anonymous: the customer BFF forwards the visitor's address for the API's per-address limit.
 */
export function WaitlistForm({
  consent,
  defaults,
}: {
  consent: Consent;
  /** A signed-in customer's own details, to start from (they can change them). */
  defaults?: { name: string; email: string | null; phone: string | null };
}) {
  const t = useTranslations("agent.waitlist");
  const tChannels = useTranslations("agent.apply.channelOptions");
  const locale = useLocale();
  const router = useRouter();
  const consentId = useId();
  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ? localPhone(defaults.phone) : "");
  const [email, setEmail] = useState(defaults?.email ?? "");
  const [channel, setChannel] = useState<Channel | "">("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const text = locale === "en" ? consent.textEn : consent.textTh;
  const summary = locale === "en" ? (consent.summaryEn ?? consent.summaryTh) : consent.summaryTh;

  function check(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("errors.name");
    const hasPhone = phone !== "";
    const hasEmail = email.trim() !== "";
    if (!hasPhone && !hasEmail) found.contact = t("errors.contact");
    if (hasPhone && !isThaiMobile(phone)) found.phone = t("errors.phone");
    if (hasEmail && !EMAIL.test(email.trim())) found.email = t("errors.email");
    if (!accepted) found.consent = t("errors.consent");
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) {
      document.getElementById("waitlist-errors")?.focus();
      return;
    }
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/programme/waitlist", {
        body: {
          name: name.trim(),
          phone: phone ? apiPhone(phone) : null,
          email: email.trim() || null,
          salesChannel: channel || null,
          consentVersionNo: consent.versionNo,
        },
      });
      setDone(true);
    } catch (error) {
      if (isApiError(error) && error.code === "agents.waitlist_consent_outdated") {
        // A newer consent text was published while the page was open: show it and ask again.
        setAccepted(false);
        setFailure(t("consentChanged"));
        router.refresh();
      } else if (isApiError(error) && error.code === "agents.waitlist_closed") {
        router.refresh();
      } else if (isApiError(error) && error.status === 429) {
        setFailure(t("tooMany"));
      } else if (isApiError(error) && error.code === "validation.failed") {
        setFailure(t("checkFields"));
      } else {
        setFailure(t("failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="border-border bg-surface rounded-panel flex items-start gap-3 border p-5">
        <span className="bg-primary-subtle text-primary grid size-9 shrink-0 place-items-center rounded-full">
          <Icon name="check" size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">{t("doneTitle")}</p>
          <p className="text-muted mt-1 text-[14.5px]">{t("doneBody")}</p>
        </div>
      </div>
    );
  }

  const messages = Object.values(errors);
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-5"
      aria-label={t("formLabel")}
    >
      {messages.length ? (
        <div id="waitlist-errors" tabIndex={-1} role="alert" className="outline-none">
          <Callout tone="danger" title={t("errors.title", { count: messages.length })}>
            <ul className="list-disc ps-5">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}
      <Field label={t("name")} error={errors.name} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("phone")} hint={t("contactHint")} error={errors.phone ?? errors.contact}>
          <PhoneInput value={phone} onChange={(value) => setPhone(normaliseThaiMobile(value))} />
        </Field>
        <Field label={t("email")} error={errors.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
        </Field>
      </div>
      <Field label={t("channel")}>
        <NativeSelect<Channel | "">
          value={channel}
          onValueChange={setChannel}
          options={[
            { value: "", label: t("channelNone") },
            ...CHANNELS.map((value) => ({ value, label: tChannels(value) })),
          ]}
        />
      </Field>
      <section
        aria-labelledby={consentId}
        className="border-border bg-bg-subtle rounded-card flex flex-col gap-3 border p-4"
      >
        <p id={consentId} className="text-sm font-semibold">
          {t("consentTitle", { version: consent.versionNo })}
        </p>
        {summary ? <p className="text-[14px] font-medium">{summary}</p> : null}
        <p className="text-muted text-[13.5px] leading-relaxed whitespace-pre-line">{text}</p>
        <Checkbox label={t("consentAccept")} checked={accepted} onCheckedChange={(on) => setAccepted(on === true)} />
        {errors.consent ? <p className="text-danger text-xs">{errors.consent}</p> : null}
      </section>
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto sm:self-start">
          {t("submit")}
        </Button>
        <p className="text-muted text-xs">{t("privacyNote")}</p>
      </div>
    </form>
  );
}
