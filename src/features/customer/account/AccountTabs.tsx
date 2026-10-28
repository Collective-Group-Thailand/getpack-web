"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/lib/cn";

import { plainPath, sectionOf, type SectionTab, tabOf, TEAM_TAB } from "./sections";

/**
 * The tabs of the account section this page belongs to (account pack Phase 1): ใบเสนอราคา | คำขอใบเสนอราคา,
 * งานออกแบบ | ตัวอย่างสินค้า | คำขอออกแบบโครงสร้าง, … Each tab is the page it always was, so its address keeps
 * working. Nothing for a section without tabs. `team` adds "ทีมและผู้อนุมัติ" to ข้อมูลบัญชี for a company member.
 */
export function AccountTabs({ team = false }: { team?: boolean }) {
  const t = useTranslations("account.tabs");
  const path = plainPath(usePathname());
  const section = sectionOf(path);
  if (!section?.tabs) return null;
  const tabs: readonly SectionTab[] = section.key === "profile" && team ? [...section.tabs, TEAM_TAB] : section.tabs;
  const current = tabOf(section, path);
  return (
    <TabBar
      className="mb-5"
      label={t("label")}
      items={tabs.map((tab) => ({ ...tab, label: t(tab.key), current: tab.key === current?.key }))}
    />
  );
}

/** One row of tab links (a pill track that scrolls sideways on a phone). Shared with in-page filters. */
export function TabBar({
  label,
  items,
  className,
}: {
  label: string;
  items: { key: string; href: string; label: string; current: boolean; count?: number | null }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("max-w-full", className)}>
      <ul className="bg-bg-subtle inline-flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl p-1 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-3 text-[0.84375rem] whitespace-nowrap",
                item.current ? "bg-surface text-fg shadow-card font-semibold" : "text-muted hover:text-fg font-medium",
              )}
            >
              {item.label}
              {item.count !== undefined && item.count !== null ? (
                <span className="text-muted text-[0.71875rem] font-semibold tabular-nums">{item.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
