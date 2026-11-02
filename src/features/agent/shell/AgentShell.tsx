import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { BrandLogo } from "@/ui/brand";

import { AgentRail, AgentSidebar, AgentTabBar } from "./AgentNav";
import { ENDED_ITEMS, PROFILE_MENU, RAIL_ITEMS, SIDEBAR_GROUPS, TAB_ITEMS } from "./nav";
import { ProfileMenu } from "./ProfileMenu";

/**
 * getpack Agent's frame (D-467, PROMPT <responsive>): one header — the getpack Agent mark, the agent's code and the
 * profile menu — and one navigation per size: a four-tab bar on a phone, an icon rail on a tablet, a grouped
 * sidebar on a desktop. Only one of the three is ever displayed, so a screen reader meets one navigation landmark.
 * Every fixed bar pads itself by the safe-area inset it sits against; the page pads itself by the tab bar's height.
 *
 * `mode`: `agent` is the whole app; `ended` keeps the statements only; `bare` is the header alone (the screen for
 * someone signed in who is not an agent).
 */
export async function AgentShell({
  mode,
  name,
  code,
  children,
}: {
  mode: "agent" | "ended" | "bare";
  name: string;
  code: string | null;
  children: React.ReactNode;
}) {
  const [t, tCommon] = await Promise.all([getTranslations("agentZone.shell"), getTranslations("common")]);
  const tabs = mode === "agent" ? TAB_ITEMS : mode === "ended" ? ENDED_ITEMS : [];
  const rail = mode === "agent" ? RAIL_ITEMS : tabs;
  const groups =
    mode === "agent" ? SIDEBAR_GROUPS : mode === "ended" ? [{ key: "earn" as const, items: ENDED_ITEMS }] : [];
  const menu = mode === "agent" ? PROFILE_MENU : PROFILE_MENU.filter((item) => item.key === "profile");
  const navigable = tabs.length > 0;

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {tCommon("nav.skipToContent")}
      </a>
      <header className="border-border bg-surface z-sticky sticky top-0 border-b pt-[env(safe-area-inset-top)] print:hidden">
        <div className="flex h-16 items-center gap-3 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] sm:ps-5">
          <Link
            href="/"
            aria-label={t("home")}
            className="focus-visible:ring-focus-ring flex min-h-11 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
          >
            <BrandLogo height={22} />
            <span className="text-primary border-primary/30 rounded-md border px-1.5 py-0.5 text-xs font-semibold">
              {t("agent")}
            </span>
          </Link>
          <div className="ms-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
            {code ? (
              <p className="text-muted flex min-w-0 items-baseline gap-1.5 text-sm">
                <span className="hidden sm:inline">{t("code")}</span>
                <span className="sr-only sm:hidden">{t("code")}</span>
                <span className="text-fg truncate font-semibold tracking-wide tabular-nums" data-testid="agent-code">
                  {code}
                </span>
              </p>
            ) : null}
            <ProfileMenu name={name} items={menu} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {navigable ? <AgentRail items={rail} /> : null}
        {navigable ? <AgentSidebar groups={groups} /> : null}
        <main
          id="main"
          tabIndex={-1}
          className={
            navigable
              ? "min-w-0 flex-1 px-4 pt-5 pb-[calc(var(--mobile-tab-h)+2rem)] outline-none sm:px-6 sm:pt-7 sm:pb-12 lg:px-10 lg:pt-8"
              : "min-w-0 flex-1 px-4 pt-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] outline-none sm:px-6 sm:pt-8"
          }
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {navigable ? <AgentTabBar items={tabs} /> : null}
    </div>
  );
}
