"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

import { rememberProfileAsked, saveProfile } from "./onboarding";

type CustomerType = "individual" | "juristic" | "government";

/**
 * Progressive profiling (F3 3.1): asked once, right after a first sign-in, and skippable — a
 * name, and whether they buy as a person or an organisation (the payment schedule depends on it,
 * D-020). Nothing here is required to use the shop. The e-mail is not asked: it comes from a
 * verified sign-in identity (D-224). Saving records `profileCompletedAt`; skipping is remembered on
 * this browser only.
 */
export function ProfileStep({
  displayName,
  customerId,
  onDone,
}: {
  displayName: string;
  customerId: string;
  onDone: () => void;
}) {
  const t = useTranslations("auth.customer.profile");
  // The API names a new customer after their masked number ("ลูกค้า +66•••••0177") until they say
  // otherwise; that is not a name to hand back as the field's value — the field starts empty
  // with a hint, and only a name the customer typed earlier comes back.
  const [name, setName] = useState(/[•·*]/.test(displayName) ? "" : displayName);
  const [type, setType] = useState<CustomerType>("individual");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveProfile({ displayName: name.trim() || undefined, customerType: type });
        onDone();
      } catch {
        setError(t("failed"));
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-muted mt-1 text-sm">{t("intro")}</p>
      </div>
      {error ? <Callout tone="danger" live title={error} /> : null}

      <Field label={t("name")}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          disabled={pending}
        />
      </Field>
      <Field label={t("type")}>
        <RadioCards<CustomerType>
          value={type}
          onValueChange={setType}
          columns={1}
          options={(["individual", "juristic", "government"] as const).map((value) => ({
            value,
            label: t(`types.${value}`),
          }))}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" block loading={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          block
          disabled={pending}
          onClick={() => {
            rememberProfileAsked(customerId);
            onDone();
          }}
        >
          {t("skip")}
        </Button>
      </div>
    </form>
  );
}
