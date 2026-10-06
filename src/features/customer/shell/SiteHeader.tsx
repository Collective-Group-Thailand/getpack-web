import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountButton } from "@/features/customer/auth/AccountButton";
import { CartButton } from "@/features/customer/cart/CartButton";
import { readAccessToken } from "@/lib/auth/session";

import { getCatalogueTree } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { HeaderSearch } from "@/features/customer/search/HeaderSearch";
import { categoryHref } from "@/features/customer/catalog/paths";

import { CustomerBell } from "./CustomerBell";
import { emptyContent } from "./content.server";
import { DeferredAssistant, DeferredLocaleMenu } from "./DeferredMenus";
import { MoreLinks } from "./MoreLinks";
import { MobileProductsMenu, ProductsMenu } from "./ProductsMenu";
import { Link } from "@/i18n/navigation";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { Brand } from "@/ui/brand";
import { cn } from "@/ui/lib/cn";

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
  const [t, tCommon, tCatalog, locale, tree, jar, format, empty] = await Promise.all([
    getTranslations("storefront"),
    getTranslations("common"),
    getTranslations("catalog"),
    getLocale(),
    getCatalogueTree(),
    cookies(),
    getFormat(),
    emptyContent(),
  ]);
  // No articles yet: the link waits until there is something to read (UX audit).
  const showArticles = !empty.has("/articles");
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

  const navLink =
    "text-fg/85 hover:bg-bg-subtle hover:text-fg focus-visible:ring-focus-ring inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2";

  // Below `lg` the primary navigation lives in the menu sheet; seven Thai labels do not fit a tablet.
  const pages: [string, string][] = [
    ["/", tCommon("nav.home")],
    ["/products", t("nav.products")],
    ["/studio/new", t("nav.designOnline")],
    ["/samples", t("nav.pricingSamples")],
    ...(showArticles ? ([["/articles", t("nav.articles")]] as [string, string][]) : []),
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
        <div className="pk-condense-row max-w-nav mx-auto flex h-14 items-center gap-2 px-3 md:h-16 md:px-4 lg:grid lg:h-22 lg:grid-cols-[auto_1fr_auto] lg:gap-10 lg:px-10">
          <div className="flex items-center gap-2">
            <MobileProductsMenu
              label={t("nav.menu")}
              closeLabel={tCommon("actions.close")}
              headerEnd={<DeferredLocaleMenu />}
              footer={
                <Button asChild size="lg" shape="pill" block iconStart="chat">
                  <Link href="/help/chat">{t("drawer.line")}</Link>
                </Button>
              }
            >
              {/* The "MobileNav" board's drawer: who you are, where to go, the categories, help. */}
              {signedIn ? (
                <ul className="border-border mb-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["/account", t("nav.account"), "user"],
                      ["/account/orders", t("drawer.orders"), "package"],
                      ["/account/notifications", t("drawer.notifications"), "bell"],
                      ["/help/chat", t("nav.lineChat"), "chat"],
                    ] as const
                  ).map(([href, label, icon]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="border-border flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium"
                      >
                        <Icon name={icon} size={18} aria-hidden="true" />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border-border bg-bg-subtle mb-4 flex items-center gap-3 rounded-2xl border p-4">
                  <span className="bg-primary-subtle text-primary grid size-10 shrink-0 place-items-center rounded-full">
                    <Icon name="user" size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px]">{t("drawer.guestTitle")}</b>
                    <small className="text-muted">{t("drawer.guestBody")}</small>
                  </span>
                  <Button asChild size="md" shape="pill">
                    <Link href="/sign-in">{t("nav.signIn")}</Link>
                  </Button>
                </div>
              )}
              <ul className="divide-border border-border divide-y border-y">
                {(
                  [
                    ["/products", t("nav.quote"), true],
                    ["/studio/new", t("nav.designOnline"), false],
                    ["/samples", t("nav.pricingSamples"), false],
                    ["/track", t("drawer.track"), false],
                  ] as const
                ).map(([href, label, lead]) => (
                  <li key={href}>
                    <Link href={href} className="flex min-h-12 items-center justify-between text-base font-medium">
                      {label}
                      <Icon
                        name={lead ? "arrow-right" : "chevron-right"}
                        size={18}
                        aria-hidden="true"
                        className={lead ? "text-primary" : "text-muted"}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {tree.length > 0 ? (
                <section aria-labelledby="drawer-categories" className="mt-6">
                  <h2 id="drawer-categories" className="eyebrow mb-3 text-[11px] tracking-[0.06em]">
                    {t("drawer.categories")}
                  </h2>
                  <ul className="grid grid-cols-2 gap-2">
                    {tree.slice(0, 7).map((category) => (
                      <li key={category.code}>
                        <Link
                          href={`/products/${encodeURIComponent(category.code)}`}
                          className="border-border flex min-h-14 items-center gap-2.5 rounded-xl border px-3 text-sm leading-tight"
                        >
                          <ProductThumb
                            family={productFamilyOf(category.code)}
                            className="size-8 rounded-lg [&_svg]:max-w-6"
                          />
                          {pick(locale, category.nameTh, category.nameEn)}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        href="/products"
                        className="border-primary/40 text-primary flex min-h-14 items-center gap-2.5 rounded-xl border border-dashed px-3 text-sm leading-tight font-semibold"
                      >
                        <Icon name="plus" size={18} aria-hidden="true" />
                        {t("drawer.allCategories", { count: tree.length })}
                      </Link>
                    </li>
                  </ul>
                </section>
              ) : null}
              <section aria-labelledby="drawer-help" className="mt-6">
                <h2 id="drawer-help" className="eyebrow mb-1 text-[11px] tracking-[0.06em]">
                  {t("drawer.help")}
                </h2>
                <ul className="divide-border divide-y">
                  {pages
                    .filter(([href]) => href === "/articles" || href === "/contact")
                    .concat([["/faq", t("drawer.faq")]])
                    .map(([href, label]) => (
                      <li key={href}>
                        <Link href={href} className="flex min-h-12 items-center justify-between text-base">
                          {label}
                          <Icon name="chevron-right" size={18} aria-hidden="true" className="text-muted" />
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            </MobileProductsMenu>
            <Brand href="/" className="text-xl lg:text-2xl" />
          </div>

          {/* The logo is the way home on a desktop, so the bar keeps five destinations (mockup, 2026-10-06). */}
          <nav aria-label={t("nav.primary")} className="hidden items-center justify-center gap-2 lg:flex xl:gap-6">
            {tree.length > 0 ? (
              <ProductsMenu label={t("nav.products")}>{columns}</ProductsMenu>
            ) : (
              <Link href="/products" className={navLink}>
                {t("nav.products")}
              </Link>
            )}
            <Link href="/studio/new" className={navLink}>
              {t("nav.designOnline")}
            </Link>
            <Link href="/samples" className={cn(navLink, "hidden xl:inline-flex")}>
              {t("nav.pricingSamples")}
            </Link>
            {showArticles ? (
              <Link href="/articles" className={cn(navLink, "hidden xl:inline-flex")}>
                {t("nav.articles")}
              </Link>
            ) : null}
            <Link href="/contact" className={cn(navLink, "hidden xl:inline-flex")}>
              {t("nav.contact")}
            </Link>
            <MoreLinks
              label={t("nav.more")}
              links={[
                ["/samples", t("nav.pricingSamples")],
                ...(showArticles ? ([["/articles", t("nav.articles")]] as [string, string][]) : []),
                ["/contact", t("nav.contact")],
              ]}
            />
          </nav>

          <div className="ms-auto flex items-center gap-1 lg:ms-0">
            <HeaderSearch label={tCommon("actions.search")} />

            {/*
            LINE is how a Thai customer expects to reach a supplier (D-143, D-151). On a phone it
            stays in the bar; on a desktop the home page's contact band and the footer carry it,
            so the bar keeps to the mockup's search · cart · language.
          */}
            {/* A phone's bar keeps four controls (the "MobileNav" board); LINE, the language and the
                account are in the menu and the bottom bar there. */}
            <IconButton
              asChild
              name="chat"
              variant="ghost"
              size="sm"
              label={t("nav.lineChat")}
              className="hidden md:inline-flex lg:hidden"
            >
              <Link href="/help/chat" />
            </IconButton>

            <CartButton signedIn={signedIn} label={t("nav.cart")} />

            <span className="hidden items-center gap-1 md:flex">
              <DeferredAssistant signedIn={signedIn} />
              {/* A guest has no notifications; the bell (a Popover and a query) is for a session. */}
              {signedIn ? <CustomerBell /> : null}
              <DeferredLocaleMenu />
            </span>

            <span aria-hidden className="bg-border mx-2 hidden h-6 w-px lg:block" />
            <span className="hidden md:contents">
              <AccountButton signedIn={signedIn} label={t("nav.account")} signInLabel={t("nav.signIn")} />
            </span>
            <Button asChild size="md" className="ms-2 hidden rounded-xl lg:inline-flex">
              <Link href="/products">{t("nav.quote")}</Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
