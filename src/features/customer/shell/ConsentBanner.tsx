"use client";

import { useTranslations } from "next-intl";

import { CONSENT_ALL, CONSENT_DENIED, consentModeSignals } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/useConsent";
import { replayEnabled } from "@/lib/observability/report";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

/**
 * The PDPA consent gate (D-144).
 *
 * Minimal on purpose: two buttons and a link. The full preferences centre — per-purpose
 * toggles, a record of when consent was given, withdrawal — is F3, and it needs an endpoint to
 * store consent against an account. What cannot wait is the gate itself, because GTM must not
 * fire before an answer, and the answer has to be recorded somewhere.
 *
 * "Refuse" is a button of equal weight beside "accept", not a link in the corner. Consent that
 * is harder to refuse than to give is not freely given, which is the PDPA's own test.
 */
/**
 * Pages where the banner would sit on the one control that matters — the studio's canvas, the
 * configurator's price bar, checkout's pay button, the driver's confirm-pickup button on a handover link `/l/d…`
 * (D-463) (UX audit, system-wide). The question waits for
 * the next page; until it is answered nothing is tracked, which is the safe default (D-144).
 */
const QUIET_PATHS = /^\/(?:studio|configure|checkout|design|l)(?:\/|$)/;

export function ConsentBanner() {
  const t = useTranslations("storefront.consent");
  const { asked, save } = useConsent();
  const pathname = usePathname();

  if (asked || QUIET_PATHS.test(pathname)) return null;

  function choose(granted: boolean) {
    const next = granted ? CONSENT_ALL : CONSENT_DENIED;
    save(next);

    // Tell a container that is already running — it will not be, on a first answer, but it
    // will be if someone narrows their choice later from the preferences centre (F3).
    window.dataLayer?.push(["consent", "update", consentModeSignals(next)]);

    /*
     * A full reload, not `router.refresh()`.
     *
     * GTM is not on the page until consent exists, so it has to come from a fresh server
     * render — and `router.refresh()` cannot deliver it: React does not execute a `<script>`
     * that arrives during a client-side update, only one present in the initial HTML. The
     * refresh appeared to work and the container silently never ran, which an e2e test
     * caught by looking at `dataLayer` rather than at the DOM.
     *
     * The cost is one reload, on a button someone presses once a year. Refusing reloads too,
     * so the two paths stay identical and the banner cannot linger in a stale tree.
     */
    window.location.reload();
  }

  return (
    <div
      // A region, not a dialog: it must not trap focus or block the page. Someone reading the
      // privacy policy to decide has to be able to reach it.
      role="region"
      aria-label={t("title")}
      // A phone: a small card floating just above the tab bar (`--mobile-tab-h`), never over it
      // (the "MobileNav" board). From `md`, the same card at the bottom start corner — it never
      // covers a page's width of content, and the help button keeps the other corner.
      className="border-border bg-surface-raised z-sticky shadow-overlay fixed inset-x-3 bottom-[calc(var(--mobile-tab-h)+0.75rem)] rounded-2xl border md:start-6 md:end-auto md:bottom-6 md:w-[26rem]"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 md:px-5 md:py-4">
        <p className="text-muted flex-1 text-sm">
          {t("body")} {replayEnabled ? `${t("replay")} ` : null}
          <Link href="/legal/cookies" className="underline underline-offset-2">
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          {/* Equal weight: refusing must not be harder than accepting. */}
          <Button variant="secondary" size="sm" onClick={() => choose(false)}>
            {t("reject")}
          </Button>
          <Button size="sm" onClick={() => choose(true)}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
