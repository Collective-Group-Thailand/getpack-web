import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSharedDesign } from "@/features/customer/designer/api.server";
import { SharedDesign } from "@/features/customer/designer/SharedDesign";

export async function generateMetadata() {
  const t = await getTranslations("designer.shared");
  // A shared link is private to whoever holds it: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** A design someone shared: read-only, no account needed (`store.design-share`). */
export default async function SharedDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) notFound();
  const shared = await getSharedDesign(token);
  if (!shared) notFound();
  return <SharedDesign shared={shared} />;
}
