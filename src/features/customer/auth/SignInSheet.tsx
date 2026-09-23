"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
import { Button, Callout, Field, OTPInput, PhoneInput, Sheet } from "@/ui";

import { requestOtp, verifyOtp } from "./actions";
import { OTP_CODE_LENGTH, type OtpChallenge } from "./otp";
import { firebaseConfigured, lineConfigured } from "./providers";
import { useResendTimer } from "./useResendTimer";

export interface SignInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a session exists, so the page can refresh or navigate. */
  onSignedIn?: () => void;
}

interface Failure {
  errorKey: string;
  requestId?: string;
}

/**
 * Customer sign-in.
 *
 * A bottom sheet on phones (design-system.md §5 puts the customer zone's actions in the thumb
 * zone) holding a two-step OTP flow: number, then code. Firebase and LINE sit below a
 * separator as alternatives; they render as unavailable unless this deployment has their
 * credentials, because a button that looks live and then fails is worse than one that is
 * plainly not on offer yet.
 */
export function SignInSheet({ open, onOpenChange, onSignedIn }: SignInSheetProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const resendIn = useResendTimer(resendDeadline);
  const providers = { firebase: firebaseConfigured(), line: lineConfigured() };

  function send() {
    setFailure(null);
    startTransition(async () => {
      const result = await requestOtp(phone);
      if (result.challenge) {
        setChallenge(result.challenge);
        // The API gives the moment a resend becomes available, which is already the deadline
        // the countdown needs — no arithmetic on a duration, and no clock of our own.
        setResendDeadline(Date.parse(result.challenge.resendAvailableAt));
        setCode("");
      } else {
        setFailure({ errorKey: result.errorKey ?? "errors.unavailable", requestId: result.requestId });
      }
    });
  }

  function verify(value = code) {
    if (!challenge) return;
    setFailure(null);
    startTransition(async () => {
      const result = await verifyOtp(challenge.challengeId, value);
      if (result.ok) {
        // Deliberately not `onOpenChange(false)`: closing and signing in are different
        // events, and a parent that treats a close as "the customer cancelled" — by going
        // back, say — would undo the sign-in it just asked for.
        onSignedIn?.();
      } else {
        setFailure({ errorKey: result.errorKey ?? "errors.unavailable", requestId: result.requestId });
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={t("customer.title")}
      description={challenge ? undefined : t("customer.subtitle")}
      closeLabel={tCommon("actions.close")}
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Callout tone="danger" live title={t(failure.errorKey)}>
            {failure.requestId ? <RequestIdNote requestId={failure.requestId} /> : null}
          </Callout>
        ) : null}

        {challenge ? (
          <>
            <Field label={t("customer.otp")} hint={t("customer.otpHint", { length: OTP_CODE_LENGTH, phone })}>
              <OTPInput
                value={code}
                onChange={setCode}
                length={OTP_CODE_LENGTH}
                disabled={pending}
                // Submitting on the last digit saves a tap on a phone, where the keyboard
                // is covering the button anyway.
                onComplete={verify}
              />
            </Field>

            <Button
              type="button"
              size="lg"
              block
              loading={pending}
              disabled={code.length !== OTP_CODE_LENGTH}
              onClick={() => verify()}
            >
              {pending ? t("customer.verifying") : t("customer.verify")}
            </Button>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setChallenge(null);
                  setResendDeadline(null);
                }}
                disabled={pending}
              >
                {t("customer.changePhone")}
              </Button>
              <Button type="button" variant="link" onClick={send} disabled={pending || resendIn > 0}>
                {resendIn > 0 ? t("customer.resendIn", { seconds: resendIn }) : t("customer.resend")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field
              label={t("customer.phone")}
              hint={t("customer.phoneHint")}
              required
              requiredLabel={tCommon("state.required")}
            >
              <PhoneInput
                value={phone}
                onChange={setPhone}
                disabled={pending}
                placeholder={t("customer.phonePlaceholder")}
              />
            </Field>

            <Button type="button" size="lg" block loading={pending} disabled={phone.length < 9} onClick={send}>
              {pending ? t("customer.sending") : t("customer.sendOtp")}
            </Button>

            <LabelledDivider label={t("customer.orDivider")} />

            <div className="flex flex-col gap-2">
              <ProviderButton
                available={providers.firebase}
                label={t("customer.google")}
                unavailable={t("customer.providerUnavailable")}
              />
              <ProviderButton
                available={providers.firebase}
                label={t("customer.apple")}
                unavailable={t("customer.providerUnavailable")}
              />
              <ProviderButton
                available={providers.line}
                label={t("customer.line")}
                unavailable={t("customer.providerUnavailable")}
              />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** A horizontal rule with its label sitting in the gap, naming what follows. */
function LabelledDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="bg-border h-px flex-1" />
      <span className="text-muted text-xs">{label}</span>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}

/**
 * One third-party option.
 *
 * Disabled with an explanation rather than hidden: a returning customer who signed up with
 * Google needs to know the option exists and is temporarily off, not be left wondering
 * whether they used a different number. The SDKs are loaded on click in F3, so nothing here
 * costs the customer bundle anything today (design-system.md §7 budget).
 */
function ProviderButton({ available, label, unavailable }: { available: boolean; label: string; unavailable: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      block
      disabled={!available}
      title={available ? undefined : unavailable}
    >
      {label}
    </Button>
  );
}
