import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getSharedDesign } from "@/features/customer/designer/api.server";
import { SharedDesign } from "@/features/customer/designer/SharedDesign";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("designer.shared");
  // A shared link is private to whoever holds it: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * A design someone shared (`store.designs.getShared`): a view link needs no account; a comment or
 * edit link (U4.7, D-285) asks to sign in first and comes back here.
 */
export default async function SharedDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) notFound();
  const [shared, locale] = await Promise.all([getSharedDesign(token), getLocale()]);
  if (shared === "sign-in")
    return redirect({ href: `/sign-in?returnTo=${encodeURIComponent(`/design/shared/${token}`)}`, locale });
  if (!shared) notFound();
  return <SharedDesign shared={shared.data} token={token} />;
}
