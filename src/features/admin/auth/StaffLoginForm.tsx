"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { RequestIdNote } from "@/features/shared/auth/RequestIdNote";
import { Button, Callout, Field, Input } from "@/ui";
import { IconButton } from "@/ui/components/IconButton";

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
export function StaffLoginForm({ returnTo, partnerLoginUrl }: { returnTo: string; partnerLoginUrl: string }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<StaffLoginState, FormData>(signInStaff, {});
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

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
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pe-12"
          />
          <IconButton
            name="eye"
            variant="ghost"
            size="sm"
            label={showPassword ? t("staff.hidePassword") : t("staff.showPassword")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
            className="absolute end-1.5 top-1/2 -translate-y-1/2"
          />
        </div>
      </Field>

      <div className="-mt-1 flex justify-end">
        <button
          type="button"
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          aria-expanded={forgotOpen}
          onClick={() => setForgotOpen((open) => !open)}
        >
          {t("staff.forgot")}
        </button>
      </div>
      {forgotOpen ? (
        // No self-service reset yet (contract request `auth.staff.password-reset`): say who resets it.
        <p className="bg-surface-subtle text-muted rounded-control px-4 py-3 text-sm">{t("staff.forgotBody")}</p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} block>
        {pending ? t("staff.submitting") : t("staff.submit")}
      </Button>

      <div className="text-muted my-2 flex items-center gap-3 text-sm">
        <span aria-hidden className="bg-border h-px flex-1" />
        {t("staff.or")}
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>
      <a
        href={partnerLoginUrl}
        className="text-primary inline-flex items-center justify-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("staff.partnerPortal")}
      </a>
    </form>
  );
}
