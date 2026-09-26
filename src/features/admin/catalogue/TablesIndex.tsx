"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card } from "@/ui/components/Card";
import { Icon, type IconName } from "@/ui/icons";

import { useActor } from "../console";
import { TABLES, type Section } from "./tables";

const SECTIONS: Record<"catalogue" | "cms", readonly Section[]> = {
  catalogue: ["structure", "materials", "products", "designs", "geography"],
  cms: ["content", "seo"],
};

type Entry = { key: string; href: string; icon: IconName; permission: string };

/**
 * The catalogue or the CMS as a map of its tables, grouped the way people look for them, and
 * only those this role may read — the tables are many (A.2.1 counts about sixty), so a flat menu
 * would be the wrong tool.
 */
export function TablesIndex({ zone }: { zone: "catalogue" | "cms" }) {
  const t = useTranslations("catalogue");
  const actor = useActor();
  const may = (permission: string) => actor.permissions.includes(permission);

  const extra: Partial<Record<Section, Entry[]>> =
    zone === "catalogue"
      ? {
          geography: [{ key: "import", href: "/catalogue/import", icon: "spreadsheet", permission: "catalog.import" }],
        }
      : {};

  return (
    <div className="flex flex-col gap-8">
      {SECTIONS[zone].map((section) => {
        const entries: Entry[] = [
          ...TABLES.filter((def) => def.zone === zone && def.section === section).map((def) => ({
            key: def.key,
            href: `/${zone}/${def.key}`,
            icon: def.icon,
            permission: def.read,
          })),
          ...(extra[section] ?? []),
        ].filter((entry) => may(entry.permission));
        if (entries.length === 0) return null;
        return (
          <section key={section} aria-labelledby={`section-${section}`}>
            <h2 id={`section-${section}`} className="mb-3 text-lg font-semibold">
              {t(`sectionTitles.${section}`)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <li key={entry.key}>
                  <Card padding="md" className="hover:border-primary h-full transition-colors">
                    <Link href={entry.href} className="flex items-start gap-3">
                      <Icon name={entry.icon} size={20} className="text-primary mt-0.5 shrink-0" />
                      <span>
                        <span className="block font-medium">{t(`tables.${entry.key}.title`)}</span>
                        <span className="text-muted block text-sm">{t(`tables.${entry.key}.description`)}</span>
                      </span>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
