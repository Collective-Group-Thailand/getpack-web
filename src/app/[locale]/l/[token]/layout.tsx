import { HandoverFrame } from "@/features/customer/handover/HandoverFrame";
import { StorefrontFrame } from "@/features/customer/shell/StorefrontFrame";
import { isDriverToken } from "@/features/shared/deep-links/token";

/**
 * `/l/[token]` sits outside the `(storefront)` group so that its own layout can choose the frame by the token: a
 * driver's handover link `/l/d…` (D-463) gets the bare `HandoverFrame` (the logo, no navigation, no footer, no phone
 * tab bar under its confirm bar); every notification link keeps the storefront's frame, exactly as inside the group.
 */
export default async function LinkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (isDriverToken(token)) return <HandoverFrame>{children}</HandoverFrame>;
  return <StorefrontFrame locale={locale}>{children}</StorefrontFrame>;
}
