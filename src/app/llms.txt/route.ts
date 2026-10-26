import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getCatalogueTree, listFaqs } from "@/features/customer/catalog/api.server";
import { categoryHref } from "@/features/customer/catalog/paths";
import { pick } from "@/features/customer/catalog/localize";
import { routing } from "@/i18n/routing";
import { localePath, publicOrigin } from "@/lib/seo";
import { ZONE_CONFIG, ZONE_HEADER, isZone } from "@/lib/zones";
import { BRAND_COMPANY, BRAND_NAME, BRAND_TAGLINE } from "@/ui/brand";

export const dynamic = "force-dynamic";

/**
 * `/llms.txt` (llmstxt.org): what getpack is, in one page an answer engine can read whole — the
 * entity statement, the pages that matter and what each answers, the catalogue's categories,
 * and the public FAQ. Markdown, in the default language with English links beside the Thai
 * ones, built from the same copy and API data the pages use, so it never says something the
 * site does not. Answered on the indexed zone only, like robots and the sitemap.
 */
export async function GET(): Promise<Response> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "customer";
  if (!ZONE_CONFIG[zone].indexable) return new Response("Not found", { status: 404 });

  const locale = routing.defaultLocale;
  const [origin, t, tHow, tAbout, tHome, tree, faqs] = await Promise.all([
    publicOrigin(),
    getTranslations({ locale, namespace: "pages" }),
    getTranslations({ locale, namespace: "pages.howItWorks" }),
    getTranslations({ locale, namespace: "pages.about" }),
    getTranslations({ locale, namespace: "home" }),
    getCatalogueTree(),
    listFaqs().catch(() => []),
  ]);
  const url = (path: string, target = locale) => `${origin}${localePath(path, target)}`;
  const both = (path: string) => `${url(path)} (EN: ${url(path, "en")})`;

  const pages: [string, string, string][] = [
    ["/", `${BRAND_NAME} — ${BRAND_TAGLINE}`, tHome("meta.description")],
    ["/help/how-it-works", tHow("title"), tHow("answer")],
    ["/about", tAbout("title"), tAbout("answer")],
    ["/products", t("llms.products"), t("llms.productsBody")],
    ["/styles", t("llms.styles"), t("llms.stylesBody")],
    ["/studio", t("llms.studio"), t("llms.studioBody")],
    ["/business", t("llms.business"), t("llms.businessBody")],
    ["/faq", t("llms.faq"), t("llms.faqBody")],
    ["/guarantee", t("llms.guarantee"), t("llms.guaranteeBody")],
    ["/network", t("llms.network"), t("llms.networkBody")],
    ["/partner-with-us", t("partner.title"), t("partner.answer")],
    ["/contact", t("llms.contact"), t("llms.contactBody")],
  ];

  const lines: string[] = [
    `# ${BRAND_NAME}`,
    "",
    `> ${tAbout("answer")}`,
    "",
    `${t("llms.operator")}: ${BRAND_COMPANY}. ${t("llms.languages")}`,
    "",
    `## ${t("llms.pagesHeading")}`,
    "",
    ...pages.map(([path, title, body]) => `- [${title}](${url(path)}): ${body} — EN: ${url(path, "en")}`),
    "",
    `## ${t("llms.categoriesHeading")}`,
    "",
    ...tree.map(
      (category) =>
        `- [${pick(locale, category.nameTh, category.nameEn)}](${url(categoryHref(category.code))}): ${category.types
          .map((type) => pick(locale, type.nameTh, type.nameEn))
          .join(", ")}`,
    ),
  ];

  const entries = faqs.flatMap((group) => group.faqs);
  if (entries.length > 0) {
    lines.push("", `## ${t("llms.faqHeading")}`, "");
    for (const faq of entries) {
      lines.push(
        `### ${pick(locale, faq.questionTh, faq.questionEn)}`,
        "",
        pick(locale, faq.answerTh, faq.answerEn),
        "",
      );
    }
  }

  lines.push("", `## ${t("llms.policiesHeading")}`, "", `- ${both("/legal/terms")}`, `- ${both("/legal/privacy")}`, "");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
