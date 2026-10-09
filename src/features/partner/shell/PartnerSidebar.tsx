"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { isCurrent } from "./nav";
import type { SidebarGroup } from "./sidebar";

/**
 * The partner sidebar on tablets and office screens (round 2, Phase 1): the role's destinations in
 * four groups under small group labels, the factory at the top and who is signed in at the foot. It
 * sits inside AppShell's own `<nav>`, so it adds no landmark of its own.
 */
export function PartnerSidebar({
  groups,
  factory,
  user,
}: {
  groups: SidebarGroup[];
  factory: { name: string; status: string | null };
  user: { name: string; roles: string };
}) {
  const t = useTranslations("partner.sidebar");
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-4 px-2 py-3 md:gap-3">
      <div className="bg-bg rounded-lg px-3 py-2.5 md:py-2">
        <p className="truncate font-semibold">{factory.name}</p>
        {factory.status ? <p className="text-muted text-sm">{factory.status}</p> : null}
      </div>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <p className="text-muted px-3 pt-1 text-sm font-semibold">{t(`groups.${group.key}`)}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const current = isCurrent(item.href, pathname);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-e-lg border-s-[3px] px-3 text-base md:min-h-9 md:gap-2.5",
                      // The page you are on: a teal edge and teal words on a tint — seen at a glance, not guessed.
                      current
                        ? "border-primary bg-primary-subtle text-primary-subtle-fg font-semibold"
                        : "text-fg hover:bg-bg border-transparent font-medium",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      size={20}
                      className={cn("md:size-[18px]", current ? "text-primary" : "text-muted")}
                      aria-hidden="true"
                    />
                    {t(`items.${item.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-border mt-auto border-t px-3 pt-3">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-muted truncate text-sm">{user.roles}</p>
      </div>
    </div>
  );
}
