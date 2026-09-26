"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const ITEMS: { key: string; href: string; icon: IconName }[] = [
  { key: "home", href: "/liff", icon: "home" },
  { key: "orders", href: "/liff/orders", icon: "package" },
  { key: "points", href: "/liff/points", icon: "star" },
  { key: "chat", href: "/liff/chat", icon: "chat" },
];

/** LIFF's tabs (D-151): always at the bottom — LINE's in-app browser is the whole screen. */
export function LiffNav() {
  const t = useTranslations("liff.nav");
  const pathname = usePathname().replace(/^\/en(?=\/|$)/, "");
  return (
    <nav
      aria-label={t("label")}
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((item) => {
          const current = item.href === "/liff" ? pathname === "/liff" : pathname.startsWith(item.href);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs",
                  current ? "text-primary font-medium" : "text-muted",
                )}
              >
                <Icon name={item.icon} size={20} aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
