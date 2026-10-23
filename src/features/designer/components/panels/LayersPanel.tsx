"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useEditor } from "../../store/editor";
import type { DesignElement } from "../../types";

const ICON: Record<DesignElement["type"], IconName> = {
  text: "text",
  image: "image",
  rect: "rectangle",
  circle: "circle",
  shape: "star",
  code: "scan",
};

type Side = "outside" | "inside";
type Row = { kind: "side"; side: Side; count: number } | { kind: "element"; el: DesignElement; side: Side };

/**
 * Every element as an accessible tree (studio-spec §6, U4.3) — the canvas without the canvas: the
 * outside and the inside of the board, each with its elements topmost first. Arrow keys move
 * through it (Home / End to the ends, Left to the side it belongs to), Enter or Space selects
 * (Shift adds), and the selection's own actions — lock, raise, lower — sit under the tree, so a
 * keyboard or screen-reader user can do what a drag-only canvas would not let them (WCAG 2.5.7,
 * 4.1.2).
 */
export function LayersPanel() {
  const t = useTranslations("designer.layers");
  const tProps = useTranslations("designer.properties");
  const elements = useEditor((s) => s.content.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const selectedId = useEditor((s) => s.selectedId);
  const { select, setLocked, reorder } = useEditor.getState();
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  if (!elements.length) return <p className="text-muted text-sm">{t("empty")}</p>;

  const sideOf = (el: DesignElement): Side => (el.side === "inside" ? "inside" : "outside");
  const rows: Row[] = (["outside", "inside"] as const).flatMap((side) => {
    const on = [...elements].reverse().filter((el) => sideOf(el) === side);
    if (on.length === 0) return [];
    return [
      { kind: "side" as const, side, count: on.length },
      ...on.map((el) => ({ kind: "element" as const, el, side })),
    ];
  });
  const current = Math.min(active, rows.length - 1);
  const nameOf = (el: DesignElement) =>
    el.name ?? (el.type === "text" ? el.text.split("\n")[0]!.slice(0, 24) : t(`type.${el.type}`));

  const pick = (row: Row, additive: boolean) => {
    if (row.kind !== "element") return;
    const editor = useEditor.getState();
    if (row.side !== editor.side) editor.setSide(row.side);
    select(row.el.id, additive);
  };
  const move = (index: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, index));
    setActive(next);
    items.current[next]?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const row = rows[current]!;
    if (event.key === "ArrowDown") move(current + 1);
    else if (event.key === "ArrowUp") move(current - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(rows.length - 1);
    else if (event.key === "ArrowLeft" && row.kind === "element")
      move(rows.findIndex((r) => r.kind === "side" && r.side === row.side));
    else if (event.key === "Enter" || event.key === " ") pick(row, event.shiftKey);
    else return;
    event.preventDefault();
  };

  const selected = elements.find((el) => el.id === selectedId);
  const stack = selected ? [...elements].reverse().filter((el) => sideOf(el) === sideOf(selected)) : [];
  const position = selected ? stack.findIndex((el) => el.id === selected.id) : -1;

  return (
    <div className="space-y-3">
      <ul role="tree" aria-label={t("label")} aria-multiselectable="true" onKeyDown={onKeyDown} className="space-y-0.5">
        {rows.map((row, index) =>
          row.kind === "side" ? (
            <li
              key={`side-${row.side}`}
              ref={(node) => {
                items.current[index] = node;
              }}
              role="treeitem"
              aria-level={1}
              aria-expanded="true"
              aria-selected={false}
              tabIndex={index === current ? 0 : -1}
              onFocus={() => setActive(index)}
              className="focus-visible:ring-focus-ring text-muted rounded-md px-2 py-1 text-xs font-semibold outline-none focus-visible:ring-2"
            >
              {t(`side.${row.side}`, { count: row.count })}
            </li>
          ) : (
            <li
              key={row.el.id}
              ref={(node) => {
                items.current[index] = node;
              }}
              role="treeitem"
              aria-level={2}
              aria-selected={selectedIds.includes(row.el.id)}
              tabIndex={index === current ? 0 : -1}
              onFocus={() => setActive(index)}
              onClick={(event) => {
                setActive(index);
                pick(row, event.shiftKey);
              }}
              className={cn(
                "focus-visible:ring-focus-ring flex cursor-default items-center gap-2 rounded-md py-1.5 ps-5 pe-2 text-sm outline-none focus-visible:ring-2",
                selectedIds.includes(row.el.id)
                  ? "bg-primary-subtle text-primary-subtle-fg"
                  : "hover:bg-surface-subtle",
              )}
            >
              <Icon name={ICON[row.el.type]} size={16} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{nameOf(row.el)}</span>
              {row.el.groupId ? <span className="text-xs">{t("grouped")}</span> : null}
              {row.el.locked ? <Icon name="lock" size={14} aria-label={t("locked")} /> : null}
            </li>
          ),
        )}
      </ul>

      {selected ? (
        <div className="flex items-center gap-1" role="group" aria-label={t("actions", { name: nameOf(selected) })}>
          <IconButton
            name={selected.locked ? "lock" : "key"}
            size="sm"
            variant="ghost"
            label={selected.locked ? t("unlock", { name: nameOf(selected) }) : t("lock", { name: nameOf(selected) })}
            aria-pressed={selected.locked === true}
            onClick={() => setLocked([selected.id], !selected.locked)}
          />
          <IconButton
            name="chevron-up"
            size="sm"
            variant="ghost"
            label={tProps("layerUp")}
            disabled={position <= 0}
            onClick={() => reorder(selected.id, "up")}
          />
          <IconButton
            name="chevron-down"
            size="sm"
            variant="ghost"
            label={tProps("layerDown")}
            disabled={position < 0 || position === stack.length - 1}
            onClick={() => reorder(selected.id, "down")}
          />
        </div>
      ) : null}
    </div>
  );
}

export { ICON as LAYER_ICONS };
