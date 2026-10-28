"use client";

import { useEffect } from "react";

import { KEYCAP } from "@/ui/components/Kbd";
import type { Shortcut } from "@/ui/components/ShortcutsOverlay";

import { useEditor } from "../../store/editor";

/**
 * The editor's keyboard shortcuts. Skipped while a form control has focus, so typing "d" in the
 * name field does not duplicate an element, and Ctrl+A there selects the text, not the artwork.
 */
export function useEditorShortcuts({ editable, save }: { editable: boolean; save: () => void }) {
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], [role='dialog']")) return;

      const s = useEditor.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const has = s.selectedIds.length > 0;
      const run = (fn: () => void) => {
        event.preventDefault();
        fn();
      };

      if (mod && key === "z") run(() => (event.shiftKey ? s.redo() : s.undo()));
      else if (mod && key === "y") run(s.redo);
      else if (mod && key === "s") run(save);
      else if (mod && key === "a") run(s.selectAll);
      else if (mod && key === "c" && has) run(s.copySelected);
      else if (mod && key === "x" && has)
        run(() => {
          s.copySelected();
          s.removeSelected();
        });
      else if (mod && key === "v") run(s.paste);
      else if (mod && key === "d" && has) run(s.duplicateSelected);
      else if (mod && key === "g" && has) run(event.shiftKey ? s.ungroup : s.group);
      else if (mod && key === "l" && has) {
        const locked = s.content.elements.filter((e) => s.selectedIds.includes(e.id)).every((e) => e.locked);
        run(() => s.setLocked(s.selectedIds, !locked));
      } else if ((event.key === "Delete" || event.key === "Backspace") && has) run(s.removeSelected);
      else if (event.key === "Escape") {
        // One step back at a time: the selection first, then the focused face.
        if (has) s.select(null);
        else if (s.focusedFaceId) s.focusFace(null);
      } else if (event.key.startsWith("Arrow") && has) {
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        run(() => s.moveElements(s.selectedIds.map((id) => ({ id, dx, dy }))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, save]);
}

/**
 * The `?` overlay's list, in the words of `t` (`designer.shortcuts`). With the Studio shell's `mode` (C8) it adds
 * the view keys and, in pro, the toolbox's single keys and the drawing modifiers (Phase 3 item 8).
 */
export function shortcutList(t: (key: string) => string, mod: string, mode?: "easy" | "pro"): Shortcut[] {
  const k = (...keys: string[]) => keys;
  const shell: Shortcut[] = !mode
    ? []
    : [
        { group: t("groups.view"), keys: k(KEYCAP.shift, "1"), description: t("fit") },
        { group: t("groups.view"), keys: k("+", "−"), description: t("zoom") },
        { group: t("groups.view"), keys: k(mod, t("wheel")), description: t("zoomWheel") },
        { group: t("groups.view"), keys: k(t("space"), t("drag")), description: t("pan") },
        { group: t("groups.selection"), keys: k(KEYCAP.shift, "←"), description: t("nudge10") },
        { group: t("groups.selection"), keys: k(mod, "]"), description: t("forward") },
        { group: t("groups.selection"), keys: k(mod, "["), description: t("backward") },
        { group: t("groups.selection"), keys: k("Alt", t("drag")), description: t("noSnap") },
        { group: t("groups.edit"), keys: k(t("doubleClick")), description: t("editText") },
        ...(mode === "pro"
          ? [
              { group: t("groups.tools"), keys: k("V"), description: t("tools.select") },
              { group: t("groups.tools"), keys: k("H"), description: t("tools.hand") },
              { group: t("groups.tools"), keys: k("Z"), description: t("tools.zoom") },
              { group: t("groups.tools"), keys: k("T"), description: t("tools.text") },
              { group: t("groups.tools"), keys: k("R"), description: t("tools.rect") },
              { group: t("groups.tools"), keys: k("E"), description: t("tools.ellipse") },
              { group: t("groups.tools"), keys: k("L"), description: t("tools.line") },
              { group: t("groups.tools"), keys: k("P"), description: t("tools.pen") },
              { group: t("groups.tools"), keys: k("I"), description: t("tools.eyedropper") },
              { group: t("groups.tools"), keys: k("C"), description: t("tools.comment") },
              { group: t("groups.tools"), keys: k(KEYCAP.shift, t("drag")), description: t("tools.constrain") },
              { group: t("groups.tools"), keys: k("Enter"), description: t("tools.penFinish") },
              { group: t("groups.tools"), keys: k("⌫"), description: t("tools.penBack") },
              { group: t("groups.tools"), keys: k(t("rulerDrag")), description: t("tools.guide") },
            ]
          : []),
      ];
  return [
    ...shell,
    { group: t("groups.edit"), keys: k(mod, KEYCAP.z), description: t("undo") },
    { group: t("groups.edit"), keys: k(mod, KEYCAP.shift, KEYCAP.z), description: t("redo") },
    { group: t("groups.edit"), keys: k(mod, "S"), description: t("save") },
    { group: t("groups.edit"), keys: k(mod, "C"), description: t("copy") },
    { group: t("groups.edit"), keys: k(mod, "X"), description: t("cut") },
    { group: t("groups.edit"), keys: k(mod, "V"), description: t("paste") },
    { group: t("groups.edit"), keys: k(mod, KEYCAP.d), description: t("duplicate") },
    { group: t("groups.edit"), keys: k(KEYCAP.del), description: t("delete") },
    { group: t("groups.selection"), keys: k(mod, "A"), description: t("selectAll") },
    { group: t("groups.selection"), keys: k(KEYCAP.shift, t("click")), description: t("addToSelection") },
    { group: t("groups.selection"), keys: k(KEYCAP.shift, t("drag")), description: t("marquee") },
    { group: t("groups.selection"), keys: k(mod, "G"), description: t("group") },
    { group: t("groups.selection"), keys: k(mod, KEYCAP.shift, "G"), description: t("ungroup") },
    { group: t("groups.selection"), keys: k(mod, "L"), description: t("lock") },
    { group: t("groups.selection"), keys: k("←", "→", "↑", "↓"), description: t("nudge") },
    { group: t("groups.view"), keys: k(t("doubleClick")), description: t("focusFace") },
    { group: t("groups.view"), keys: k(KEYCAP.esc), description: t("escape") },
    { group: t("groups.view"), keys: k(KEYCAP.question), description: t("overlay") },
  ];
}
