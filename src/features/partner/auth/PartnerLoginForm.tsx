"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
import { Button, Callout, Field, Input } from "@/ui";

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

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.errorKey ? (
        <Callout tone="danger" live title={t(state.errorKey)}>
          {state.requestId ? <RequestIdNote requestId={state.requestId} /> : null}
        </Callout>
      ) : null}

      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label={t("partner.username")} required requiredLabel={tCommon("state.required")}>
        <Input name="username" autoComplete="username" inputSize="lg" autoFocus required />
      </Field>

      <Field label={t("partner.password")} required requiredLabel={tCommon("state.required")}>
        <Input name="password" type="password" autoComplete="current-password" inputSize="lg" required />
      </Field>

      <Field label={t("partner.devicePin")} hint={t("partner.devicePinHint")}>
        <Input name="devicePin" type="password" inputMode="numeric" autoComplete="off" inputSize="lg" />
      </Field>

      <Button type="submit" size="xl" loading={pending} block>
        {pending ? t("partner.submitting") : t("partner.submit")}
      </Button>
    </form>
  );
}
