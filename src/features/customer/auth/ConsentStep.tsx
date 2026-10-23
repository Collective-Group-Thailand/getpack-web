"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link } from "@/i18n/navigation";
import { useConsent } from "@/lib/analytics/useConsent";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";

import { useConsentLabel } from "./consent-label";
import { recordConsents, type Consent, type ConsentSource } from "./onboarding";

/** The optional purposes one "news and offers" tick covers; anything else optional is listed on its own. */
const MARKETING_PURPOSES = new Set(["marketing_email", "marketing_line", "marketing_sms", "personalisation"]);

/**
 * The PDPA consent step after sign-in (F3 3.1; getpack's own consent records, D-005).
 *
 * Two ticks, not seven (owner feedback 2026-10-14): one for what is required — the terms and the
 * privacy notice, read as one line with a link to each — and one, opt-in, for news and offers,
 * which grants every marketing channel at once. "ปรับแต่ง" under it opens the channels one by
 * one for anyone who wants LINE but not SMS. Cookie analytics is not asked again here: the
 * cookie banner already took that answer, and it is carried over as given (or declined when the
 * banner has not been answered). Every purpose the API lists is still recorded, granted or not,
 * so the step does not come back. The texts are the API's, never written here.
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

  const required = consents.filter((consent) => consent.required);
  const marketing = consents.filter((consent) => !consent.required && MARKETING_PURPOSES.has(consent.purpose));
  const analytics = consents.find((consent) => consent.purpose === "analytics_cookies");
  const others = consents.filter(
    (consent) => !consent.required && !MARKETING_PURPOSES.has(consent.purpose) && consent !== analytics,
  );

  const [agreed, setAgreed] = useState(false);
  const [channels, setChannels] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(marketing.map((consent) => [consent.purpose, false])),
  );
  const [otherChoices, setOtherChoices] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(others.map((consent) => [consent.purpose, false])),
  );
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const updated = consents.some((consent) => consent.outdated);
  const allMarketing = marketing.length > 0 && marketing.every((consent) => channels[consent.purpose]);
  const someMarketing = marketing.some((consent) => channels[consent.purpose]);
  const ready = required.length === 0 || agreed;

  const submit = () => {
    setFailed(false);
    startTransition(async () => {
      try {
        await recordConsents(
          consents.map((consent) => ({
            purpose: consent.purpose,
            granted: consent.required
              ? agreed
              : consent === analytics
                ? (cookieConsent?.analytics ?? false)
                : Boolean(channels[consent.purpose] ?? otherChoices[consent.purpose]),
          })),
          source,
        );
        onDone();
      } catch {
        setFailed(true);
      }
    });
  };

  const fullTexts = required.filter((consent) => consent.text);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-muted mt-1 text-sm">{updated ? t("updated") : t("intro")}</p>
      </div>
      {failed ? <Callout tone="danger" live title={t("failed")} /> : null}

      {required.length > 0 ? (
        <Checkbox
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          disabled={pending}
          required
          label={t.rich("agree", {
            terms: (chunks) => (
              <Link href="/legal/terms" target="_blank" className="text-primary underline underline-offset-2">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/legal/privacy" target="_blank" className="text-primary underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
          description={
            fullTexts.length > 0 ? (
              <details>
                <summary className="text-primary cursor-pointer text-sm underline underline-offset-2">
                  {t("readFull")}
                </summary>
                {fullTexts.map((consent) => (
                  <div key={consent.purpose} className="mt-2">
                    <p className="text-sm font-medium">{label(consent).name}</p>
                    <p className="text-muted mt-1 text-sm whitespace-pre-line">{consent.text}</p>
                  </div>
                ))}
              </details>
            ) : undefined
          }
        />
      ) : null}

      {marketing.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Checkbox
            checked={allMarketing ? true : someMarketing ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              setChannels(Object.fromEntries(marketing.map((consent) => [consent.purpose, checked === true])))
            }
            disabled={pending}
            label={t("marketing")}
            description={t("marketingHint")}
          />
          <details className="ps-7">
            <summary className="text-muted cursor-pointer text-sm underline underline-offset-2">
              {t("customise")}
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {marketing.map((consent) => (
                <li key={consent.purpose}>
                  <Checkbox
                    checked={Boolean(channels[consent.purpose])}
                    onCheckedChange={(checked) =>
                      setChannels((current) => ({ ...current, [consent.purpose]: checked === true }))
                    }
                    disabled={pending}
                    label={label(consent).name}
                  />
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      {others.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {others.map((consent) => {
            const { name, description } = label(consent);
            return (
              <li key={consent.purpose}>
                <Checkbox
                  checked={Boolean(otherChoices[consent.purpose])}
                  onCheckedChange={(checked) =>
                    setOtherChoices((current) => ({ ...current, [consent.purpose]: checked === true }))
                  }
                  disabled={pending}
                  label={name}
                  description={description ?? undefined}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      <Button type="button" size="lg" block loading={pending} disabled={!ready} onClick={submit}>
        {pending ? t("saving") : t("accept")}
      </Button>
      <p className="text-muted text-xs">{t("changeLater")}</p>
    </div>
  );
}
