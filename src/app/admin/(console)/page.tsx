import { getTranslations } from "next-intl/server";

import { Card } from "@/ui";

/**
 * The admin landing page.
 *
 * Still a placeholder — F2.1 builds the real dashboard — but the shell around it is now real:
 * the sidebar comes from this user's `/v1/admin/me` entitlements, the topbar carries ⌘K, the
 * notification centre and the environment badge, and the signed-in actor moved into the
 * account menu where it belongs.
 */
export default async function AdminHomePage() {
  const t = await getTranslations("admin.placeholder");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <Card className="mt-6" padding="lg">
        <p className="text-muted">{t("body")}</p>
      </Card>
    </div>
  );
}
