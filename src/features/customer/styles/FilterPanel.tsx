"use client";

import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import { Checkbox } from "@/ui/components/Checkbox";
import { MaterialSwatch } from "@/ui/components/MaterialSwatch";
import { Switch } from "@/ui/components/Switch";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { trackCatalog } from "./catalog-events";
import { foldedItems, foldedSubGroups } from "./facet-groups";
import { clearFilters, listHref, toggleValue, type FacetKey, type ListParams } from "./query";

/** One value as the panel shows it: its words are the server's, its count the API's. */
export interface PanelItem {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  /** What the material looks like — staff's swatch for it, when there is one. */
  swatch?: { colour: string | null; imageUrl: string | null };
}

export interface PanelGroup {
  key: FacetKey;
  title: string;
  /** Sub-groups under their axis heading ("ก้นกล่อง"), or one untitled sub-group. */
  subGroups: { title: string | null; items: PanelItem[] }[];
  /** "เหมาะกับ" reads best as chips; the rest as checkbox lists. */
  display: "list" | "chips";
}

export interface FilterPanelProps {
  params: ListParams;
  groups: PanelGroup[];
  /** Styles with an instant price under the other filters; `null` hides the switch. */
  instantCount: number | null;
  /** Matches now — what a filter event is counted against. */
  resultCount: number;
  className?: string;
}

/**
 * The library's one filter system (styles redesign §3): "ราคาทันทีเท่านั้น" first — the condition a
 * buyer decides on before anything else — then the API's facets in collapsible groups, an option
 * facet split into sub-groups under its axis so the axis is said once, five values and "ดูเพิ่ม",
 * counts beside each. Values of one facet are alternatives, facets all apply.
 *
 * Every change replaces the URL (`router.replace`, no history entry per tick) and the server
 * renders the results from it; the boxes answer at once (optimistic), so the page never waits on
 * the network to show a tick (INP).
 */
export function FilterPanel({ params, groups, instantCount, resultCount, className }: FilterPanelProps) {
  const t = useTranslations("styles");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(params);

  const go = (next: ListParams) => {
    startTransition(() => {
      setShown(next);
      router.replace(listHref({ ...next, style: undefined }), { scroll: false });
    });
  };

  const toggle = (key: FacetKey, value: string) => {
    const on = !shown[key].includes(value);
    trackCatalog("catalog_filter", { facet: key, value, action: on ? "add" : "remove", result_count: resultCount });
    go(toggleValue(shown, key, value));
  };

  const isOn = (key: FacetKey, item: PanelItem) => shown[key].includes(item.value);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {instantCount !== null ? (
        <div className="border-border bg-surface rounded-card border p-3">
          <Switch
            labelPosition="start"
            checked={shown.pricePath === "instant"}
            onCheckedChange={(on) => {
              trackCatalog("catalog_filter", {
                facet: "pricePath",
                value: "instant",
                action: on ? "add" : "remove",
                result_count: resultCount,
              });
              go({ ...shown, pricePath: on ? "instant" : undefined });
            }}
            label={
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Icon name="zap" size={16} className="text-instant-subtle-fg" aria-hidden="true" />
                {t("library.instantOnly")}
              </span>
            }
            description={t("library.instantOnlyHint", { count: instantCount })}
          />
        </div>
      ) : null}

      {groups.map((group) => (
        <FacetSection key={group.key} group={group} isOn={(item) => isOn(group.key, item)} onToggle={toggle} />
      ))}
    </div>
  );
}

function FacetSection({
  group,
  isOn,
  onToggle,
}: {
  group: PanelGroup;
  isOn: (item: PanelItem) => boolean;
  onToggle: (key: FacetKey, value: string) => void;
}) {
  const t = useTranslations("styles");
  const id = useId();
  const [open, setOpen] = useState(true);
  const [allTopics, setAllTopics] = useState(false);
  const selected = group.subGroups.reduce((n, s) => n + s.items.filter(isOn).length, 0);
  const topics = foldedSubGroups(group.subGroups, isOn);
  const visibleSubGroups = allTopics ? group.subGroups : topics.shown;
  return (
    <section aria-labelledby={`${id}-title`} className="border-border border-t pt-4 first:border-t-0 first:pt-0">
      <h3 id={`${id}-title`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
          className="focus-visible:ring-focus-ring rounded-control flex w-full items-center justify-between gap-2 py-1 text-start text-sm font-semibold outline-none focus-visible:ring-2"
        >
          <span>
            {group.title}
            {selected ? (
              <span className="text-primary ms-1.5 tabular-nums">{t("list.count", { count: selected })}</span>
            ) : null}
          </span>
          <Icon
            name="chevron-down"
            size={16}
            aria-hidden="true"
            className={cn(
              "text-muted duration-fast transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div id={`${id}-body`} hidden={!open} className="mt-2 flex flex-col gap-3">
        {visibleSubGroups.map((sub, index) => (
          <SubGroup
            key={sub.title ?? index}
            title={sub.title}
            items={sub.items}
            display={group.display}
            groupTitle={group.title}
            isOn={isOn}
            onToggle={(value) => onToggle(group.key, value)}
          />
        ))}
        {topics.hidden > 0 || allTopics ? (
          <button
            type="button"
            onClick={() => setAllTopics((e) => !e)}
            aria-expanded={allTopics}
            className="text-primary focus-visible:ring-focus-ring rounded-control self-start text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
          >
            {allTopics ? t("library.showLessTopics") : t("library.showMoreTopics", { count: topics.hidden })}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SubGroup({
  title,
  items,
  display,
  groupTitle,
  isOn,
  onToggle,
}: {
  title: string | null;
  items: PanelItem[];
  display: PanelGroup["display"];
  groupTitle: string;
  isOn: (item: PanelItem) => boolean;
  onToggle: (value: string) => void;
}) {
  const t = useTranslations("styles.library");
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const folded = foldedItems(items.map((item) => ({ ...item, selected: isOn(item) })));
  const visible = expanded ? items : folded.shown;
  const more = expanded ? 0 : folded.hidden;
  const name = title ?? groupTitle;

  return (
    <div role="group" aria-labelledby={title ? `${id}-title` : undefined} aria-label={title ? undefined : name}>
      {title ? (
        <p id={`${id}-title`} className="text-muted mb-1 text-xs">
          {title}
        </p>
      ) : null}
      {display === "chips" ? (
        <ul className="flex flex-wrap gap-1.5">
          {visible.map((item) => {
            const on = isOn(item);
            return (
              <li key={item.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(item.value)}
                  className={cn(
                    "focus-visible:ring-focus-ring rounded-control inline-flex min-h-8 items-center gap-1 border px-2.5 text-sm outline-none focus-visible:ring-2",
                    on
                      ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
                      : "border-border hover:bg-bg-subtle",
                  )}
                >
                  {on ? <Icon name="check" size={14} aria-hidden="true" /> : null}
                  {item.label}
                  <span className="text-muted text-xs tabular-nums">{item.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item) => (
            <li key={item.value} className="flex min-h-9 items-center justify-between gap-2">
              <Checkbox
                className="min-w-0 items-center"
                checked={isOn(item)}
                onCheckedChange={() => onToggle(item.value)}
                label={
                  <span className="inline-flex items-center gap-2">
                    {item.swatch ? (
                      <MaterialSwatch size="sm" colour={item.swatch.colour} imageUrl={item.swatch.imageUrl} />
                    ) : null}
                    {item.label}
                  </span>
                }
              />
              <span className="text-muted text-xs tabular-nums" aria-hidden="true">
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="text-primary focus-visible:ring-focus-ring rounded-control mt-1 text-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
        >
          {expanded ? t("showLess") : t("showMore", { count: more })}
        </button>
      ) : null}
    </div>
  );
}

/** "ล้างทั้งหมด" for the panel's header — the search words and the order stay. */
export function ClearFiltersButton({ params, className }: { params: ListParams; className?: string }) {
  const t = useTranslations("styles.library");
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={cn(
        "text-muted hover:text-fg focus-visible:ring-focus-ring rounded-control text-sm outline-none focus-visible:ring-2",
        className,
      )}
      onClick={() =>
        startTransition(() =>
          router.replace(listHref({ ...clearFilters(params), category: params.category }), { scroll: false }),
        )
      }
    >
      {t("clearAll")}
    </button>
  );
}
