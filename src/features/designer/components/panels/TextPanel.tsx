"use client";

import { useTranslations } from "next-intl";

import { newText, TEXT_PRESETS } from "../../lib/create";
import { useEditor } from "../../store/editor";
import { useDesigner } from "../DesignerContext";

/** Text styles to start from: a heading, a subheading, body text. */
export function TextPanel() {
  const t = useTranslations("designer.textPanel");
  const addElement = useEditor((s) => s.addElement);
  const { center, catalog } = useDesigner();
  const family = catalog?.fonts[0]?.family;
  const sizes = { heading: "text-lg font-bold", subheading: "text-sm font-semibold", body: "text-xs" };

  return (
    <div className="space-y-2">
      {(Object.keys(TEXT_PRESETS) as (keyof typeof TEXT_PRESETS)[]).map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => addElement(newText(center(), t(`sample.${preset}`), preset, family))}
          className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring w-full rounded-lg border px-3 py-2 text-start outline-none focus-visible:ring-2"
        >
          <span className={sizes[preset]}>{t(`preset.${preset}`)}</span>
        </button>
      ))}
    </div>
  );
}
