import { getTranslations } from "next-intl/server";

import { ContentPage, ContentSection, OnThisPage } from "@/features/customer/content/ContentPage";
import { pageContext } from "@/features/customer/content/page-meta.server";
import { webPageSchema } from "@/lib/seo";

interface Section {
  title: string;
  body: string;
}

/** The date the texts were last revised — bumped by hand with the copy, shown on each legal page. */
export const LEGAL_REVISED = "2026-10-14";

/**
 * One of the legal pages (terms, privacy, cookies): the sections from `pages.legal.<key>` with a
 * table of contents beside them, the revision date, and `WebPage` structured data.
 */
export async function LegalPage({ pageKey, pathname }: { pageKey: "terms" | "privacy" | "cookies"; pathname: string }) {
  const [t, tCommon] = await Promise.all([getTranslations(`pages.legal.${pageKey}`), getTranslations("pages.common")]);
  const page = await pageContext(pathname, t("title"));
  const sections = t.raw("sections") as Section[];
  const items = sections.map((section, index) => ({ id: `${pageKey}-${index + 1}`, title: section.title }));
  const revised = new Intl.DateTimeFormat(page.locale === "th" ? "th-TH-u-ca-gregory" : "en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${LEGAL_REVISED}T00:00:00+07:00`));

  return (
    <ContentPage
      crumbs={page.crumbs}
      crumbLabel={page.crumbLabel}
      title={t("title")}
      lead={tCommon("updated", { date: revised })}
      jsonLd={[
        page.breadcrumb,
        webPageSchema({
          name: t("title"),
          description: t("metaDescription"),
          url: page.url,
          locale: page.language,
          dateModified: LEGAL_REVISED,
        }),
      ]}
      aside={<OnThisPage title={tCommon("contents")} items={items} />}
    >
      {sections.map((section, index) => (
        <ContentSection key={section.title} id={items[index]!.id} title={section.title}>
          {section.body}
        </ContentSection>
      ))}
      <p className="text-muted text-xs">{tCommon("draftNote")}</p>
    </ContentPage>
  );
}
