import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { serverRequests } from "@/lib/api/requests/server";
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
  const [t, identity] = await Promise.all([
    getTranslations("storefront.footer"),
    // CONTRACT-REQUEST store.company-identity: the registered name and tax id live in settings (D-092).
    serverRequests("customer")
      .then((api) => api.call("GET /v1/store/company-identity"))
      .catch(() => null),
  ]);

  const columns = [
    {
      key: "help",
      links: [
        { key: "howItWorks", href: "/help/how-it-works" },
        { key: "faq", href: "/faq" },
        { key: "articles", href: "/articles" },
        { key: "glossary", href: "/help/glossary" },
        { key: "learn", href: "/learn" },
        { key: "materials", href: "/materials" },
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
    <footer className="bg-fg text-fg-inverse mt-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold">{BRAND_NAME}</p>
          <p className="mt-1 text-sm opacity-80">{t("tagline")}</p>
          <p className="mt-4 flex items-center gap-2 text-sm opacity-80">
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
                  <Link href={link.href} className="text-sm opacity-80 hover:underline hover:opacity-100">
                    {t(`${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-fg-inverse/20 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm opacity-80 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p>
              © {new Date().getFullYear()} {BRAND_NAME} · {BRAND_COMPANY}
            </p>
            {identity ? (
              <>
                <p>{t("operatedBy", { name: identity.legalNameTh, taxId: identity.taxId, branch: identity.branch })}</p>
                <p>{identity.addressTh}</p>
              </>
            ) : null}
          </div>
          <p>{t("paymentMethods")}</p>
        </div>
      </div>
    </footer>
  );
}
