import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TrackForm } from "@/features/customer/fulfilment/TrackForm";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/lib/auth/actor";
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
  const [{ locale }, query, t, me] = await Promise.all([
    params,
    searchParams,
    getTranslations("fulfilment.track"),
    getActor("customer"),
  ]);
  const code = (Array.isArray(query.code) ? query.code[0] : query.code)?.trim() ?? "";
  if (/^[A-Za-z0-9_-]{6,64}$/.test(code)) redirect({ href: `/track/${code}`, locale });
  return (
    <div className="max-w-nav mx-auto flex w-full flex-col gap-6 px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
      <header className="max-w-2xl">
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">{t("title")}</h1>
        <p className="text-muted mt-2 text-pretty">{t("intro")}</p>
      </header>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="border-border bg-surface rounded-panel border p-5 md:p-7">
          <TrackForm initial={code} />
        </div>
        {/* Everything you ordered, one sign-in away — on the pale brand tint (Project A: no dark card). */}
        <aside className="bg-primary-subtle rounded-panel flex flex-col items-start gap-3 p-5 md:p-7">
          {/* Signed in already: the orders themselves, not a sign-in prompt. */}
          <p className="serif text-xl">{me ? t("mineTitle") : t("signInTitle")}</p>
          <p className="text-muted text-sm">{me ? t("mineBody") : t("signInBody")}</p>
          <Button asChild variant="secondary">
            <Link href={me ? "/account/orders" : "/sign-in?returnTo=%2Faccount%2Forders"}>
              {me ? t("mineCta") : t("signInCta")}
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
