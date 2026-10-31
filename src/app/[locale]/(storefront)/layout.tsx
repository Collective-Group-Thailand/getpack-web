import { StorefrontFrame } from "@/features/customer/shell/StorefrontFrame";

/**
 * Every storefront page shares one frame: header, footer and the phone bottom nav (`StorefrontFrame`).
 *
 * A route group, so none of this appears in a URL. Some customer routes deliberately sit *outside* it and keep the
 * full viewport: `/design/[id]`, where the canvas is the product and site chrome would compete with it
 * (design-system.md §5 Designer), `/sign-in`, which is a single task with no navigation to offer, `/liff` (LINE's
 * own frame), and `/l/[token]`, whose layout gives a notification link this same frame and a driver's handover link a
 * bare one.
 */
export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StorefrontFrame locale={locale}>{children}</StorefrontFrame>;
}
