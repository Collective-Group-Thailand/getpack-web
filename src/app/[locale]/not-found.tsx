import { getTranslations } from "next-intl/server";
import { NextStep } from "@/features/customer/shell/NextStep";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";

/** A real miss inside this zone. Cross-zone probes never get here — `src/proxy.ts` answers
 * those with a bare 404 before any app code runs. The title is the page's one heading (the UX
 * audit heard it twice when a hidden h1 sat above it). */
export default async function NotFoundPage() {
  const t = await getTranslations("common.errors");

  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col justify-center px-5 py-16 md:px-8">
      <EmptyState
        className="border-none"
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
        illustration={<OpenBoxIllustration />}
      />
    </main>
  );
}
