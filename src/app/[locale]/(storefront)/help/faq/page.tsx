import { getLocale } from "next-intl/server";

import { permanentRedirect } from "@/i18n/navigation";

/** The FAQ moved to `/faq` (F3 3.1 information architecture). */
export default async function Page() {
  permanentRedirect({ href: "/faq", locale: await getLocale() });
}
