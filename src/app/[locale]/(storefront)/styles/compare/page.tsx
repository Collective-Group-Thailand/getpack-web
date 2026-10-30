import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CompareLimitProvider } from "@/features/customer/styles/compare-store";
import { compareCodes, CompareView } from "@/features/customer/styles/CompareView";
import { STYLES_HREF } from "@/features/customer/styles/paths";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type SearchParams = Promise<{ codes?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("styles");
  // A comparison is a view of styles that have pages of their own.
  return { title: t("meta.compareTitle"), robots: { index: false, follow: true } };
}

/** Up to three styles side by side (U3.5 §1, D-246) — the page a shared link opens; the library opens the same
 * view in a dialog over the grid (`@modal/(.)compare`). */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ codes, limit }, t] = await Promise.all([
    compareCodes((await searchParams).codes),
    getTranslations("styles"),
  ]);
  return (
    <CompareLimitProvider limit={limit}>
      <div className="max-w-nav mx-auto px-5 pt-6 pb-16 md:px-8 md:pt-8 md:pb-20 xl:px-12">
        <Breadcrumbs
          label={t("breadcrumbs.library")}
          items={[{ label: t("breadcrumbs.library"), href: STYLES_HREF }, { label: t("compare.heading") }]}
        />
        <h1 className="mt-3 mb-6 text-[1.75rem] leading-[1.15] font-semibold tracking-tight md:text-[2.25rem]">
          {t("compare.heading")}
        </h1>
        <CompareView codes={codes} limit={limit} locale={locale} />
      </div>
    </CompareLimitProvider>
  );
}
