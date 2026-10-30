import { getLocale } from "next-intl/server";

import { permanentRedirect } from "@/i18n/navigation";

/**
 * Dieline templates live in the style library (owner decision, Project A: no "coming soon" pages — every module
 * is live): `/templates` sends visitors and old links there permanently.
 */
export default async function Page() {
  permanentRedirect({ href: "/styles", locale: await getLocale() });
}
