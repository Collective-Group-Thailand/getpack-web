import { getTranslations, setRequestLocale } from "next-intl/server";

import { CompareDialog } from "@/features/customer/styles/CompareDialog";
import { CompareLimitProvider } from "@/features/customer/styles/compare-store";
import { compareCodes, CompareView } from "@/features/customer/styles/CompareView";

/**
 * The comparison over the library (owner redesign 2026-10-30): the compare route intercepted when the tray opens it,
 * so the grid, its scroll and the chosen styles stay where they were; closing goes back to them.
 */
export default async function CompareModal({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ codes?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ codes, limit }, t] = await Promise.all([
    compareCodes((await searchParams).codes),
    getTranslations("styles"),
  ]);
  return (
    <CompareLimitProvider limit={limit}>
      <CompareDialog title={t("compare.heading")}>
        <CompareView codes={codes} limit={limit} locale={locale} inDialog />
      </CompareDialog>
    </CompareLimitProvider>
  );
}
