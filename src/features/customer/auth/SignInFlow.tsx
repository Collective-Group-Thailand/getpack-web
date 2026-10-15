"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconTile } from "@/ui/components/Decor";
import { Field } from "@/ui/components/Field";
import { OTPInput } from "@/ui/components/OTPInput";
import { formatThaiMobile, isThaiMobile, PhoneInput } from "@/ui/components/PhoneInput";
import { ReferenceCode, shortReference } from "@/ui/components/ReferenceCode";
import { cn } from "@/ui/lib/cn";

import { requestOtp, signInWithFirebase, signInWithLine, verifyOtp } from "./actions";
import { ConsentStep } from "./ConsentStep";
import { consentsToAsk, loadOnboarding, needsProfile, type Consent, type ConsentSource } from "./onboarding";
import { OTP_CODE_LENGTH, type OtpChallenge } from "./otp";
import { ProfileStep } from "./ProfileStep";
import { BrandMark, type Brand } from "./BrandMark";
import { firebaseConfigured, lineConfigured } from "./providers";
import { useResendTimer } from "./useResendTimer";

export interface SignInFlowProps {
  /** Called once a session exists and the onboarding steps are done. */
  onSignedIn?: () => void;
  /** Back from LINE's login page (`/sign-in?provider=line`): finish that sign-in on mount. */
  resume?: "line";
  /** Where LINE should send the customer back to after its login page. */
  lineReturnUrl?: string;
  /**
   * `page` — the `/sign-in` page: the step's title is the page's h1, at the page's size.
   * `overlay` — inside the dialog or sheet, which already carries the title.
   */
  variant: "page" | "overlay";
  /** Tells the dialog or sheet which step it shows, for its title. */
  onStepChange?: (step: "phone" | "otp" | "onboarding") => void;
}

interface Failure {
  errorKey: string;
  requestId?: string;
  detail?: string;
}

type Step =
  | { kind: "credentials" }
  | {
      kind: "consent";
      consents: Consent[];
      source: ConsentSource;
      displayName: string;
      customerId: string;
      askProfile: boolean;
    }
  | { kind: "profile"; displayName: string; customerId: string };

/** The number as the API takes it: a mobile typed without its leading zero gets it back. */
function nationalNumber(digits: string): string {
  return digits.length === 9 ? `0${digits}` : digits;
}

/** `m:ss`, for the code's expiry. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Customer sign-in (UX audit Flow 1, step 3), then what a first sign-in needs.
 *
 * Mobile number → a six-box OTP that verifies itself on the last digit and takes a pasted code,
 * with the number and a way to change it, a short reference for support, the code's expiry and
 * the API's own resend cool-down. Errors sit under the field they are about, never as a banner,
 * and never show a UUID. Google, Apple and LINE are offered when this deployment has them, their
 * SDKs loaded on click. After the API issues a session: PDPA consent when a purpose is unanswered,
 * then — skippably — a name and a customer type.
 */
export function SignInFlow({ onSignedIn, resume, lineReturnUrl, variant, onStepChange }: SignInFlowProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [pending, startTransition] = useTransition();

  const resendIn = useResendTimer(challenge ? Date.parse(challenge.resendAvailableAt) : null);
  const expiresIn = useResendTimer(challenge ? Date.parse(challenge.expiresAt) : null);
  const providers = { firebase: firebaseConfigured(), line: lineConfigured() };
  const codeLength = challenge?.codeLength ?? OTP_CODE_LENGTH;
  const Title = variant === "page" ? "h1" : "h2";

  useEffect(() => {
    onStepChange?.(step.kind !== "credentials" ? "onboarding" : challenge ? "otp" : "phone");
  }, [challenge, step.kind, onStepChange]);

  /** After the API issued a session: ask for what is missing, or finish. */
  async function afterSession(source: ConsentSource) {
    const { consents, profile } = await loadOnboarding();
    const ask = consentsToAsk(consents);
    const askProfile = needsProfile(profile);
    const displayName = profile?.displayName ?? "";
    const customerId = profile?.id ?? "";
    if (ask.length > 0) setStep({ kind: "consent", consents: ask, source, displayName, customerId, askProfile });
    else if (askProfile) setStep({ kind: "profile", displayName, customerId });
    else onSignedIn?.();
  }

  function fail(result: { errorKey?: string; requestId?: string; detail?: string }) {
    setFailure({
      errorKey: result.errorKey ?? "errors.unavailable",
      requestId: result.requestId,
      detail: result.detail,
    });
  }

  function send() {
    setFailure(null);
    startTransition(async () => {
      const result = await requestOtp(nationalNumber(phone));
      if (result.challenge) {
        setChallenge(result.challenge);
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
      // Deliberately not closing on success: closing and signing in are different events, and a
      // parent that treats a close as "cancelled" would undo the sign-in.
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

  // Back from LINE's login page: finish once, on mount.
  const resumed = useRef(false);
  useEffect(() => {
    if (resume !== "line" || resumed.current) return;
    resumed.current = true;
    withLine();
    // `withLine` is stable in what it does; running it once is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  if (step.kind === "consent") {
    return (
      <ConsentStep
        consents={step.consents}
        source={step.source}
        onDone={() => {
          if (step.askProfile) setStep({ kind: "profile", displayName: step.displayName, customerId: step.customerId });
          else onSignedIn?.();
        }}
      />
    );
  }
  if (step.kind === "profile") {
    return <ProfileStep displayName={step.displayName} customerId={step.customerId} onDone={() => onSignedIn?.()} />;
  }

  const errorText = failure ? (failure.detail ?? t(failure.errorKey)) : null;
  // A reference is for support: shown when the system failed, not when a code or number was mistyped.
  const errorNote =
    failure?.requestId &&
    !["errors.invalidOtp", "errors.invalidPhone", "errors.expiredOtp"].includes(failure.errorKey) ? (
      <ReferenceCode
        id={failure.requestId}
        label={tCommon("errors.reference")}
        copyLabel={tCommon("errors.copyReference")}
        copiedLabel={tCommon("errors.referenceCopied")}
        className="mt-1 flex"
      />
    ) : null;

  if (challenge) {
    const expired = expiresIn === 0;
    return (
      <div className="flex flex-col">
        <IconTile name="phone" size="lg" className="mb-6" />
        <Title className={cn("font-bold tracking-tight", variant === "page" ? "text-3xl" : "text-2xl")}>
          {t("customer.otpTitle")}
        </Title>
        <p className="text-muted mt-2 text-base">
          {t("customer.otpSentTo", { length: codeLength })}{" "}
          <span className="text-fg font-semibold tabular-nums">{formatThaiMobile(phone)}</span>{" "}
          <button
            type="button"
            className="text-primary font-medium underline-offset-4 hover:underline"
            onClick={() => {
              setChallenge(null);
              setFailure(null);
            }}
            disabled={pending}
          >
            {t("customer.edit")}
          </button>
        </p>

        <Field
          label={t("customer.otp")}
          labelHidden
          className="mt-7"
          error={
            errorText ? (
              // Announced where it is (UX audit: inline under the field, not a banner).
              <span role="status" className="block text-sm">
                {errorText}
                {errorNote}
              </span>
            ) : undefined
          }
        >
          <OTPInput
            appearance="boxes"
            value={code}
            onChange={(next) => {
              setCode(next);
              if (failure) setFailure(null);
            }}
            length={codeLength}
            disabled={pending || expired}
            invalid={Boolean(failure)}
            // Verifies on the last digit: on a phone the keyboard covers the button anyway.
            onComplete={verify}
          />
        </Field>

        <div className="text-muted mt-3 flex items-center justify-between gap-3 text-sm">
          <span>
            {t("customer.reference")}{" "}
            <span className="text-fg font-mono font-semibold">{shortReference(challenge.challengeId)}</span>
          </span>
          <span aria-live="off" className={cn(expired && "text-danger-subtle-fg font-medium")}>
            {expired ? (
              t("customer.expired")
            ) : (
              <>
                {t("customer.expiresIn")} <span className="text-fg font-semibold tabular-nums">{clock(expiresIn)}</span>
              </>
            )}
          </span>
        </div>

        <Button
          type="button"
          size="lg"
          block
          className="mt-7"
          loading={pending}
          disabled={code.length !== codeLength || expired}
          onClick={() => verify()}
        >
          {pending ? t("customer.verifying") : t("customer.verifyAndSignIn")}
        </Button>

        <p className="text-muted mt-6 text-center text-sm">
          {t("customer.notReceived")}{" "}
          <button
            type="button"
            onClick={send}
            disabled={pending || resendIn > 0}
            className="text-primary font-medium underline-offset-4 hover:underline disabled:text-inherit disabled:no-underline"
          >
            {resendIn > 0 ? t("customer.resendIn", { seconds: resendIn }) : t("customer.resend")}
          </button>
        </p>
        <p className="text-muted mt-4 text-center text-sm">
          {t("customer.trouble")}{" "}
          <Link href="/help/contact" className="text-primary font-medium underline-offset-4 hover:underline">
            {t("customer.talkToUs")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {variant === "page" ? (
        <>
          <Title className="text-3xl font-bold tracking-tight">{t("customer.title")}</Title>
          <p className="text-muted mt-2 text-base">{t("customer.subtitle")}</p>
        </>
      ) : null}

      <form
        className={cn(variant === "page" && "mt-8")}
        onSubmit={(event) => {
          event.preventDefault();
          if (isThaiMobile(phone)) send();
        }}
      >
        <Field
          label={t("customer.phone")}
          hint={t("customer.phoneHint")}
          error={
            errorText ? (
              // Announced where it is (UX audit: inline under the field, not a banner).
              <span role="status" className="block text-sm">
                {errorText}
                {errorNote}
              </span>
            ) : undefined
          }
        >
          <PhoneInput
            size="lg"
            value={phone}
            onChange={(next) => {
              setPhone(next);
              if (failure) setFailure(null);
            }}
            disabled={pending}
            placeholder={t("customer.phonePlaceholder")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          block
          className="mt-6"
          loading={pending}
          disabled={!isThaiMobile(phone)}
          iconEnd="arrow-right"
        >
          {pending ? t("customer.sending") : t("customer.sendOtp")}
        </Button>
      </form>

      <div className="text-muted my-7 flex items-center gap-3 text-sm">
        <span aria-hidden className="bg-border h-px flex-1" />
        {t("customer.orDivider")}
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>

      <div className="flex flex-col gap-2.5">
        <ProviderButton
          brand="google"
          available={providers.firebase}
          disabled={pending}
          label={t("customer.google")}
          unavailable={t("customer.providerUnavailable")}
          onClick={() => withFirebase("google")}
        />
        <ProviderButton
          brand="apple"
          available={providers.firebase}
          disabled={pending}
          label={t("customer.apple")}
          unavailable={t("customer.providerUnavailable")}
          onClick={() => withFirebase("apple")}
        />
        <ProviderButton
          brand="line"
          available={providers.line}
          disabled={pending}
          label={t("customer.line")}
          unavailable={t("customer.providerUnavailable")}
          onClick={withLine}
        />
      </div>

      {/* PDPA: say what the number is for before it is collected, and where to read more. */}
      <p className="text-muted mt-7 text-center text-sm leading-relaxed">
        {t.rich("customer.legal", {
          terms: (chunks) => (
            <Link href="/legal/terms" className="text-primary underline-offset-2 hover:underline">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/legal/privacy" className="text-primary underline-offset-2 hover:underline">
              {chunks}
            </Link>
          ),
        })}
        <br />
        {t("customer.privacyNotice")}
      </p>
    </div>
  );
}

/**
 * One third-party option, with the provider's mark (`BrandMark`) beside its label.
 *
 * Disabled with an explanation rather than hidden: a returning customer who signed up with
 * Google needs to know the option exists and is temporarily off. Its SDK is imported on click
 * (`provider-sdks.ts`), so it costs the page nothing until then.
 *
 * Google and Apple are the providers' white buttons — white in every theme, so Apple's black mark
 * always shows — on Packio's hairline; LINE is its own green with the white mark. These are the
 * providers' published button colours, not Packio's palette, which is why they sit here.
 */
const PROVIDER_STYLE: Record<Brand, string> = {
  google: "bg-white text-[#1f1f1f] border-border hover:bg-[#f7f7f7]",
  apple: "bg-white text-[#1f1f1f] border-border hover:bg-[#f7f7f7]",
  line: "bg-[#06C755] text-white border-[#06C755] hover:bg-[#05b34c] hover:border-[#05b34c]",
};

function ProviderButton({
  brand,
  available,
  disabled,
  label,
  unavailable,
  onClick,
}: {
  brand: Brand;
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
      className={cn("gap-3", PROVIDER_STYLE[brand])}
    >
      <BrandMark brand={brand} className="size-5 shrink-0" />
      {label}
    </Button>
  );
}
