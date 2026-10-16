"use client";

import { useTranslations } from "next-intl";
import { findFace, faceBounds } from "@getpack/dieline";

import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";

import { alignMoves, distributeMoves, type AlignMode } from "../../lib/align";
import { elementBox, localSize } from "../../lib/geometry";
import { measureText } from "../../lib/measure";
import { useEditor } from "../../store/editor";
import type { DesignElement } from "../../types";
import { useDesigner } from "../DesignerContext";

export const boxOfElement = (el: DesignElement) =>
  elementBox(el, localSize(el, el.type === "text" ? measureText(el) : undefined));

/**
 * Arrange: align (to each other, or to the focused face for a single element), distribute, group
 * and lock — every canvas arrangement also as a button, with the keyboard shortcut beside it.
 */
export function ArrangePanel() {
  const t = useTranslations("designer.arrange");
  const { dieline } = useDesigner();
  const elements = useEditor((s) => s.content.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const focusedFaceId = useEditor((s) => s.focusedFaceId);
  const { moveElements, group, ungroup, setLocked } = useEditor.getState();
  const selected = elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
  const items = selected.map((e) => ({ id: e.id, box: boxOfElement(e) }));
  const face = focusedFaceId && dieline ? findFace(dieline, focusedFaceId) : undefined;
  const reference = face
    ? faceBounds(face)
    : items.length === 1 && dieline
      ? { x: 0, y: 0, width: dieline.width, height: dieline.height }
      : null;
  const grouped = selected.some((e) => e.groupId);
  const locked = elements.filter((e) => selectedIds.includes(e.id)).every((e) => e.locked);

  const align = (mode: AlignMode) => moveElements(alignMoves(items, mode, reference));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("heading", { count: selectedIds.length })}</h3>
      <div className="grid grid-cols-6 gap-1" role="group" aria-label={t("align")}>
        {(
          [
            ["left", "align-left"],
            ["center", "align-center"],
            ["right", "align-right"],
            ["top", "chevron-up"],
            ["middle", "minus"],
            ["bottom", "chevron-down"],
          ] as const
        ).map(([mode, icon]) => (
          <IconButton
            key={mode}
            name={icon}
            size="sm"
            variant="ghost"
            label={t(`mode.${mode}`)}
            disabled={!items.length}
            onClick={() => align(mode)}
          />
        ))}
      </div>
      <p className="text-muted text-xs">{face ? t("toFace") : items.length > 1 ? t("toSelection") : t("toSheet")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={items.length < 3}
          onClick={() => moveElements(distributeMoves(items, "x"))}
        >
          {t("distributeX")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={items.length < 3}
          onClick={() => moveElements(distributeMoves(items, "y"))}
        >
          {t("distributeY")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={selectedIds.length < 2 && !grouped}
          onClick={grouped ? ungroup : group}
        >
          {grouped ? t("ungroup") : t("group")}
        </Button>
        <Button size="sm" variant="secondary" iconStart="lock" onClick={() => setLocked(selectedIds, !locked)}>
          {locked ? t("unlock") : t("lock")}
        </Button>
      </div>
    </div>
  );
}
