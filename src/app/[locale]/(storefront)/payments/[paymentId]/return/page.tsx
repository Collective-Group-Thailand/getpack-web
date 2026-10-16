import { redirect } from "@/i18n/navigation";

/**
 * The address getpack-api hands 2C2P as the customer's way back
 * (`${STOREFRONT_BASE_URL}/payments/{paymentId}/return`, `payments.service.ts`). By design the
 * client supplies no return URL (triage assumption A7), so this route answers it and sends the
 * customer on to the return page every other path uses.
 */
export default async function Page({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  return redirect({ href: `/checkout/return?payment=${encodeURIComponent(paymentId)}`, locale });
}
