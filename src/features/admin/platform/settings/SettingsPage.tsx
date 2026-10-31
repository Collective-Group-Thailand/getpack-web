"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { EmptyState } from "@/ui/components/EmptyState";
import { Row, RowList } from "@/ui/components/RowList";
import { SearchInput } from "@/ui/components/SearchInput";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, QueryError } from "../../console";
import type { Setting } from "../setting-value";
import { useSettingWords } from "./SettingField";
import { SettingsSection } from "./SettingsSection";
import { AREA_ORDER, areaOf, type Area } from "./shape";

type View = "all" | "attention" | "unset";
const VIEWS: Record<View, (s: Setting) => boolean> = {
  all: () => true,
  attention: (s) => s.confirmationStatus !== "confirmed" || s.pending !== null,
  unset: (s) => !s.masked && (s.current === null || s.current.value === null),
};

/** The issuing entity a scoped setting belongs to, by that entity's own registered name. */
function useScopeLabel(all: Setting[]) {
  const t = useTranslations("platform.settings");
  return (setting: Setting) => {
    if (setting.scopeType !== "entity") return undefined;
    const named = (key: string) =>
      all.find((s) => s.key === key && s.scopeId === setting.scopeId)?.current?.value as string | undefined;
    return named("entity.legal_name_th") ?? named("entity.display_name") ?? t("entityScope");
  };
}

/**
 * Every configurable business value (ADR-0005), in the areas of the business it governs, one area at a time: on a
 * desk the areas are a column of links beside the open one; on a phone they are a list to open one from. A search
 * or a view shows its matches in every area. Each setting is a labelled, typed field; each area saves its own changes.
 */
export function SettingsList({ initial }: { initial: Setting[] | null }) {
  const t = useTranslations("platform.settings");
  const words = useSettingWords();
  const params = useSearchParams();
  const opened = params.get("section") as Area | null;
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");

  const settings = useQuery({
    queryKey: queryKeys.list("admin", "setting"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!,
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.stable,
  });
  const all = useMemo(() => settings.data ?? [], [settings.data]);
  const scopeLabel = useScopeLabel(all);

  const counts = useMemo(
    () =>
      Object.fromEntries((Object.keys(VIEWS) as View[]).map((v) => [v, all.filter(VIEWS[v]).length])) as Record<
        View,
        number
      >,
    [all],
  );

  const areas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matching = all.filter(
      (s) =>
        VIEWS[view](s) &&
        (!needle ||
          s.key.toLowerCase().includes(needle) ||
          words.label(s.key).toLowerCase().includes(needle) ||
          (words.help(s.key) ?? s.description).toLowerCase().includes(needle)),
    );
    const byArea = new Map<Area, Setting[]>();
    for (const s of matching) byArea.set(areaOf(s.key), [...(byArea.get(areaOf(s.key)) ?? []), s]);
    return AREA_ORDER.filter((a) => byArea.has(a)).map((area) => ({
      area,
      rows: byArea
        .get(area)!
        .sort((a, b) => (a.scopeId ?? "").localeCompare(b.scopeId ?? "") || a.key.localeCompare(b.key)),
    }));
    // `words` reads the same messages for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, view]);

  if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;

  const narrowed = q.trim() !== "" || view !== "all";
  const current: Area | undefined = areas.some((a) => a.area === opened) ? opened! : areas[0]?.area;
  // On a phone: the list of areas, or the one opened from it (a search shows its matches directly).
  const phoneList = !opened && !narrowed;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t("views.label")}
          value={view}
          onValueChange={setView}
          className="max-w-full overflow-x-auto"
          options={(Object.keys(VIEWS) as View[]).map((v) => ({
            value: v,
            label: t(`views.${v}`, { count: counts[v] }),
          }))}
        />
        <div className="w-full sm:w-72">
          <SearchInput
            value={q}
            onValueChange={setQ}
            aria-label={t("search")}
            clearLabel={t("clearSearch")}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      </div>

      {settings.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="rounded-card h-96" />
        </div>
      ) : areas.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("noMatch")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setView("all");
              }}
            >
              {t("clearFilters")}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
          <aside className="sticky top-20 hidden lg:block">
            <p className="text-muted mb-2 px-3 text-xs font-medium">{t("nav")}</p>
            <nav aria-label={t("nav")}>
              <ul className="flex flex-col gap-0.5">
                {areas.map(({ area, rows }) => {
                  const selected = !narrowed && area === current;
                  return (
                    <li key={area}>
                      <Link
                        href={`/settings?section=${area}`}
                        replace
                        scroll={false}
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                          "focus-visible:ring-focus-ring flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm leading-snug outline-none focus-visible:ring-2",
                          selected
                            ? "bg-primary-subtle text-primary-subtle-fg font-semibold"
                            : "text-muted hover:bg-surface-subtle hover:text-fg",
                        )}
                      >
                        <span className="min-w-0">{t(`areas.${area}.title`)}</span>
                        <span className={cn("shrink-0 text-xs tabular-nums", selected ? "font-medium" : "text-muted")}>
                          {rows.length}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <div className="flex min-w-0 flex-col gap-10">
            {phoneList ? (
              <RowList label={t("nav")} className="lg:hidden">
                {areas.map(({ area, rows }) => (
                  <Row
                    key={area}
                    href={`/settings?section=${area}`}
                    title={t(`areas.${area}.title`)}
                    meta={t(`areas.${area}.body`)}
                    aside={<span className="text-muted text-sm tabular-nums">{rows.length}</span>}
                  />
                ))}
              </RowList>
            ) : null}
            {opened && !narrowed ? (
              <Link
                href="/settings"
                className="text-muted hover:text-fg -mb-6 inline-flex min-h-11 items-center gap-1 self-start text-sm lg:hidden"
              >
                <Icon name="chevron-left" size={16} aria-hidden />
                {t("allAreas")}
              </Link>
            ) : null}
            {areas.map(({ area, rows }) => (
              <SettingsSection
                key={area}
                id={`area-${area}`}
                title={t(`areas.${area}.title`)}
                description={t(`areas.${area}.body`)}
                settings={rows}
                scopeLabel={area === "entity" ? scopeLabel : undefined}
                active={narrowed || area === current}
                className={cn(
                  "scroll-mt-20 flex-col gap-3",
                  // One area at a time: the one opened (a desk opens on the first; a phone on the list of areas).
                  // A search or a view shows its matches in every area. Hidden areas stay mounted, so their edits wait.
                  narrowed || opened === area ? "flex" : !opened && area === current ? "hidden lg:flex" : "hidden",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
