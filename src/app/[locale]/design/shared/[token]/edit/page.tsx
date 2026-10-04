import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getDesignerCatalog } from "@/features/customer/catalog/api.server";
import { getSharedDesign } from "@/features/customer/designer/api.server";
import { SharedEditor } from "@/features/customer/designer/SharedEditor";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("designer.shared");
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

/** Editing a shared design through its edit link (U4.7, D-285); any other link goes back to the design. */
export default async function SharedEditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) notFound();
  const [shared, locale] = await Promise.all([getSharedDesign(token), getLocale()]);
  if (shared === "sign-in")
    return redirect({ href: `/sign-in?returnTo=${encodeURIComponent(`/design/shared/${token}/edit`)}`, locale });
  if (!shared) notFound();
  if (shared.data.scope !== "edit") return redirect({ href: `/design/shared/${token}`, locale });
  const catalog = await getDesignerCatalog(shared.data.product.slug || undefined);
  return <SharedEditor token={token} shared={shared.data} etag={shared.etag} catalog={catalog} />;
}
