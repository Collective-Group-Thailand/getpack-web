import { redirect } from "@/i18n/navigation";

/**
 * The share link packio-api hands out with a referral code (`store.referral.get` → `link`,
 * `${STOREFRONT_BASE_URL}/r/{code}`): this route answers it and sends the friend on to the
 * referral landing page.
 */
export default async function Page({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  return redirect({ href: `/referral/${encodeURIComponent(code)}`, locale });
}
