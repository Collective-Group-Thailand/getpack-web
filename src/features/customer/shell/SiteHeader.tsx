import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountButton } from "@/features/customer/auth/AccountButton";
import { readAccessToken } from "@/lib/auth/session";

import { getCatalogueTree } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { HeaderSearch } from "@/features/customer/search/HeaderSearch";
import { categoryHref } from "@/features/customer/catalog/paths";

import { CustomerBell } from "./CustomerBell";
import { DeferredLocaleMenu, DeferredThemeMenu } from "./DeferredMenus";
import { ProductsMenu } from "./ProductsMenu";
import { Link } from "@/i18n/navigation";
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
  const [t, tCommon, tCatalog, locale, tree, jar] = await Promise.all([
    getTranslations("storefront"),
    getTranslations("common"),
    getTranslations("catalog"),
    getLocale(),
    getCatalogueTree(),
    cookies(),
  ]);
  // Whether there is a session at all — which control to show, not who it is. The proxy has
  // already refreshed an expired access token before this renders.
  const signedIn = Boolean(readAccessToken(jar));

  return (
    <header className="z-sticky border-border bg-surface/90 sticky top-0 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Brand href="/" />

        <nav aria-label={t("nav.primary")} className="ms-4 hidden items-center gap-1 md:flex">
          {tree.length > 0 ? (
            <ProductsMenu label={t("nav.products")}>
              <ul className="grid gap-1 sm:grid-cols-2">
                {tree.map((category) => (
                  <li key={category.code}>
                    <Link
                      href={categoryHref(category.code)}
                      className="hover:bg-bg-subtle focus-visible:ring-focus-ring block rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2"
                    >
                      {pick(locale, category.nameTh, category.nameEn)}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/products"
                className="text-primary mt-3 inline-block px-3 text-sm underline-offset-2 hover:underline"
              >
                {tCatalog("menu.all")}
              </Link>
            </ProductsMenu>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/products">{t("nav.products")}</Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/styles">{t("nav.styles")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/new">{tCommon("nav.startDesigning")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/articles">{t("nav.articles")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/help">{t("nav.help")}</Link>
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
  );
}
