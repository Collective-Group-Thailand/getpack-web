"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { OTPInput } from "@/ui/components/OTPInput";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { Sheet } from "@/ui/components/Sheet";

import { requestOtp, signInWithFirebase, signInWithLine, verifyOtp } from "./actions";
import { ConsentStep } from "./ConsentStep";
import { consentsToAsk, loadOnboarding, needsProfile, type Consent, type ConsentSource } from "./onboarding";
import { OTP_CODE_LENGTH, type OtpChallenge } from "./otp";
import { ProfileStep } from "./ProfileStep";
import { firebaseConfigured, lineConfigured } from "./providers";
import { useResendTimer } from "./useResendTimer";

export interface SignInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a session exists and the onboarding steps are done. */
  onSignedIn?: () => void;
  /** Back from LINE's login page (`/sign-in?provider=line`): finish that sign-in on open. */
  resume?: "line";
  /** Where LINE should send the customer back to after its login page. */
  lineReturnUrl?: string;
}

interface Failure {
  errorKey: string;
  requestId?: string;
}

type Step =
  | { kind: "credentials" }
  | { kind: "consent"; consents: Consent[]; source: ConsentSource; displayName: string; askProfile: boolean }
  | { kind: "profile"; displayName: string };

/**
 * Customer sign-in, then what a first sign-in needs.
 *
 * A bottom sheet on phones (design-system.md §5: the customer zone's actions sit in the thumb
 * zone). Credentials first — a mobile number and OTP, or Google / Apple (Firebase) or LINE, each
 * offered only when this deployment has its credentials, their SDKs loaded on click. Once the
 * API has issued a session, the sheet asks for what is missing: PDPA consent when a required
 * purpose is unanswered or out of date, then — skippably — a name, an e-mail and a customer
 * type (progressive profiling). A returning customer with nothing missing goes straight on.
 */
export function SignInSheet({ open, onOpenChange, onSignedIn, resume, lineReturnUrl }: SignInSheetProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [pending, startTransition] = useTransition();

  const resendIn = useResendTimer(resendDeadline);
  const providers = { firebase: firebaseConfigured(), line: lineConfigured() };

  /** After the API issued a session: ask for what is missing, or finish. */
  async function afterSession(source: ConsentSource) {
    const { consents, me } = await loadOnboarding();
    const ask = consentsToAsk(consents);
    const askProfile = needsProfile(me);
    const displayName = me?.displayName ?? "";
    if (ask.length > 0) setStep({ kind: "consent", consents: ask, source, displayName, askProfile });
    else if (askProfile) setStep({ kind: "profile", displayName });
    else onSignedIn?.();
  }

  function fail(result: { errorKey?: string; requestId?: string }) {
    setFailure({ errorKey: result.errorKey ?? "errors.unavailable", requestId: result.requestId });
  }

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
        fail(result);
      }
    });
  }

  function verify(value = code) {
    if (!challenge) return;
    setFailure(null);
    startTransition(async () => {
      const result = await verifyOtp(challenge.challengeId, value);
      // Deliberately not `onOpenChange(false)` on success: closing and signing in are different
      // events, and a parent that treats a close as "cancelled" would undo the sign-in.
      if (result.ok) await afterSession("web");
      else fail(result);
    });
  }

  function withFirebase(provider: "google" | "apple") {
    setFailure(null);
    startTransition(async () => {
      const { firebaseIdToken, ProviderCancelled } = await import("./provider-sdks");
      try {
        const result = await signInWithFirebase(await firebaseIdToken(provider));
        if (result.ok) await afterSession("web");
        else fail(result);
      } catch (error) {
        if (!(error instanceof ProviderCancelled)) fail({ errorKey: "errors.providerFailed" });
      }
    });
  }

  function withLine() {
    setFailure(null);
    startTransition(async () => {
      const { lineIdentity } = await import("./provider-sdks");
      try {
        const identity = await lineIdentity(lineReturnUrl ?? window.location.href);
        if (!identity) return; // on the way to LINE's login page
        const result = await signInWithLine(identity);
        if (result.ok) await afterSession(identity.inClient ? "line_liff" : "web");
        else fail(result);
      } catch {
        fail({ errorKey: "errors.providerFailed" });
      }
    });
  }

  // Back from LINE's login page: finish once, on open.
  const resumed = useRef(false);
  useEffect(() => {
    if (!open || resume !== "line" || resumed.current) return;
    resumed.current = true;
    withLine();
    // `withLine` is stable in what it does; running it once is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resume]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={t("customer.title")}
      description={step.kind === "credentials" && !challenge ? t("customer.subtitle") : undefined}
      closeLabel={tCommon("actions.close")}
    >
      {step.kind === "consent" ? (
        <ConsentStep
          consents={step.consents}
          source={step.source}
          onDone={() => {
            if (step.askProfile) setStep({ kind: "profile", displayName: step.displayName });
            else onSignedIn?.();
          }}
        />
      ) : step.kind === "profile" ? (
        <ProfileStep displayName={step.displayName} onDone={() => onSignedIn?.()} />
      ) : (
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
                  disabled={pending}
                  label={t("customer.google")}
                  unavailable={t("customer.providerUnavailable")}
                  onClick={() => withFirebase("google")}
                />
                <ProviderButton
                  available={providers.firebase}
                  disabled={pending}
                  label={t("customer.apple")}
                  unavailable={t("customer.providerUnavailable")}
                  onClick={() => withFirebase("apple")}
                />
                <ProviderButton
                  available={providers.line}
                  disabled={pending}
                  label={t("customer.line")}
                  unavailable={t("customer.providerUnavailable")}
                  onClick={withLine}
                />
              </div>

              {/* PDPA: say what the number is for before it is collected, and where to read more. */}
              <p className="text-muted text-xs">
                {t("customer.privacyNotice")}{" "}
                <Link href="/legal/privacy" className="text-primary underline underline-offset-2">
                  {t("customer.privacyLink")}
                </Link>
              </p>
            </>
          )}
        </div>
      )}
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
 * whether they used a different number. Its SDK is imported on click (`provider-sdks.ts`), so
 * it costs the page nothing until then (design-system.md §7 budget).
 */
function ProviderButton({
  available,
  disabled,
  label,
  unavailable,
  onClick,
}: {
  available: boolean;
  disabled?: boolean;
  label: string;
  unavailable: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      block
      disabled={!available || disabled}
      title={available ? undefined : unavailable}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
