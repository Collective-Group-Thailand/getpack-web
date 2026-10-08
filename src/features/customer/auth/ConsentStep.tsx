"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useConsent } from "@/lib/analytics/useConsent";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";

import { useConsentLabel } from "./consent-label";
import { recordConsents, type Consent, type ConsentSource } from "./onboarding";

/**
 * The PDPA consent step after sign-in (F3 3.1; Packio's own consent records, D-005).
 *
 * Required purposes must each be ticked; optional ones start **unticked** — consent under PDPA
 * is opt-in, never pre-checked — except cookie analytics, which starts as whatever the visitor
 * already chose in the cookie banner, since that is a choice they made. Every purpose shown is
 * recorded, granted or not, so the API holds an answer and the step does not come back.
 * The texts are the API's (`ConsentDto.summary`, `.text`, `versionNo`), never written here.
 */
export function ConsentStep({
  consents,
  source,
  onDone,
}: {
  consents: Consent[];
  source: ConsentSource;
  onDone: () => void;
}) {
  const t = useTranslations("auth.customer.consent");
  const label = useConsentLabel();
  const { consent: cookieConsent } = useConsent();
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      consents.map((consent) => [
        consent.purpose,
        consent.required
          ? false
          : consent.purpose === "analytics_cookies"
            ? (cookieConsent?.analytics ?? false)
            : false,
      ]),
    ),
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const required = consents.filter((consent) => consent.required);
  const optional = consents.filter((consent) => !consent.required);
  const updated = consents.some((consent) => consent.outdated);
  const ready = required.every((consent) => choices[consent.purpose]);

  const submit = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        await recordConsents(
          consents.map((consent) => ({ purpose: consent.purpose, granted: Boolean(choices[consent.purpose]) })),
          source,
        );
        onDone();
      } catch {
        setFailed(true);
      }
    });
  };

  const row = (consent: Consent) => {
    const { name, description } = label(consent);
    return (
      <li key={consent.purpose}>
        <Checkbox
          checked={Boolean(choices[consent.purpose])}
          onCheckedChange={(checked) => setChoices((current) => ({ ...current, [consent.purpose]: checked === true }))}
          disabled={pending}
          required={consent.required}
          label={name}
          description={
            description || consent.text ? (
              <>
                {description ? <span className="block">{description}</span> : null}
                {consent.text ? (
                  <details>
                    <summary className="text-primary cursor-pointer text-sm underline underline-offset-2">
                      {t("readFull")}
                    </summary>
                    <p className="text-muted mt-2 text-sm whitespace-pre-line">{consent.text}</p>
                  </details>
                ) : null}
              </>
            ) : undefined
          }
        />
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-muted mt-1 text-sm">{updated ? t("updated") : t("intro")}</p>
      </div>
      {failed ? <Callout tone="danger" live title={t("failed")} /> : null}

      {required.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t("required")}</legend>
          <ul className="flex flex-col gap-3">{required.map(row)}</ul>
        </fieldset>
      ) : null}
      {optional.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">{t("optional")}</legend>
          <ul className="flex flex-col gap-3">{optional.map(row)}</ul>
        </fieldset>
      ) : null}

      {!ready ? <p className="text-muted text-xs">{t("requiredHint")}</p> : null}
      <Button type="button" size="lg" block loading={pending} disabled={!ready} onClick={submit}>
        {pending ? t("saving") : t("accept")}
      </Button>
    </div>
  );
}
