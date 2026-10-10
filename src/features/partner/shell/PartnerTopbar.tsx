import { getTranslations } from "next-intl/server";

import { chooseFactory } from "@/features/partner/context/actions";
import type { FactoryContext } from "@/features/partner/context/server";
import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { LocaleMenu, NotificationBell } from "@/features/shared/shell";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Popover } from "@/ui/components/Popover";
import { Brand } from "@/ui/brand";

const ROLE_KEYS = [
  "factory_owner",
  "factory_planner",
  "factory_operator",
  "factory_qc",
  "factory_shipping",
  "factory_accountant",
  "factory_storekeeper",
  "factory_purchaser",
  "factory_maintenance",
  "factory_sales",
] as const;

/**
 * The partner zone's top bar. Sparse on purpose: on a 6" phone held in one hand, every control
 * up here is one the thumb has to stretch for, so only what a factory user needs on every
 * screen lives here and the rest is in the bottom nav.
 *
 * The theme toggle stays because the partner zone is the one with a high-contrast option
 * (`themeChoicesFor("partner")`), and a shop floor in daylight is exactly where it is needed.
 *
 * The factory's name comes from `/me` (`partner.me.get` names every factory the token acts for). A
 * user of several factories switches between them in the account menu; the choice is a cookie, the
 * token's scopes still decide.
 */
export async function PartnerTopbar({ context }: { context: FactoryContext }) {
  const t = await getTranslations("partner.shell");
  const { actor } = context;
  const factoryName = context.factories.find((item) => item.factoryId === context.factoryId)?.name ?? null;
  const roleLabel = (role: string) =>
    (ROLE_KEYS as readonly string[]).includes(role) ? t(`roles.${role as (typeof ROLE_KEYS)[number]}`) : role;

  return (
    <header className="border-border bg-surface z-sticky sticky top-0 flex h-16 items-center gap-2 border-b px-3 md:h-14">
      <Brand href="/" />
      {factoryName ? (
        <span className="text-muted hidden truncate text-sm md:inline" data-testid="factory-name">
          {factoryName}
        </span>
      ) : null}

      <div className="ms-auto flex items-center gap-1">
        <NotificationBell zone="partner" />
        <LocaleMenu />
        {/* The theme lives in Settings: an unlabelled sun in the bar is one more icon to puzzle over. */}

        <Popover
          align="end"
          aria-label={t("account")}
          trigger={
            <button type="button" aria-label={t("account")} className="rounded-full">
              <Avatar name={actor.displayName} size="lg" />
            </button>
          }
        >
          <div className="w-72 p-3">
            <p className="truncate font-medium" data-testid="actor-name">
              {actor.displayName}
            </p>
            {factoryName ? <p className="text-muted mt-1 text-sm">{factoryName}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1" data-testid="actor-factories">
              {context.roles.map((role) => (
                <Badge key={role} size="sm">
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
            {context.factories.length > 1 ? (
              <form action={chooseFactory} className="border-border mt-3 border-t pt-3">
                <p className="text-sm font-medium">{t("switchFactory")}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {context.factories.map((other) => (
                    <li key={other.factoryId}>
                      <Button
                        type="submit"
                        name="factoryId"
                        value={other.factoryId}
                        variant={other.factoryId === context.factoryId ? "secondary" : "ghost"}
                        block
                        aria-current={other.factoryId === context.factoryId ? "true" : undefined}
                        className="justify-start"
                      >
                        {other.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              </form>
            ) : null}
            <div className="mt-3">
              <SignOutButton zone="partner" />
            </div>
          </div>
        </Popover>
      </div>
    </header>
  );
}
