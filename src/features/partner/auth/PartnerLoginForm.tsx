"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
// Direct paths, not the `@/ui` barrel: a client bundle cannot shake the barrel's other
// client components out, and this is the partner zone's first page (180 KB budget).
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";

import { signInPartner, type PartnerLoginState } from "./actions";

/**
 * Partner sign-in, sized for a shop floor.
 *
 * `size="xl"` on the controls and the button is the 48 px+ target design-system.md §5 asks
 * for in this zone: this is used standing up, on a shared phone, often with gloves on.
 */
export function PartnerLoginForm({ returnTo }: { returnTo: string }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<PartnerLoginState, FormData>(signInPartner, {});
  // React resets a form after its action; the email is kept (controlled) so a mistyped password
  // costs only the password, and the cursor goes back to it (round 2, B10).
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.errorKey && email) password.current?.focus();
  }, [state, email]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.errorKey ? (
        <Callout tone="danger" live title={t(state.errorKey)}>
          {state.requestId ? <RequestIdNote requestId={state.requestId} /> : null}
        </Callout>
      ) : null}

      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label={t("partner.email")} required requiredLabel={tCommon("state.required")}>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          inputSize="lg"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      {/*
        Neither the password nor the PIN is marked required: `PartnerLoginDto` requires only
        the email, because a shared shop-floor device can be enrolled with a PIN instead of a
        password. The action checks that one of the two was filled.
      */}
      <Field label={t("partner.password")}>
        <div className="relative">
          <Input
            ref={password}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            inputSize="lg"
            className="pe-14"
          />
          <IconButton
            name="eye"
            variant="ghost"
            label={showPassword ? t("partner.hidePassword") : t("partner.showPassword")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
            className="absolute end-1.5 top-1/2 -translate-y-1/2"
          />
        </div>
      </Field>
      <div className="-mt-2 flex justify-end">
        <button
          type="button"
          className="text-primary min-h-11 text-sm font-medium underline-offset-4 hover:underline"
          aria-expanded={forgotOpen}
          onClick={() => setForgotOpen((open) => !open)}
        >
          {t("partner.forgot")}
        </button>
      </div>
      {forgotOpen ? (
        // No self-service reset (as for staff): say who sets a new one.
        <p className="bg-surface-subtle text-muted rounded-control -mt-2 px-4 py-3 text-sm">
          {t("partner.forgotBody")}
        </p>
      ) : null}

      <Field label={t("partner.devicePin")} hint={t("partner.devicePinHint")}>
        <Input name="pin" type="password" inputMode="numeric" autoComplete="off" inputSize="lg" />
      </Field>

      <Button type="submit" size="xl" loading={pending} block>
        {pending ? t("partner.submitting") : t("partner.submit")}
      </Button>
    </form>
  );
}
