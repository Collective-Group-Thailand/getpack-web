import { getTranslations } from "next-intl/server";

import { LocaleLink } from "./LocaleLink";
import { NotificationBell } from "@/features/shared/shell";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { Brand } from "@/ui/brand";

/**
 * The storefront's top bar.
 *
 * A server component, deliberately: the storefront's initial-JS budget is 150 KB
 * (`docs/performance-budgets.md`), and a header is on every page. Only the three controls that
 * genuinely need state — the language menu, the theme menu and, later, the cart count — are
 * client components.
 *
 * The catalogue mega-menu is a link for now; F3.1 builds the panel once there is a catalogue
 * endpoint to fill it from.
 */
export async function SiteHeader() {
  const t = await getTranslations("storefront");
  const tCommon = await getTranslations("common");

  return (
    <header className="z-sticky border-border bg-surface/90 sticky top-0 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Brand href="/" />

        <nav aria-label={t("nav.primary")} className="ms-4 hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/products">{t("nav.products")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/design/new">{tCommon("nav.startDesigning")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/help">{t("nav.help")}</Link>
          </Button>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <IconButton asChild name="search" variant="ghost" size="sm" label={tCommon("actions.search")}>
            <Link href="/search" />
          </IconButton>

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

          <IconButton asChild name="user" variant="ghost" size="sm" label={t("nav.account")}>
            <Link href="/account" />
          </IconButton>

          <NotificationBell zone="customer" />
          <LocaleLink />
          <ThemeToggle
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
