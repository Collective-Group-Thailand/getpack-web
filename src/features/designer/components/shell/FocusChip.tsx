"use client";

import { useTranslations } from "next-intl";
import { findFace, type Dieline } from "@packio/dieline";

import { IconButton } from "@/ui/components/IconButton";
import { Kbd, KEYCAP } from "@/ui/components/Kbd";

import { useFaceNames } from "../../lib/useFaceNames";
import { useEditor } from "../../store/editor";

/** While a face is focused: which, and the way back to the whole sheet. */
export function FocusChip({ dieline }: { dieline: Dieline }) {
  const t = useTranslations("designer.focus");
  const focusedFaceId = useEditor((s) => s.focusedFaceId);
  const focusFace = useEditor((s) => s.focusFace);
  const names = useFaceNames(dieline);
  const face = focusedFaceId ? findFace(dieline, focusedFaceId) : undefined;
  if (!face) return null;
  return (
    <div
      role="status"
      className="bg-surface-raised border-border absolute start-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border py-1 ps-3 pe-1 text-sm shadow-md rtl:translate-x-1/2"
    >
      <span>{t("editing", { name: names.get(face.id) ?? face.label })}</span>
      <span className="text-muted hidden items-center gap-1 text-xs sm:flex">
        <Kbd>{KEYCAP.esc}</Kbd>
        {t("escape")}
      </span>
      <IconButton name="close" label={t("exit")} size="sm" variant="ghost" onClick={() => focusFace(null)} />
    </div>
  );
}
