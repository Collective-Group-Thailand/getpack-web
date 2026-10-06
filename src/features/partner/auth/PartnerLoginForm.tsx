"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
// Direct paths, not the `@/ui` barrel: a client bundle cannot shake the barrel's other
// client components out, and this is the partner zone's first page (180 KB budget).
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
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
        <Input ref={password} name="password" type="password" autoComplete="current-password" inputSize="lg" />
      </Field>

      <Field label={t("partner.devicePin")} hint={t("partner.devicePinHint")}>
        <Input name="pin" type="password" inputMode="numeric" autoComplete="off" inputSize="lg" />
      </Field>

      <Button type="submit" size="xl" loading={pending} block>
        {pending ? t("partner.submitting") : t("partner.submit")}
      </Button>
    </form>
  );
}
