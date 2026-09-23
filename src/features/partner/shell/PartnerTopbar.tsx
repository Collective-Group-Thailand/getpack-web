import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { LocaleMenu, NotificationBell } from "@/features/shared/shell";
import type { PartnerMe } from "@/lib/api/types";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Popover } from "@/ui/components/Popover";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { Brand } from "@/ui/brand";

/**
 * The partner zone's top bar. Sparse on purpose: on a 6" phone held in one hand, every control
 * up here is one the thumb has to stretch for, so only what a factory user needs on every
 * screen lives here and the rest is in the bottom nav.
 *
 * The theme toggle stays because the partner zone is the one with a high-contrast option
 * (`themeChoicesFor("partner")`), and a shop floor in daylight is exactly where it is needed.
 */
export async function PartnerTopbar({ actor }: { actor: PartnerMe }) {
  const t = await getTranslations("partner.shell");
  const tCommon = await getTranslations("common");

  return (
    <header className="border-border bg-surface z-sticky sticky top-0 flex h-16 items-center gap-2 border-b px-3">
      <Brand href="/" />

      <div className="ms-auto flex items-center gap-1">
        <NotificationBell />
        <LocaleMenu />
        <ThemeToggle
          label={tCommon("theme.label")}
          choiceLabels={{
            system: tCommon("theme.system"),
            light: tCommon("theme.light"),
            dark: tCommon("theme.dark"),
            hc: tCommon("theme.hc"),
          }}
        />

        <Popover
          align="end"
          aria-label={t("account")}
          trigger={
            <button type="button" aria-label={t("account")} className="rounded-full">
              <Avatar name={actor.displayName} size="lg" />
            </button>
          }
        >
          <div className="w-64 p-3">
            <p className="truncate font-medium" data-testid="actor-name">
              {actor.displayName}
            </p>
            {/*
              The contract gives a factory id and the roles held at it, not a display name
              (`FactoryAccessDto`), so roles are what there is to show. The factory switcher
              F5 needs a name for is logged in docs/contract-requests.md.
            */}
            <div className="mt-2 flex flex-wrap gap-1" data-testid="actor-factories">
              {actor.factories.flatMap((factory) =>
                factory.roles.map((role) => (
                  <Badge key={`${factory.factoryId}-${role}`} size="sm">
                    {role}
                  </Badge>
                )),
              )}
            </div>
            <div className="mt-3">
              <SignOutButton zone="partner" />
            </div>
          </div>
        </Popover>
      </div>
    </header>
  );
}
