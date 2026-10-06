import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TrackForm } from "@/features/customer/fulfilment/TrackForm";
import { Link, redirect } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fulfilment.track");
  return { title: t("title"), description: t("intro") };
}

/**
 * Tracking by the code on the carton label or in a shared link (F3 3.6). A link from an SMS or LINE
 * may carry it as `?code=` (UX audit): a valid one goes straight to the result.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const [{ locale }, query, t] = await Promise.all([params, searchParams, getTranslations("fulfilment.track")]);
  const code = (Array.isArray(query.code) ? query.code[0] : query.code)?.trim() ?? "";
  if (/^[A-Za-z0-9_-]{6,64}$/.test(code)) redirect({ href: `/track/${code}`, locale });
  return (
    <div className="max-w-content mx-auto flex w-full flex-col gap-8 px-5 py-10 md:px-8 md:py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="border-border bg-surface rounded-card border p-6">
          <TrackForm initial={code} />
        </div>
        <aside className="bg-primary-subtle rounded-card flex flex-col items-start gap-3 p-6">
          <p className="font-semibold">{t("signInTitle")}</p>
          <p className="text-muted text-sm">{t("signInBody")}</p>
          <Button asChild variant="secondary">
            <Link href="/sign-in?returnTo=%2Faccount%2Forders">{t("signInCta")}</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
