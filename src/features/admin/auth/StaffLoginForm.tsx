"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
import { Button, Callout, Field, Input } from "@/ui";

import { signInStaff, type StaffLoginState } from "./actions";

/**
 * The staff sign-in form.
 *
 * A plain `<form action={…}>` driven by `useActionState`, so it submits and reports its error
 * even before the client bundle has hydrated — this is the one screen where a page that needs
 * JavaScript to work means nobody can get in.
 *
 * The error is a `Callout live` in the page, not a toast: design-system.md §4 reserves toasts
 * for reversible things on the current page, and a refused sign-in is something the person has
 * to act on.
 */
export function StaffLoginForm({ returnTo }: { returnTo: string }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<StaffLoginState, FormData>(signInStaff, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.errorKey ? (
        <Callout tone="danger" live title={t(state.errorKey)}>
          {state.requestId ? <RequestIdNote requestId={state.requestId} /> : null}
        </Callout>
      ) : null}

      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label={t("staff.email")} required requiredLabel={tCommon("state.required")}>
        {/* `username` rather than `email`: password managers key their entry off it. */}
        <Input name="email" type="email" autoComplete="username" autoFocus required />
      </Field>

      <Field label={t("staff.password")} required requiredLabel={tCommon("state.required")}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" size="lg" loading={pending} block>
        {pending ? t("staff.submitting") : t("staff.submit")}
      </Button>
    </form>
  );
}
