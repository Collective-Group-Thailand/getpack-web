"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { ARTWORK_DEFAULTS } from "@/features/designer/canvas-colors";
import { FONT_FAMILIES } from "@/features/designer/catalog";
import { useEditor } from "@/features/designer/store/editor";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Separator } from "@/ui/components/Separator";
import { toast } from "@/ui/components/Toast";
import { Tooltip } from "@/ui/components/Tooltip";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * A toolbar button: icon above a label, because a shop-floor or first-time user should not
 * have to hover to learn what a glyph means. The label is the accessible name; the tooltip
 * only repeats it for the mouse.
 */
function Tool({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        className={cn(
          "flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px]",
          "duration-fast ease-standard transition-colors disabled:opacity-35",
          active ? "bg-primary-subtle text-primary-subtle-fg" : "text-fg hover:bg-surface-subtle",
        )}
      >
        <Icon name={icon} size={20} />
        <span className="whitespace-nowrap">{label}</span>
      </button>
    </Tooltip>
  );
}

export function Toolbar({
  center,
  onOpenSetup,
  onOpenRules,
  patternOpen,
  onTogglePattern,
}: {
  center: () => { x: number; y: number };
  onOpenSetup: () => void;
  onOpenRules: () => void;
  patternOpen: boolean;
  onTogglePattern: () => void;
}) {
  const t = useTranslations("designer");
  const tCommon = useTranslations("common");
  const { past, future, undo, redo, resetAll, resetPattern, addElement, content } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

  const addText = () => {
    const c = center();
    addElement({
      ...base,
      type: "text",
      x: c.x - 30,
      y: c.y - 6,
      text: t("defaultText"),
      fontSize: 10,
      fontFamily: FONT_FAMILIES[0],
      fontStyle: "bold",
      fill: ARTWORK_DEFAULTS.text,
      align: "center",
    });
  };

  const addShape = (type: "rect" | "circle") => {
    const c = center();
    addElement({
      ...base,
      type,
      x: c.x - 25,
      y: c.y - 25,
      width: 50,
      height: 50,
      fill: ARTWORK_DEFAULTS.shapeFill,
      stroke: ARTWORK_DEFAULTS.shapeStroke,
      strokeWidth: 0,
      cornerRadius: 0,
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const c = center();
        const width = 80;
        const height = (img.height / img.width) * width;
        addElement({ ...base, type: "image", src, x: c.x - width / 2, y: c.y - height / 2, width, height });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar.label")}
      className="border-border bg-surface flex items-center gap-0.5 overflow-x-auto border-b px-2 py-1"
    >
      <Tool icon="undo" label={t("toolbar.undo")} onClick={undo} disabled={!past.length} />
      <Tool icon="redo" label={t("toolbar.redo")} onClick={redo} disabled={!future.length} />
      <Tool
        icon="reset"
        label={t("toolbar.resetAll")}
        onClick={() => setResetOpen(true)}
        disabled={!content.elements.length && content.pattern.kind === "none"}
      />
      <Tool
        icon="pattern"
        label={t("toolbar.resetPattern")}
        onClick={resetPattern}
        disabled={content.pattern.kind === "none"}
      />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <Tool icon="text" label={t("toolbar.text")} onClick={addText} />
      <Tool icon="image" label={t("toolbar.image")} onClick={() => fileRef.current?.click()} />
      <Tool icon="rectangle" label={t("toolbar.rectangle")} onClick={() => addShape("rect")} />
      <Tool icon="circle" label={t("toolbar.circle")} onClick={() => addShape("circle")} />
      <Tool icon="palette" label={t("toolbar.pattern")} onClick={onTogglePattern} active={patternOpen} />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <Tool icon="box" label={t("toolbar.boxSetup")} onClick={onOpenSetup} />
      <Tool icon="help" label={t("toolbar.printRules")} onClick={onOpenRules} />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <AlertDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        tone="destructive"
        title={t("resetAllConfirm.title")}
        description={t("resetAllConfirm.body")}
        confirmLabel={t("resetAllConfirm.confirm")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => {
          resetAll();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
