import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { serverRequests } from "@/lib/api/requests/server";
import { BRAND_COMPANY, BRAND_NAME, BrandMark } from "@/ui/brand";
import { Icon } from "@/ui/icons";

import { emptyContent } from "./content.server";
import { DeferredThemeMenu } from "./DeferredMenus";

/**
 * The storefront footer, to the V4 board (design language v3: on the paper, under a hairline): the
 * studio, ordering, Packio and help columns, the ways to pay, and the legal links PDPA requires
 * somewhere reachable from every page.
 *
 * Payment methods are named in words, not with card-scheme logos — CLAUDE.md forbids
 * third-party assets, and a list a screen reader can read is better than a row of images
 * anyway. F3.5 replaces this with the methods the API actually says are enabled, rather than
 * a hard-coded list.
 */
export async function SiteFooter() {
  const [t, tCommon, identity, empty] = await Promise.all([
    getTranslations("storefront.footer"),
    getTranslations("common"),
    // CONTRACT-REQUEST store.company-identity: the registered name and tax id live in settings (D-092).
    serverRequests("customer")
      .then((api) => api.call("GET /v1/store/company-identity"))
      .catch(() => null),
    emptyContent(),
  ]);

  // The V4 board's columns — studio, ordering, Packio — then help and the legal links PDPA requires.
  const columns = [
    {
      key: "studio",
      links: [
        { key: "start", href: "/studio" },
        { key: "templates", href: "/studio/templates" },
        { key: "learn", href: "/learn" },
        { key: "materials", href: "/materials" },
      ].filter((link) => !empty.has(link.href)),
    },
    {
      key: "order",
      links: [
        { key: "products", href: "/products" },
        { key: "upload", href: "/studio/upload" },
        { key: "business", href: "/business" },
        { key: "track", href: "/track" },
      ],
    },
    {
      key: "company",
      links: [
        { key: "about", href: "/about" },
        { key: "network", href: "/network" },
        { key: "partner", href: "/partner-with-us" },
        { key: "guarantee", href: "/guarantee" },
        { key: "reviews", href: "/reviews" },
        { key: "contact", href: "/contact" },
      ],
    },
    {
      key: "help",
      links: [
        { key: "faq", href: "/faq" },
        { key: "howItWorks", href: "/help/how-it-works" },
        { key: "articles", href: "/articles" },
        { key: "glossary", href: "/help/glossary" },
      ].filter((link) => !empty.has(link.href)),
    },
  ] as const;
  const legal = [
    { key: "terms", href: "/legal/terms" },
    { key: "privacy", href: "/legal/privacy" },
    { key: "cookies", href: "/legal/cookies" },
  ] as const;

  return (
    <footer className="max-w-nav mx-auto mt-16 w-full px-5 pb-10 md:px-8 xl:px-12">
      <div className="border-border grid gap-10 border-t pt-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-12">
        <div>
          <p className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.02em]">
            <BrandMark size={28} />
            {BRAND_NAME}
          </p>
          <p className="text-muted mt-2.5 max-w-[26em] text-[13px] leading-relaxed">
            {t("tagline")} {t("by", { company: BRAND_COMPANY })}
          </p>
          <p className="text-muted mt-3 flex items-center gap-2 text-[13px]">
            <Icon name="chat" size={16} aria-hidden="true" />
            {t("lineContact")}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.key} aria-label={t(`${column.key}.heading`)}>
            <h2 className="text-[13px] font-semibold tracking-normal">{t(`${column.key}.heading`)}</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {column.links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-muted hover:text-fg focus-visible:ring-focus-ring rounded-sm text-[0.90625rem] leading-loose outline-none focus-visible:ring-2"
                  >
                    {t(`${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="text-muted mt-10 flex flex-col gap-3 text-[13px] lg:flex-row lg:items-start lg:justify-between">
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
          <nav aria-label={t("legal.heading")}>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {legal.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="hover:text-fg focus-visible:ring-focus-ring rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                  >
                    {t(`legal.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <p>{t("paymentMethods")}</p>
          {/* The theme choice lives here so the header keeps to the board and it stays on every page. */}
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
    </footer>
  );
}
