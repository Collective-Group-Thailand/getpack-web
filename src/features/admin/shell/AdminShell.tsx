"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import type { MenuEntry, StaffMe } from "@/lib/api/types";
import { AppShell } from "@/ui/components/AppShell";
import { CommandPalette, useCommandPaletteShortcut, useModKey } from "@/ui/components/CommandPalette";
import { KEYCAP } from "@/ui/components/Kbd";
import { Sheet } from "@/ui/components/Sheet";
import { ShortcutsOverlay, useShortcutsOverlayShortcut } from "@/ui/components/ShortcutsOverlay";

import { ActorProvider } from "../console/actor";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { localItems, sidebarItems } from "./menu";
import { usePaletteItems } from "./palette";
import { NAV_COOKIE, NAV_COOKIE_MAX_AGE, type NavState } from "./nav-cookie";

export interface AdminShellProps {
  actor: StaffMe;
  menu: readonly MenuEntry[];
  initialNav: NavState;
  envBadge?: "uat" | "prod";
  children: React.ReactNode;
}

/**
 * The back-office frame: entitlement-driven sidebar, topbar, ⌘K and the `?` overlay.
 *
 * A client component, so the collapse state and the two overlays have somewhere to live —
 * but `children` is passed in from the server layout, so every screen under it stays a Server
 * Component. That is the whole reason the shell takes `actor` and `menu` as plain props
 * rather than fetching them: the fetch belongs on the server, in the layout that already had
 * to call `/v1/admin/me` for its guard.
 */
export function AdminShell({ actor, menu, initialNav, envBadge, children }: AdminShellProps) {
  const t = useTranslations("admin.shell");
  const tCommon = useTranslations("common");

  const [nav, setNav] = useState<NavState>(initialNav);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  // A link chosen in the drawer moves the page; the drawer goes with it.
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const modKey = useModKey();

  const collapsed = nav === "collapsed";
  const fromApi = sidebarItems(menu);
  const screens = [
    ...fromApi,
    ...localItems(actor.permissions).filter((item) => !fromApi.some((entry) => entry.key === item.key)),
  ];
  const palette = usePaletteItems(query, screens, () => setPaletteOpen(false));

  const toggleNav = useCallback(() => {
    setNav((current) => {
      const next: NavState = current === "collapsed" ? "open" : "collapsed";
      document.cookie = `${NAV_COOKIE}=${next}; path=/; max-age=${NAV_COOKIE_MAX_AGE}; samesite=lax${
        window.location.protocol === "https:" ? "; secure" : ""
      }`;
      return next;
    });
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useCommandPaletteShortcut(openPalette);
  useShortcutsOverlayShortcut(openShortcuts);

  return (
    <>
      <AppShell
        skipLabel={tCommon("nav.skipToContent")}
        sidebarLabel={t("nav")}
        sidebarCollapsed={collapsed}
        header={
          <AdminTopbar
            actor={actor}
            collapsed={collapsed}
            onToggleSidebar={toggleNav}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenPalette={openPalette}
            onOpenShortcuts={openShortcuts}
            modKey={modKey}
            envBadge={envBadge}
          />
        }
        sidebar={<AdminSidebar items={screens} collapsed={collapsed} actor={actor} />}
      >
        <ActorProvider actor={actor}>{children}</ActorProvider>
      </AppShell>

      <Sheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="start"
        title={t("nav")}
        closeLabel={tCommon("actions.close")}
      >
        <AdminSidebar items={screens} collapsed={false} actor={actor} />
      </Sheet>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title={t("palette.title")}
        placeholder={t("palette.placeholder")}
        loadingLabel={tCommon("state.loading")}
        emptyLabel={t("palette.empty")}
        value={query}
        onValueChange={setQuery}
        items={palette.items}
        loading={palette.loading}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        title={t("shortcuts")}
        closeLabel={tCommon("actions.close")}
        shortcuts={[
          { keys: [modKey, KEYCAP.k], description: t("palette.title") },
          { keys: [KEYCAP.question], description: t("shortcuts") },
          { keys: [KEYCAP.esc], description: t("shortcutEscape") },
        ]}
      />
    </>
  );
}
