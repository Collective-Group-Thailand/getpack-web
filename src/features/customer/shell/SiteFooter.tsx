import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand";
import { Icon } from "@/ui/icons";

/**
 * The storefront footer: help, contact, the ways to pay, and the legal links PDPA requires
 * somewhere reachable from every page.
 *
 * Payment methods are named in words, not with card-scheme logos — CLAUDE.md forbids
 * third-party assets, and a list a screen reader can read is better than a row of images
 * anyway. F3.5 replaces this with the methods the API actually says are enabled, rather than
 * a hard-coded list.
 */
export async function SiteFooter() {
  const t = await getTranslations("storefront.footer");

  const columns = [
    {
      key: "help",
      links: [
        { key: "howItWorks", href: "/help/how-it-works" },
        { key: "faq", href: "/faq" },
        { key: "articles", href: "/articles" },
        { key: "glossary", href: "/help/glossary" },
        { key: "track", href: "/track" },
      ],
    },
    {
      key: "company",
      links: [
        { key: "about", href: "/about" },
        { key: "guarantee", href: "/guarantee" },
        { key: "network", href: "/network" },
        { key: "reviews", href: "/reviews" },
        { key: "partner", href: "/partner-with-us" },
        { key: "contact", href: "/contact" },
      ],
    },
    {
      key: "legal",
      links: [
        { key: "terms", href: "/legal/terms" },
        { key: "privacy", href: "/legal/privacy" },
        { key: "cookies", href: "/legal/cookies" },
      ],
    },
  ] as const;

  return (
    <footer className="border-border bg-bg-subtle mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold">{BRAND_NAME}</p>
          <p className="text-muted mt-1 text-sm">{t("tagline")}</p>
          <p className="text-muted mt-4 flex items-center gap-2 text-sm">
            <Icon name="chat" size={16} />
            {t("lineContact")}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.key} aria-label={t(`${column.key}.heading`)}>
            <h2 className="text-sm font-medium">{t(`${column.key}.heading`)}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} className="text-muted hover:text-fg text-sm">
                    {t(`${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-border border-t">
        <div className="text-muted mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME} · {BRAND_COMPANY}
          </p>
          <p>{t("paymentMethods")}</p>
        </div>
      </div>
    </footer>
  );
}
