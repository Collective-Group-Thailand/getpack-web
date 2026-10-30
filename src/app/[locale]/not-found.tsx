import { getTranslations } from "next-intl/server";
import { NextStep } from "@/features/customer/shell/NextStep";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/ui/brand";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";

/** A real miss inside this zone. Cross-zone probes never get here — `src/proxy.ts` answers
 * those with a bare 404 before any app code runs. The title is the page's one heading (the UX
 * audit heard it twice when a hidden h1 sat above it). */
export default async function NotFoundPage() {
  const [t, tNav] = await Promise.all([getTranslations("common.errors"), getTranslations("common.nav")]);

  return (
    // Project A: outside the storefront's frame (an expired or wrong share link, an editor that is gone) — the
    // wordmark home at the top and one centred card: drawing, title, one sentence, the way on.
    <main id="main" className="bg-bg flex min-h-dvh flex-col px-5 py-6 md:px-8">
      <Link href="/" aria-label={tNav("home")} className="self-start">
        <BrandLogo height={24} />
      </Link>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12">
        <EmptyState
          className="py-14"
          titleAs="h1"
          title={t("notFoundTitle")}
          description={t("notFoundBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <NextStep to="home" />
              <NextStep to="search" variant="secondary" />
              <NextStep to="help" variant="ghost" />
            </div>
          }
          illustration={<OpenBoxIllustration className="mb-2 max-w-28" />}
        />
      </div>
    </main>
  );
}
