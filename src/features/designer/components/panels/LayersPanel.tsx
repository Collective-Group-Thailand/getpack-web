"use client";

import { useTranslations } from "next-intl";

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

/**
 * Every element as a list, topmost first — the canvas without the canvas: select (Shift adds),
 * lock, and reorder by keyboard or screen reader, which a drag-only canvas cannot offer
 * (WCAG 2.5.7, 4.1.2).
 */
export function LayersPanel() {
  const t = useTranslations("designer.layers");
  const tProps = useTranslations("designer.properties");
  const elements = useEditor((s) => s.content.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const { select, setLocked, reorder } = useEditor.getState();
  const top = [...elements].reverse();

  if (!top.length) return <p className="text-muted text-sm">{t("empty")}</p>;

  return (
    <ul aria-label={t("label")} className="space-y-1">
      {top.map((el, index) => {
        const selected = selectedIds.includes(el.id);
        const name = el.name ?? (el.type === "text" ? el.text.split("\n")[0]!.slice(0, 24) : t(`type.${el.type}`));
        return (
          <li key={el.id} className={cn("flex items-center gap-1 rounded-md pe-1", selected && "bg-primary-subtle")}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={(event) => select(el.id, event.shiftKey)}
              className="focus-visible:ring-focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none focus-visible:ring-2"
            >
              <Icon name={ICON[el.type]} size={16} aria-hidden="true" className="text-muted shrink-0" />
              <span className="truncate">{name}</span>
              {el.groupId ? <span className="text-muted text-xs">{t("grouped")}</span> : null}
            </button>
            <IconButton
              name={el.locked ? "lock" : "key"}
              size="sm"
              variant="ghost"
              label={el.locked ? t("unlock", { name }) : t("lock", { name })}
              aria-pressed={el.locked === true}
              onClick={() => setLocked([el.id], !el.locked)}
            />
            <IconButton
              name="chevron-up"
              size="sm"
              variant="ghost"
              label={tProps("layerUp")}
              disabled={index === 0}
              onClick={() => reorder(el.id, "up")}
            />
            <IconButton
              name="chevron-down"
              size="sm"
              variant="ghost"
              label={tProps("layerDown")}
              disabled={index === top.length - 1}
              onClick={() => reorder(el.id, "down")}
            />
          </li>
        );
      })}
    </ul>
  );
}

export { ICON as LAYER_ICONS };
