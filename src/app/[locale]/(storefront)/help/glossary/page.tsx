import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { pick } from "@/features/customer/catalog/localize";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { listGlossary } from "@/features/customer/learn/api.server";
import { GlossaryList } from "@/features/customer/learn/GlossaryList";
import { JsonLd } from "@/features/customer/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { definedTermSetSchema } from "@/lib/seo";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.glossary");
  return { title: t("title"), description: t("intro") };
}

/** Packaging words in plain Thai and English (U5.6, U5.2 §3) — where every chip and check links. */
export default async function Page() {
  const [t, terms] = await Promise.all([getTranslations("help.glossary"), listGlossary()]);
  const page = await pageContext("/help/glossary", t("title"));
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <JsonLd data={page.breadcrumb} />
      {terms.length > 0 ? (
        // Every term with its definition as a DefinedTermSet — the markup an answer engine reads
        // for "what is E-flute" (SEO/AEO pass).
        <JsonLd
          data={definedTermSetSchema({
            name: t("title"),
            url: page.url,
            terms: terms.map((term) => ({
              term: pick(page.locale, term.termTh, term.termEn),
              definition: pick(page.locale, term.definitionTh, term.definitionEn),
            })),
          })}
        />
      ) : null}
      <header>
        <h1 className="text-title leading-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>
      <GlossaryList terms={terms} />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/learn">{t("learn")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/help/chat">{t("ask")}</Link>
        </Button>
      </div>
    </div>
  );
}
