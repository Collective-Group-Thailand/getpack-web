import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { StaffLoginForm } from "@/features/admin/auth/StaffLoginForm";
import { safeReturnTo } from "@/features/shared/auth/return-to";
import { getActor } from "@/lib/auth/actor";
import { Card } from "@/ui";
import { BRAND_NAME } from "@/ui/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("staff.title") };
}

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [t, params, actor] = await Promise.all([getTranslations("auth"), searchParams, getActor("admin")]);

  // Already signed in: send them on, rather than offering a form that would sign them in again.
  const returnTo = safeReturnTo(params.returnTo);
  if (actor) redirect(returnTo);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="mb-6">
        <p className="text-muted text-sm font-medium">{BRAND_NAME}</p>
        {/* The page's one h1. `CardTitle` starts at h2 by design, so the heading lives here. */}
        <h1 className="mt-1 text-2xl font-semibold">{t("staff.title")}</h1>
        <p className="text-muted mt-1 text-sm">{t("staff.subtitle")}</p>
      </div>

      <Card padding="lg" elevation="raised">
        <StaffLoginForm returnTo={returnTo} />
      </Card>
    </main>
  );
}
