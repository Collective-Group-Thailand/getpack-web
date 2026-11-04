"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { SHOWCASE_SCOPES, type ShowcaseConsent, type ShowcaseScope } from "@/lib/api/requests/store-loyalty-p2";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

/** The consent text the form shows; getpack-api refuses an older one (422 `showcase.text_outdated`). */
export const SHOWCASE_TEXT_VERSION = "2026-11-v1";

/**
 * Consent for getpack to show a customer's work (loyalty P2, D-490): what may be shown (brand name, logo, packaging
 * photos, a review quote), the versioned consent text, and the status — รอตรวจสอบ / อนุมัติแล้ว / ไม่อนุมัติ /
 * ถอนแล้ว. Marketing approves; the reward (the API's `rewardPoints`) is paid on approval, once. Withdrawing is always
 * possible and never takes the reward back.
 */
export function ShowcaseConsentForm({ initial }: { initial: ShowcaseConsent }) {
  const t = useTranslations("account.showcase");
  const format = useFormat();
  const router = useRouter();
  const [consent, setConsent] = useState(initial);
  const [scope, setScope] = useState<ShowcaseScope[]>(initial.scope.length ? initial.scope : []);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = consent.status === "requested" || consent.status === "approved";

  const send = async (granted: boolean) => {
    setError(null);
    if (granted && (!scope.length || !agreed)) {
      setError(!scope.length ? t("pickScope") : t("agreeFirst"));
      return;
    }
    setBusy(true);
    try {
      const next = await browserRequests().call("PUT /v1/store/loyalty/showcase-consent", {
        body: granted ? { granted: true, scope, consentTextVersion: SHOWCASE_TEXT_VERSION } : { granted: false },
      });
      setConsent(next);
      setAgreed(false);
      toast.success(granted ? t("sent") : t("withdrawn"));
      router.refresh();
    } catch (failure) {
      const code = isApiError(failure) ? failure.code : "";
      setError(
        code === "showcase.consent_pending"
          ? t("pending")
          : code === "showcase.text_outdated"
            ? t("outdated")
            : t("failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {consent.status !== "none" ? (
        <p className="border-border bg-surface rounded-card flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-3 text-sm">
          <Badge tone={consent.status === "approved" ? "success" : "neutral"} size="sm">
            {t(`status.${consent.status}`)}
          </Badge>
          <span className="text-muted">
            {consent.status === "requested" && consent.requestedAt
              ? t("requestedOn", { date: format.date(consent.requestedAt) })
              : consent.decidedAt
                ? t("decidedOn", { date: format.date(consent.decidedAt) })
                : null}
          </span>
          {consent.scope.length ? (
            <span className="text-muted basis-full">
              {consent.scope.map((entry) => t(`scopes.${entry}`)).join(" · ")}
            </span>
          ) : null}
        </p>
      ) : null}

      {active ? null : (
        <form
          noValidate
          className="border-border bg-surface rounded-panel flex flex-col gap-5 border p-5 md:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void send(true);
          }}
        >
          <fieldset className="m-0 border-0 p-0">
            <legend className="p-0 text-[0.9375rem] font-semibold">{t("scopeTitle")}</legend>
            <p className="text-muted mt-0.5 text-sm">{t("scopeHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SHOWCASE_SCOPES.map((entry) => (
                <Checkbox
                  key={entry}
                  label={t(`scopes.${entry}`)}
                  checked={scope.includes(entry)}
                  onCheckedChange={(on) =>
                    setScope(on === true ? [...scope, entry] : scope.filter((value) => value !== entry))
                  }
                />
              ))}
            </div>
          </fieldset>

          <div className="bg-bg-subtle rounded-card px-4 py-3.5 text-[0.84375rem] leading-relaxed">
            <p className="flex items-center gap-2 font-medium">
              <Icon name="shield" size={16} aria-hidden="true" />
              {t("consentTitle")}
            </p>
            <p className="text-muted mt-1.5">{t("consentText")}</p>
            <p className="text-subtle mt-1.5 text-xs">{t("version", { version: SHOWCASE_TEXT_VERSION })}</p>
          </div>
          <Checkbox label={t("agree")} checked={agreed} onCheckedChange={(on) => setAgreed(on === true)} />

          {error ? (
            <p role="alert" className="text-danger flex items-center gap-1.5 text-sm">
              <Icon name="error" size={14} aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted text-sm">
              {consent.rewardPoints > 0
                ? t.rich("reward", {
                    points: format.number(consent.rewardPoints),
                    b: (chunk) => <b className="text-primary-subtle-fg font-semibold">{chunk}</b>,
                  })
                : null}
            </p>
            <Button type="submit" loading={busy}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}

      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted text-sm">{t("withdrawHint")}</p>
          <Button variant="secondary" loading={busy} onClick={() => void send(false)}>
            {t("withdraw")}
          </Button>
        </div>
      ) : null}
      {active && error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
