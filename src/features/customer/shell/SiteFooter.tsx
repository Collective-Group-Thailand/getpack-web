import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { serverRequests } from "@/lib/api/requests/server";
import { BRAND_COMPANY, BRAND_NAME, BrandMark } from "@/ui/brand";
import { Icon } from "@/ui/icons";

import { DeferredThemeMenu } from "./DeferredMenus";

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
  const [t, tCommon, identity] = await Promise.all([
    getTranslations("storefront.footer"),
    getTranslations("common"),
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
      <div className="max-w-content mx-auto grid gap-10 px-5 pt-14 pb-10 sm:grid-cols-2 md:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display flex items-center gap-2.5 text-xl font-bold">
            <BrandMark size={32} />
            {BRAND_NAME}
          </p>
          <p className="text-fg-inverse/75 mt-3.5 max-w-[28em] text-sm leading-relaxed">
            {t("tagline")} {t("by", { company: BRAND_COMPANY })}
          </p>
          <p className="text-fg-inverse/75 mt-3 flex items-center gap-2 text-sm">
            <Icon name="chat" size={16} />
            {t("lineContact")}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.key} aria-label={t(`${column.key}.heading`)}>
            <h2 className="text-sm font-bold">{t(`${column.key}.heading`)}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-fg-inverse/75 hover:text-fg-inverse focus-visible:ring-fg-inverse rounded-sm text-sm outline-none focus-visible:ring-2"
                  >
                    {t(`${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="max-w-content mx-auto px-5 pb-7 md:px-8">
        <div className="border-fg-inverse/15 text-fg-inverse/70 flex flex-col gap-3 border-t pt-5.5 text-xs sm:flex-row sm:items-start sm:justify-between">
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
          <div className="flex items-center gap-3">
            <p>{t("paymentMethods")}</p>
            {/* The theme choice lives here so the header keeps to the mockup and it stays on every page. */}
            <DeferredThemeMenu
              label={tCommon("theme.label")}
              choiceLabels={{
                system: tCommon("theme.system"),
                light: tCommon("theme.light"),
                dark: tCommon("theme.dark"),
                hc: tCommon("theme.hc"),
              }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
