"use client";

import { useTranslations } from "next-intl";

import { SignOutButton } from "@/features/shared/auth/SignOutButton";
import { LocaleMenu, NotificationBell } from "@/features/shared/shell";
import type { StaffMe } from "@/lib/api/types";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { KEYCAP, Kbd } from "@/ui/components/Kbd";
import { Popover } from "@/ui/components/Popover";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { Brand } from "@/ui/brand";
import { Icon } from "@/ui/icons";

export interface AdminTopbarProps {
  actor: StaffMe;
  collapsed: boolean;
  onToggleSidebar: () => void;
  /** Below `md` the sidebar is a drawer (round 2, Phase 1 — the "AdminMobile" board). */
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  /** `⌘` or `Ctrl`, resolved for this platform. */
  modKey: string;
  /** `uat` | `prod` from `NEXT_PUBLIC_ENV_BADGE`; nothing is shown in normal development. */
  envBadge?: "uat" | "prod";
}

export function AdminTopbar({
  actor,
  collapsed,
  onToggleSidebar,
  onOpenDrawer,
  onOpenPalette,
  onOpenShortcuts,
  modKey,
  envBadge,
}: AdminTopbarProps) {
  const t = useTranslations("admin.shell");
  const tCommon = useTranslations("common");

  return (
    <header className="border-border bg-surface z-sticky sticky top-0 flex h-16 items-center gap-2 border-b px-3">
      <IconButton
        name="sidebar"
        variant="ghost"
        size="sm"
        label={collapsed ? t("expandNav") : t("collapseNav")}
        aria-expanded={!collapsed}
        onClick={onToggleSidebar}
        className="hidden md:inline-flex"
      />
      <IconButton
        name="menu"
        variant="ghost"
        size="sm"
        label={t("openNav")}
        aria-haspopup="dialog"
        onClick={onOpenDrawer}
        className="md:hidden"
      />
      <Brand href="/" className="me-2 flex" />

      {/*
        A button rather than an input. The palette is a modal with its own field, and two
        search boxes on one screen — one of which teleports your text into the other — is a
        reliable way to lose what someone typed.
      */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpenPalette}
        className="text-muted mx-auto hidden w-full max-w-sm justify-start font-normal sm:flex"
      >
        <Icon name="search" size={16} />
        <span className="flex-1 text-start">{t("searchPlaceholder")}</span>
        <Kbd>{modKey}</Kbd>
        <Kbd>{KEYCAP.k}</Kbd>
      </Button>
      <IconButton
        name="search"
        variant="ghost"
        size="sm"
        label={t("searchPlaceholder")}
        onClick={onOpenPalette}
        className="ms-auto sm:hidden"
      />

      <div className="ms-auto flex items-center gap-1 sm:ms-0">
        {envBadge ? (
          // Loud on purpose: the cost of mistaking production for UAT is a real order sent to
          // a real factory.
          <Badge tone={envBadge === "prod" ? "danger" : "warning"} appearance="solid" size="sm">
            {t(`env.${envBadge}`)}
          </Badge>
        ) : null}

        <IconButton
          name="help"
          variant="ghost"
          size="sm"
          label={t("shortcuts")}
          onClick={onOpenShortcuts}
          className="hidden md:inline-flex"
        />
        <NotificationBell zone="admin" />
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
              <Avatar name={actor.displayName} />
            </button>
          }
        >
          <div className="w-56 p-3">
            <p className="truncate font-medium" data-testid="actor-name">
              {actor.displayName}
            </p>
            {actor.email ? <p className="text-muted truncate text-xs">{actor.email}</p> : null}
            <div className="mt-2 flex flex-wrap gap-1" data-testid="actor-roles">
              {actor.roles.map((role) => (
                <Badge key={role} size="sm">
                  {role}
                </Badge>
              ))}
            </div>
            <div className="mt-3">
              <SignOutButton zone="admin" />
            </div>
          </div>
        </Popover>
      </div>
    </header>
  );
}
