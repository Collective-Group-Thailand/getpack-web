"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { OTP_CODE_LENGTH } from "@/features/customer/auth/otp";
import { useResendTimer } from "@/features/customer/auth/useResendTimer";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { OtpChallenge, Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { OTPInput } from "@/ui/components/OTPInput";
import { isThaiMobile, normaliseThaiMobile, PhoneInput } from "@/ui/components/PhoneInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet } from "@/ui/components/Sheet";

type Juristic = Schemas["JuristicType"];
type Channel = Schemas["SubmitAgentApplicationDto"]["salesChannels"][number];
type Agreement = { versionNo: number; textTh: string; textEn?: string | null };

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

/**
 * D-466 step 1 — apply in about two minutes: who you are (individual, company or partnership), a verified phone,
 * e-mail, LINE and how you sell, then the agreement read in a sheet and accepted. Tax id, address, documents and the
 * bank account wait for step 2 (the payout profile) — needed only before the first payout. A phone the account
 * already verified at sign-in needs no new code; any other number gets an OTP (`store.agentPhone.request/confirm`).
 */
export function ApplyForm({
  agreement,
  defaultName,
  defaultEmail,
  accountPhone,
}: {
  agreement: Agreement;
  defaultName: string;
  defaultEmail: string | null;
  /** The account's phone, already verified when the customer signed in with it. */
  accountPhone: string | null;
}) {
  const t = useTranslations("agent.apply");
  const router = useRouter();
  const locale = useLocale();
  const [juristic, setJuristic] = useState<Juristic>("individual");
  const [form, setForm] = useState({
    displayName: defaultName,
    email: defaultEmail ?? "",
    lineId: "",
    pitch: "",
  });
  const [phone, setPhone] = useState(accountPhone ? normaliseThaiMobile(accountPhone) : "");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    accountPhone ? normaliseThaiMobile(accountPhone) : null,
  );
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const resendIn = useResendTimer(challenge ? Date.parse(challenge.resendAvailableAt) : null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [readOpen, setReadOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const phoneVerified = verifiedPhone !== null && verifiedPhone === phone;

  async function sendCode() {
    setOtpError(null);
    if (!isThaiMobile(phone)) {
      setErrors((current) => ({ ...current, phone: t("errors.phone") }));
      return;
    }
    setOtpBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/store/agent/phone-verification", { body: { phone } });
      setChallenge(data!);
      setCode("");
    } catch (error) {
      setOtpError(isApiError(error) ? error.detail : t("otp.failed"));
    } finally {
      setOtpBusy(false);
    }
  }

  async function confirmCode(value: string) {
    if (!challenge) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const { data } = await browserApi().POST("/v1/store/agent/phone-verification/actions/confirm", {
        body: { challengeId: challenge.challengeId, code: value },
      });
      setVerifiedPhone(normaliseThaiMobile(data!.phone));
      setChallenge(null);
      setErrors(({ phone: _drop, ...rest }) => rest);
    } catch (error) {
      setOtpError(isApiError(error) ? error.detail : t("otp.failed"));
    } finally {
      setOtpBusy(false);
    }
  }

  function check(): Record<string, string> {
    const found: Record<string, string> = {};
    if (form.displayName.trim().length < 2) found.displayName = t("errors.displayName");
    if (!phoneVerified) found.phone = t("errors.phoneVerify");
    if (!EMAIL.test(form.email.trim())) found.email = t("errors.email");
    if (!channels.length) found.channels = t("errors.channels");
    if (!accepted) found.agreement = t("errors.agreement");
    return found;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) {
      document.getElementById("apply-errors")?.focus();
      return;
    }
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/agent/application", {
        body: {
          juristicType: juristic,
          displayName: form.displayName.trim(),
          phone,
          email: form.email.trim(),
          lineId: form.lineId.trim() || null,
          salesChannels: channels,
          pitch: form.pitch.trim() || null,
          agreementVersionNo: agreement.versionNo,
        },
      });
      router.push("/account/agent?applied=1");
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.code === "agents.phone_unverified") {
        setVerifiedPhone(null);
        setErrors({ phone: t("errors.phoneVerify") });
      } else {
        setFailure(isApiError(error) ? error.detail : t("failed"));
      }
      setBusy(false);
    }
  }

  const messages = Object.values(errors);
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-8">
      {messages.length ? (
        <div id="apply-errors" tabIndex={-1} role="alert" className="outline-none">
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

      <FormSection title={t("whoStep1")}>
        <SegmentedControl
          label={t("juristic")}
          value={juristic}
          onValueChange={(value) => setJuristic(value as Juristic)}
          options={(["individual", "company", "partnership"] as const).map((value) => ({
            value,
            label: t(`juristicTypes.${value}`),
          }))}
        />
        <Field
          label={juristic === "individual" ? t("displayName") : t("companyName")}
          hint={t("displayNameHint")}
          error={errors.displayName}
          required
        >
          <Input
            value={form.displayName}
            onChange={(e) => set("displayName")(e.target.value)}
            autoComplete={juristic === "individual" ? "name" : "organization"}
          />
        </Field>
      </FormSection>

      <FormSection title={t("contact")} description={t("contactIntro")}>
        <Field
          label={t("phone")}
          hint={phoneVerified ? t("otp.verified") : t("phoneHint")}
          error={errors.phone}
          required
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <PhoneInput
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setChallenge(null);
              }}
              className="sm:max-w-64"
            />
            {phoneVerified ? (
              <span className="text-success inline-flex min-h-10 items-center gap-1.5 text-sm font-medium">
                {t("otp.verifiedBadge")}
              </span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                loading={otpBusy && !challenge}
                disabled={resendIn > 0}
                onClick={() => void sendCode()}
              >
                {challenge
                  ? resendIn > 0
                    ? t("otp.resendIn", { seconds: resendIn })
                    : t("otp.resend")
                  : t("otp.send")}
              </Button>
            )}
          </div>
        </Field>
        {challenge && !phoneVerified ? (
          <Field
            label={t("otp.code")}
            hint={t("otp.sentTo", { length: challenge.codeLength ?? OTP_CODE_LENGTH })}
            error={otpError ?? undefined}
          >
            <OTPInput
              value={code}
              onChange={setCode}
              length={challenge.codeLength ?? OTP_CODE_LENGTH}
              disabled={otpBusy}
              invalid={Boolean(otpError)}
              onComplete={(value) => void confirmCode(value)}
            />
          </Field>
        ) : otpError ? (
          <p className="text-danger text-xs" role="alert">
            {otpError}
          </p>
        ) : null}
        <Field label={t("email")} hint={t("emailHint")} error={errors.email} required>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Field>
        <Field label={t("lineId")} hint={t("lineIdHint")}>
          <Input value={form.lineId} onChange={(e) => set("lineId")(e.target.value)} autoComplete="off" />
        </Field>
      </FormSection>

      <FormSection title={t("aboutYou")}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t("channels")} <span className="text-danger">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((channel) => (
              <Checkbox
                key={channel}
                label={t(`channelOptions.${channel}`)}
                checked={channels.includes(channel)}
                onCheckedChange={(on) =>
                  setChannels((current) =>
                    on === true ? [...current, channel] : current.filter((value) => value !== channel),
                  )
                }
              />
            ))}
          </div>
          {errors.channels ? <p className="text-danger text-xs">{errors.channels}</p> : null}
        </fieldset>
        <Field label={t("pitch")} hint={t("pitchHint")}>
          <Textarea rows={3} value={form.pitch} onChange={(e) => set("pitch")(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title={t("agreement", { version: agreement.versionNo })} description={t("agreementIntro")}>
        <div>
          <Button type="button" variant="secondary" onClick={() => setReadOpen(true)}>
            {t("readAgreement")}
          </Button>
        </div>
        <Checkbox label={t("accept")} checked={accepted} onCheckedChange={(on) => setAccepted(on === true)} />
        {errors.agreement ? <p className="text-danger text-xs">{errors.agreement}</p> : null}
        <Sheet
          open={readOpen}
          onOpenChange={setReadOpen}
          title={t("agreement", { version: agreement.versionNo })}
          closeLabel={t("close")}
          className="sm:w-[min(40rem,calc(100vw-2rem))]"
          footer={
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setAccepted(true);
                setReadOpen(false);
              }}
            >
              {t("acceptAndClose")}
            </Button>
          }
        >
          <div className="text-sm leading-relaxed whitespace-pre-line">
            {locale === "en" && agreement.textEn ? agreement.textEn : agreement.textTh}
          </div>
        </Sheet>
      </FormSection>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto sm:self-start">
          {t("submit")}
        </Button>
        <p className="text-muted text-xs">{t("afterSubmit")}</p>
      </div>
    </form>
  );
}
