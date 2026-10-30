import { getTranslations } from "next-intl/server";
import { NextStep } from "@/features/customer/shell/NextStep";
import { EmptyState } from "@/ui/components/EmptyState";
import { OpenBoxIllustration } from "@/ui/components/ProductIllustration";

/**
 * A miss inside the storefront, rendered inside its layout so the header and footer stay (UX
 * audit: a 404 without the shell is a dead end). The title is the page's one heading.
 */
export default async function StorefrontNotFound() {
  const t = await getTranslations("common.errors");

  return (
    // Inside the shell's own <main>: a section, one centred card (Project A) — drawing, title, one sentence, the
    // ways on (also what an invalid quote or tracking link shows).
    <section className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col justify-center px-5 py-14 md:py-20">
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
    </section>
  );
}
