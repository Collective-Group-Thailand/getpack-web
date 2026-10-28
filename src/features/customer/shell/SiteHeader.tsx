import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountButton } from "@/features/customer/auth/AccountButton";
import { CartButton } from "@/features/customer/cart/CartButton";
import { getActor } from "@/lib/auth/actor";
import { readAccessToken } from "@/lib/auth/session";

import { getCatalogueTree } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";
import { HeaderSearch } from "@/features/customer/search/HeaderSearch";
import { STYLES_HREF } from "@/features/customer/styles/paths";

import { emptyContent } from "./content.server";
import { DeferredAssistant, DeferredLocaleMenu } from "./DeferredMenus";
import { HeaderCta } from "./HeaderCta";
import { HeaderNavLink } from "./HeaderNavLink";
import { MobileProductsMenu } from "./ProductsMenu";
import { Link } from "@/i18n/navigation";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { ProductThumb, productFamilyOf } from "@/ui/components/ProductIllustration";
import { Icon } from "@/ui/icons";
import { Brand } from "@/ui/brand";

/**
 * The storefront's top bar, to the V4 "Main" board (design language v3): the logo, five links —
 * สตูดิโอออกแบบ · แบบกล่อง · สินค้าและราคา · สำหรับธุรกิจ · ติดต่อ — and the tools: search, the cart
 * with its count, the language, a divider, sign-in or the customer's avatar and name, and the
 * primary "เริ่มออกแบบฟรี". 76 px on the paper, over a hairline. A phone has the menu, the logo,
 * search and the cart; the drawer lists the same five links in the same order.
 *
 * A server component, deliberately: the storefront's initial-JS budget is 150 KB
 * (`docs/performance-budgets.md`), and a header is on every page. Only the controls that need
 * state — the drawer, the language menu, the cart count and the account menu — are client
 * components.
 *
 * Width budget (styles redesign polish 1): the primary action shows at every width from 1040 px.
 * Between 1040 and 1184 px the bar is compact — tighter logo-to-nav gap, link padding and CTA
 * padding — and from 1184 px it takes the roomier spacing, so both locales keep at least 8 px
 * between the logo, the nav and the tools throughout. The current section's link carries
 * `aria-current="page"` and the tinted pill. `e2e/storefront-header.spec.ts` guards it.
 *
 * The bar becomes the drawer below 1040 px, and its middle track is `minmax(0, 1fr)` with the nav
 * centred *safely*, so the five links never spread over the logo or under the tools (styles
 * redesign, PLAN.md §d: a signed-in name pushed them there between 1024 and ~1150 px). The account
 * shows initials only; the full name is its tooltip and the menu's first line.
 */
export async function SiteHeader() {
  const [t, tCommon, locale, tree, jar, format, empty] = await Promise.all([
    getTranslations("storefront"),
    getTranslations("common"),
    getLocale(),
    getCatalogueTree(),
    cookies(),
    getFormat(),
    emptyContent(),
  ]);
  // No articles yet: the link waits until there is something to read (UX audit).
  const showArticles = !empty.has("/articles");
  // Whether there is a session at all. The proxy has already refreshed an expired access token
  // before this renders; the name is the cached `/me` the account pages read too.
  const signedIn = Boolean(readAccessToken(jar));
  const actor = signedIn ? await getActor("customer").catch(() => null) : null;

  // A live automatic promotion is the only thing that earns an announcement (D-181, D-307).
  const campaign = tree.flatMap((category) => category.types).find((type) => type.campaignBadge);

  // The five destinations, in the board's order — the desktop bar and the phone drawer alike.
  const links: [string, string][] = [
    ["/studio", t("nav.studio")],
    [STYLES_HREF, t("nav.templates")],
    ["/products", t("nav.productsPricing")],
    ["/business", t("nav.business")],
    ["/contact", t("nav.contact")],
  ];
  const navLink =
    "text-muted hover:text-fg hover:bg-bg-subtle focus-visible:ring-focus-ring rounded-control inline-flex h-10 items-center px-2.5 text-[0.9375rem] font-medium whitespace-nowrap outline-none focus-visible:ring-2 min-[74rem]:px-3";

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
      <header className="z-sticky border-border bg-bg sticky top-0 border-b">
        {/*
          A phone: menu · logo in the middle · search and cart (owner, 2026-10-16). Wide screens: logo
          at the start, the primary nav in the middle, the actions at the end.
        */}
        <div className="max-w-nav mx-auto grid h-(--site-header-h) grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 md:px-5 min-[65rem]:grid-cols-[auto_minmax(0,1fr)_auto] min-[65rem]:gap-4 min-[65rem]:px-6 min-[74rem]:gap-6">
          <div className="flex items-center gap-1">
            <MobileProductsMenu
              label={t("nav.menu")}
              closeLabel={tCommon("actions.close")}
              headerEnd={<DeferredLocaleMenu />}
              footer={
                <Button asChild size="lg" block iconStart="chat">
                  <Link href="/help/chat">{t("drawer.line")}</Link>
                </Button>
              }
            >
              {/* The "Mobile — navbar" board's drawer: who you are, the five links, the categories, help. */}
              {signedIn ? (
                <ul className="mb-4 grid grid-cols-2 gap-2">
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
                        className="border-border rounded-control flex min-h-12 items-center gap-2 border px-3 text-sm font-medium"
                      >
                        <Icon name={icon} size={18} aria-hidden="true" />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-surface border-border rounded-card mb-4 flex items-center gap-3 border p-4">
                  <span className="bg-sage-subtle text-fg grid size-10 shrink-0 place-items-center rounded-full">
                    <Icon name="user" size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px]">{t("drawer.guestTitle")}</b>
                    <small className="text-muted">{t("drawer.guestBody")}</small>
                  </span>
                  <Button asChild size="md">
                    <Link href="/sign-in">{t("nav.signIn")}</Link>
                  </Button>
                </div>
              )}
              <ul className="divide-border border-border divide-y border-y">
                {links.map(([href, label], index) => (
                  <li key={href}>
                    <Link href={href} className="flex min-h-12 items-center justify-between text-base font-medium">
                      {label}
                      <Icon
                        name={index === 0 ? "arrow-right" : "chevron-right"}
                        size={18}
                        aria-hidden="true"
                        className={index === 0 ? "text-primary" : "text-muted"}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {tree.length > 0 ? (
                <section aria-labelledby="drawer-categories" className="mt-6">
                  <h2 id="drawer-categories" className="text-muted mb-3 text-xs font-semibold">
                    {t("drawer.categories")}
                  </h2>
                  <ul className="grid grid-cols-2 gap-2">
                    {tree.slice(0, 7).map((category) => (
                      <li key={category.code}>
                        <Link
                          href={`/products/${encodeURIComponent(category.code)}`}
                          className="border-border rounded-control flex min-h-14 items-center gap-2.5 border px-3 text-sm leading-tight"
                        >
                          <ProductThumb family={productFamilyOf(category.code)} className="size-8 [&_svg]:max-w-6" />
                          {pick(locale, category.nameTh, category.nameEn)}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link
                        href="/products"
                        className="border-primary/40 text-primary rounded-control flex min-h-14 items-center gap-2.5 border border-dashed px-3 text-sm leading-tight font-semibold"
                      >
                        <Icon name="plus" size={18} aria-hidden="true" />
                        {t("drawer.allCategories", { count: tree.length })}
                      </Link>
                    </li>
                  </ul>
                </section>
              ) : null}
              <section aria-labelledby="drawer-help" className="mt-6">
                <h2 id="drawer-help" className="text-muted mb-1 text-xs font-semibold">
                  {t("drawer.help")}
                </h2>
                <ul className="divide-border divide-y">
                  {(
                    [
                      ...(showArticles ? ([["/articles", t("drawer.articles")]] as [string, string][]) : []),
                      ["/faq", t("drawer.faq")],
                      ["/track", t("drawer.track")],
                    ] as [string, string][]
                  ).map(([href, label]) => (
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
            <Brand href="/" height={28} className="hidden min-[65rem]:flex" />
          </div>

          <div className="flex min-w-0 items-center justify-center-safe">
            <Brand href="/" height={24} className="min-[65rem]:hidden" />
            <nav
              data-header-nav
              aria-label={t("nav.primary")}
              className="hidden items-center justify-center gap-0.5 min-[65rem]:flex min-[74rem]:gap-1"
            >
              {links.map(([href, label]) => (
                <HeaderNavLink key={href} href={href} className={navLink}>
                  {label}
                </HeaderNavLink>
              ))}
            </nav>
          </div>

          <div data-header-tools className="flex items-center justify-end gap-1">
            <HeaderSearch label={tCommon("actions.search")} />
            <CartButton signedIn={signedIn} label={t("nav.cart")} />
            <span className="hidden md:contents">
              {/* getpack Assistant (U5.5) — off at launch (D-218), so nothing renders here until it is on. */}
              <DeferredAssistant signedIn={signedIn} />
              <DeferredLocaleMenu />
            </span>
            <span aria-hidden className="bg-border mx-1.5 hidden h-5 w-px md:block" />
            <span className="hidden md:contents">
              <AccountButton
                signedIn={signedIn}
                label={t("nav.account")}
                signInLabel={t("nav.signIn")}
                name={actor?.displayName ?? null}
              />
            </span>
            <HeaderCta
              className="ms-1 hidden px-3.5 min-[65rem]:inline-flex min-[74rem]:ms-2 min-[74rem]:px-5"
              startLabel={t("nav.startFree")}
              productsLabel={t("nav.productsPricing")}
            />
          </div>
        </div>
      </header>
    </>
  );
}
