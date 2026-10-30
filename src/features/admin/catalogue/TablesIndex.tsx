"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";

import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Row, RowList } from "@/ui/components/RowList";
import { SearchInput } from "@/ui/components/SearchInput";
import type { IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, useActor } from "../console";
import { listRows } from "./api";
import { TABLES, type Section } from "./tables";

const SECTIONS: Record<"catalogue" | "cms", readonly Section[]> = {
  catalogue: ["structure", "materials", "products", "designs", "geography"],
  cms: ["content", "seo"],
};

type Entry = { key: string; href: string; icon: IconName; permission: string; path?: string };

/**
 * How many rows a table holds — "14 รายการ" (UX audit, /catalogue) — read as the total of a one-row page, so the
 * index costs a request per row and nothing more. A table with nothing in it reads quieter than one in use.
 */
function RowCount({ path, tableKey }: { path: string; tableKey: string }) {
  const t = useTranslations("catalogue");
  const format = useFormat();
  const count = useQuery({
    queryKey: [...queryKeys.list("admin", `catalog_${tableKey}`), "count"],
    queryFn: async () => (await listRows(adminBrowserApis().contract, path, { perPage: 1 })).meta.total,
    staleTime: STALE_TIME.reference,
  });
  if (count.data === undefined) return <span className="bg-surface-subtle inline-block h-4 w-14 rounded-md" />;
  return (
    <span className={cn("text-sm whitespace-nowrap tabular-nums", count.data === 0 ? "text-subtle" : "text-muted")}>
      {t("rowCount", { count: format.number(count.data) })}
    </span>
  );
}

/**
 * The catalogue or the CMS as an index of its tables, grouped the way people look for them, and only those this
 * role may read — the tables are many (A.2.1 counts about sixty). Each group is one ruled list (name, what it
 * holds, how many rows) rather than a wall of identical cards, two groups side by side on a wide desk, and a
 * search over the names and descriptions narrows every group at once.
 */
export function TablesIndex({ zone }: { zone: "catalogue" | "cms" }) {
  const t = useTranslations("catalogue");
  const tFilters = useTranslations("console.filters");
  const actor = useActor();
  const may = (permission: string) => actor.permissions.includes(permission);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const extra: Partial<Record<Section, Entry[]>> =
    zone === "catalogue"
      ? {
          products: [{ key: "readiness", href: "/catalogue/readiness", icon: "checklist", permission: "catalog.read" }],
          geography: [{ key: "import", href: "/catalogue/import", icon: "spreadsheet", permission: "catalog.import" }],
        }
      : {};

  const groups = SECTIONS[zone].flatMap((section) => {
    const entries: Entry[] = [
      ...TABLES.filter((def) => def.zone === zone && def.section === section).map((def) => ({
        key: def.key,
        href: `/${zone}/${def.key}`,
        icon: def.icon,
        permission: def.read,
        path: def.path,
      })),
      ...(extra[section] ?? []),
    ]
      .filter((entry) => may(entry.permission))
      .filter(
        (entry) =>
          !needle ||
          `${t(`tables.${entry.key}.title`)} ${t(`tables.${entry.key}.description`)} ${entry.key}`
            .toLowerCase()
            .includes(needle),
      );
    return entries.length ? [{ section, entries }] : [];
  });

  return (
    <div className="flex flex-col gap-6">
      <Field label={t("home.searchLabel")} labelHidden className="w-full sm:w-80">
        <SearchInput
          value={q}
          onValueChange={setQ}
          clearLabel={tFilters("clearSearch")}
          placeholder={t("home.searchPlaceholder")}
        />
      </Field>
      {groups.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("home.noMatch")}
          action={
            <Button variant="secondary" onClick={() => setQ("")}>
              {tFilters("clearSearch")}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-x-8 gap-y-8 xl:grid-cols-2">
          {groups.map(({ section, entries }) => (
            <section key={section} aria-labelledby={`section-${section}`} className="flex min-w-0 flex-col gap-2.5">
              <h2 id={`section-${section}`} className="flex items-baseline gap-2 text-base font-semibold">
                {t(`sectionTitles.${section}`)}
                <span className="text-muted text-sm font-normal tabular-nums">{entries.length}</span>
              </h2>
              <RowList label={t(`sectionTitles.${section}`)}>
                {entries.map((entry) => (
                  <Row
                    key={entry.key}
                    href={entry.href}
                    icon={entry.icon}
                    title={t(`tables.${entry.key}.title`)}
                    meta={t(`tables.${entry.key}.description`)}
                    aside={entry.path ? <RowCount path={entry.path} tableKey={entry.key} /> : undefined}
                  />
                ))}
              </RowList>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
