import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { Brand } from "@/ui/brand";

/**
 * The customer zone's top bar. A placeholder shell until F1 builds the real one (catalogue
 * mega-menu, cart, account, search, locale switcher) — what it does carry now is the
 * structure a11y depends on: a landmark, a brand link home, and the theme control.
 */
export async function SiteHeader() {
  const t = await getTranslations("common");

  return (
    <header className="z-sticky border-border bg-surface/90 sticky top-0 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Brand href="/" />
        <nav aria-label={t("nav.home")} className="flex items-center gap-2 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href="/account/designs">{t("nav.myDesigns")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/design/new">{t("nav.startDesigning")}</Link>
          </Button>
          <ThemeToggle
            label={t("theme.label")}
            choiceLabels={{
              system: t("theme.system"),
              light: t("theme.light"),
              dark: t("theme.dark"),
              hc: t("theme.hc"),
            }}
          />
        </nav>
      </div>
    </header>
  );
}
