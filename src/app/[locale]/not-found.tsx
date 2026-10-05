import { getTranslations } from "next-intl/server";
import { NextStep } from "@/features/customer/shell/NextStep";
import { EmptyState } from "@/ui/components/EmptyState";

/** A real miss inside this zone. Cross-zone probes never get here — `src/proxy.ts` answers
 * those with a bare 404 before any app code runs. */
export default async function NotFoundPage() {
  const t = await getTranslations("common.errors");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16">
      <h1 className="sr-only">{t("notFoundTitle")}</h1>
      <EmptyState
        icon="search"
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <>
            <NextStep to="home" />
            <NextStep to="search" variant="secondary" />
            <NextStep to="help" variant="ghost" />
          </>
        }
      />
    </main>
  );
}
