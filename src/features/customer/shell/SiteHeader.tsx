import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountButton } from "@/features/customer/auth/AccountButton";
import { readAccessToken } from "@/lib/auth/session";

import { getCatalogueTree } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { HeaderSearch } from "@/features/customer/search/HeaderSearch";
import { categoryHref } from "@/features/customer/catalog/paths";

import { CustomerBell } from "./CustomerBell";
import { DeferredAssistant, DeferredLocaleMenu, DeferredThemeMenu } from "./DeferredMenus";
import { MobileProductsMenu, ProductsMenu } from "./ProductsMenu";
import { Link } from "@/i18n/navigation";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Brand } from "@/ui/brand";

/**
 * The storefront's top bar.
 *
 * A server component, deliberately: the storefront's initial-JS budget is 150 KB
 * (`docs/performance-budgets.md`), and a header is on every page. Only the three controls that
 * genuinely need state — the language menu, the theme menu and, later, the cart count — are
 * client components.
 *
 * The product menu's links are rendered here, on the server, from the catalogue tree (cached
 * data, `catalog/api.server.ts`); only its open/close is a client component.
 */
export async function SiteHeader() {
  const [t, tCommon, tCatalog, locale, tree, jar, format] = await Promise.all([
    getTranslations("storefront"),
    getTranslations("common"),
    getTranslations("catalog"),
    getLocale(),
    getCatalogueTree(),
    cookies(),
    getFormat(),
  ]);
  // Whether there is a session at all — which control to show, not who it is. The proxy has
  // already refreshed an expired access token before this renders.
  const signedIn = Boolean(readAccessToken(jar));

  // A live automatic promotion is the only thing that earns an announcement (D-181, D-307).
  const campaign = tree.flatMap((category) => category.types).find((type) => type.campaignBadge);

  // The mega menu's columns: every category with its types and how each is priced (D-043).
  const columns = (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((category) => (
          <div key={category.code}>
            <Link
              href={categoryHref(category.code)}
              className="hover:text-primary focus-visible:ring-focus-ring rounded-md text-sm font-semibold outline-none focus-visible:ring-2"
            >
              {pick(locale, category.nameTh, category.nameEn)}
            </Link>
            <ul className="mt-2 flex flex-col gap-1">
              {category.types.map((type) => (
                <li key={type.code}>
                  <Link
                    href={`/products?productType=${encodeURIComponent(type.code)}`}
                    className="hover:bg-bg-subtle focus-visible:ring-focus-ring flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm outline-none focus-visible:ring-2"
                  >
                    <span>{pick(locale, type.nameTh, type.nameEn)}</span>
                    <Badge
                      size="sm"
                      tone={
                        type.availability === "instant"
                          ? "success"
                          : type.availability === "partial"
                            ? "warning"
                            : "info"
                      }
                    >
                      {tCatalog(`card.availability.${type.availability}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="bg-bg-subtle flex flex-col gap-2 rounded-xl p-4 md:w-56">
        <p className="font-semibold">{t("menu.panelTitle")}</p>
        <p className="text-muted text-sm">{t("menu.panelBody")}</p>
        <Link href="/styles" className="text-primary text-sm font-medium underline-offset-4 hover:underline">
          {t("menu.styles")}
        </Link>
        <Link href="/products" className="text-primary text-sm font-medium underline-offset-4 hover:underline">
          {tCatalog("menu.all")}
        </Link>
      </div>
    </div>
  );

  // Below `lg` the primary navigation lives in the menu sheet; seven Thai labels do not fit a tablet.
  const pages: [string, string][] = [
    ["/", tCommon("nav.home")],
    ["/products", t("nav.products")],
    ["/studio/new", t("nav.designOnline")],
    ["/samples", t("nav.pricingSamples")],
    ["/articles", t("nav.articles")],
    ["/contact", t("nav.contact")],
  ];

  return (
    <>
      {campaign?.campaignBadge ? (
        <p className="bg-primary-subtle px-4 py-2 text-center text-sm">
          <Link
            href={`/products?productType=${encodeURIComponent(campaign.code)}`}
            className="underline underline-offset-4"
          >
            {t("announcement", {
              label: campaign.campaignBadge.label,
              type: pick(locale, campaign.nameTh, campaign.nameEn),
              date: format.date(campaign.campaignBadge.endsAt),
            })}
          </Link>
        </p>
      ) : null}
      <header className="z-sticky border-border bg-surface/90 pk-condense sticky top-0 border-b backdrop-blur">
        <div className="pk-condense-row mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <MobileProductsMenu label={t("nav.menu")} closeLabel={tCommon("actions.close")}>
            <ul className="flex flex-col gap-1 text-base font-medium">
              {pages.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:bg-bg-subtle block rounded-lg px-2 py-2">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            {tree.length > 0 ? columns : null}
          </MobileProductsMenu>
          <Brand href="/" />

          <nav aria-label={t("nav.primary")} className="mx-auto hidden items-center gap-1 lg:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">{tCommon("nav.home")}</Link>
            </Button>
            {tree.length > 0 ? (
              <ProductsMenu label={t("nav.products")}>{columns}</ProductsMenu>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href="/products">{t("nav.products")}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/studio/new">{t("nav.designOnline")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/samples">{t("nav.pricingSamples")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/articles">{t("nav.articles")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/contact">{t("nav.contact")}</Link>
            </Button>
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <HeaderSearch label={tCommon("actions.search")} />

            {/*
            LINE is how a Thai customer expects to reach a supplier (D-143, D-151). It is a
            link rather than an embedded widget: a third-party chat script on every storefront
            page would cost more than the budget allows and would need its own CSP origin.
          */}
            <IconButton asChild name="chat" variant="ghost" size="sm" label={t("nav.lineChat")}>
              <Link href="/help/chat" />
            </IconButton>

            <IconButton asChild name="cart" variant="ghost" size="sm" label={t("nav.cart")}>
              <Link href="/cart" />
            </IconButton>

            <DeferredAssistant signedIn={signedIn} />
            <AccountButton signedIn={signedIn} label={t("nav.account")} />

            {/* A guest has no notifications; the bell (a Popover and a query) is for a session. */}
            {signedIn ? <CustomerBell /> : null}
            <DeferredLocaleMenu />
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
      </header>
    </>
  );
}
