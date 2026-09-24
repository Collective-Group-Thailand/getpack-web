import { CONSENT_DENIED, consentModeSignals, parseConsent, CONSENT_COOKIE } from "@/lib/analytics/consent";
import { clientEnv } from "@/lib/env";
import { getNonce } from "@/lib/security/nonce";
import { cookies } from "next/headers";

/**
 * GTM, on the customer host only (D-102) and **not loaded at all until consent is given**.
 *
 * Google's own guidance is to load the container always and let Consent Mode restrict the tags
 * inside it. That is not enough here. Loading `googletagmanager.com` is itself a request to
 * Google carrying the visitor's IP and referrer — a transfer of personal data to a third-party
 * processor, before the person has agreed to one. An e2e test asserts that no Google request
 * leaves the browser before an answer, and with the container loading unconditionally it
 * failed, which is how this was caught.
 *
 * So the gate is the render. A refusal means GTM never exists on the page; accepting triggers
 * a `router.refresh()` from the banner, the server re-renders with the cookie, and the
 * container appears without a reload.
 *
 * Consent Mode is still set, first, in the same inline script. It matters from the moment GTM
 * *does* load: the container carries tags this app does not control, and `analytics` and
 * `marketing` are separate purposes (D-144) — accepting measurement is not accepting ad
 * personalisation.
 *
 * Admin and partner never render this, and `src/lib/security/csp.ts` allows the Google origins
 * on the customer zone only — two locks, and the CSP is the one that holds if this component
 * is ever misplaced.
 */
export async function GoogleTagManager() {
  const containerId = clientEnv.NEXT_PUBLIC_GTM_ID;
  if (!containerId) return null;

  // Without the request nonce the inline script is refused by `script-src`, so emitting it
  // would only produce a console violation on every page.
  const nonce = await getNonce();
  if (!nonce) return null;

  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value) ?? CONSENT_DENIED;
  // No consent, no container. Not even the loader.
  if (!consent.analytics && !consent.marketing) return null;

  const snippet = `
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',${JSON.stringify(consentModeSignals(consent))});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.nonce=${JSON.stringify(nonce)};
f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(containerId)});`.trim();

  // `j.nonce` above matters as much as the nonce on this tag: `'strict-dynamic'` lets a nonced
  // script load others, but GTM then injects further scripts of its own, and those inherit
  // nothing unless the loader carries the nonce forward.
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: snippet }} />;
}
