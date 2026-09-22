import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Next 16 replaces middleware.ts with proxy.ts. Today it only does customer-zone locale
 * routing. F1 grows this file into what 00-master-plan.md section 2 describes: host ->
 * zone rewrites (ADMIN_HOST/x -> /admin/x, PARTNER_HOST/x -> /partner/x), 404 for
 * cross-zone paths, access-token refresh before rendering, the CSP nonce and the
 * per-zone security headers.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|bff|_next|_vercel|.*\\..*).*)"],
};
