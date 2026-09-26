import { permanentRedirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/** Contact moved to `/contact` (F3 3.1 information architecture). */
export default async function Page() {
  permanentRedirect({ href: "/contact", locale: await getLocale() });
}
