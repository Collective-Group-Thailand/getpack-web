import { redirect } from "@/i18n/navigation";

/**
 * The address packio-api hands 2C2P as the customer's way back
 * (`${STOREFRONT_BASE_URL}/payments/{paymentId}/return`, `payments.service.ts`). The contract has
 * no `returnUrl` to choose another (CONTRACT-GAP store.payments), so this route answers it and
 * sends the customer on to the return page every other path uses.
 */
export default async function Page({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  return redirect({ href: `/checkout/return?payment=${encodeURIComponent(paymentId)}`, locale });
}
