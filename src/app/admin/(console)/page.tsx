import { getTranslations } from "next-intl/server";

/**
 * Placeholder for the admin zone: it proves the host → zone rewrite, the root layout,
 * the theme and the per-zone messages all work end to end. The real shell — sidebar from
 * `/v1/admin/me` entitlements, topbar, command palette — is F1 Deliverable 1.3.
 */
export default async function AdminHomePage() {
  const t = await getTranslations("admin.placeholder");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      <p className="text-muted mt-2">{t("body")}</p>
    </main>
  );
}
