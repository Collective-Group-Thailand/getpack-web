import "server-only";

import { getLocale } from "next-intl/server";

import { safeReturnTo } from "@/features/shared/auth/return-to";
import { redirect } from "@/i18n/navigation";
import type { CustomerMe } from "@/lib/api/types";
import { getActor } from "@/lib/auth/actor";
import { currentPathname } from "@/lib/seo";

/**
 * The signed-in customer, or a redirect to `/sign-in` that brings them back here.
 *
 * `returnTo` is the path without its locale prefix: the sign-in page navigates with the
 * locale-aware router, which adds `/en` itself. This hides pages — the API is what refuses a
 * request without a customer token (ADR-0005).
 */
export async function requireCustomer(): Promise<CustomerMe> {
  const actor = await getActor("customer");
  if (actor) return actor;
  const [locale, path] = await Promise.all([getLocale(), currentPathname()]);
  const returnTo = safeReturnTo(path);
  return redirect({
    href: returnTo === "/" ? "/sign-in" : `/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
    locale,
  });
}
