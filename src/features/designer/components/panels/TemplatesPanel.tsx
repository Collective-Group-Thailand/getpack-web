"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { allFaces, faceBounds } from "@packio/dieline";

import { browserApi } from "@/lib/api/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { toast } from "@/ui/components/Toast";

import { dielineOf, readDesign } from "../../document";
import { useEditor } from "../../store/editor";
import type { DesignContent, DesignElement } from "../../types";
import type { DesignerTemplate } from "../../data/api";
import { useDesigner } from "../DesignerContext";

/**
 * Starting points from the product's semi-designs (F4 C.5): applying a template brings its
 * artwork onto this box, each element moved proportionally from the template's sheet to this one.
 */
export function TemplatesPanel() {
  const t = useTranslations("designer.templates");
  const tCommon = useTranslations("common");
  const { catalog, mode } = useDesigner();
  const spec = useEditor((s) => s.spec);
  const hasContent = useEditor((s) => s.content.elements.length > 0);
  const [pending, setPending] = useState<DesignerTemplate | null>(null);
  const templates = (catalog?.templates ?? []).filter((template) => template.hasDesign);

  const apply = async (template: DesignerTemplate) => {
    setPending(null);
    try {
      const { data: detail } = await browserApi().GET("/v1/store/designer/templates/{templateId}", {
        params: { path: { templateId: template.id } },
      });
      // `document` is null until staff set one (`hasDesign`); the panel offers only those that have it.
      const document = detail?.document as { spec?: unknown; content?: unknown } | null | undefined;
      const read = document ? readDesign(document.spec, document.content) : null;
      if (!read || !spec) return;
      const from = dielineOf(read.spec);
      const to = dielineOf(spec);
      // Proportional mapping between the two sheets' face bounds (the whole sheet if faces differ).
      const box = (d: typeof from) => {
        const bs = allFaces(d).map(faceBounds);
        const x = Math.min(...bs.map((b) => b.x));
        const y = Math.min(...bs.map((b) => b.y));
        return {
          x,
          y,
          w: Math.max(...bs.map((b) => b.x + b.width)) - x,
          h: Math.max(...bs.map((b) => b.y + b.height)) - y,
        };
      };
      const a = box(from);
      const b = box(to);
      const content: DesignContent = {
        ...read.content,
        elements: read.content.elements.map(
          (el) =>
            ({ ...el, x: b.x + ((el.x - a.x) * b.w) / a.w, y: b.y + ((el.y - a.y) * b.h) / a.h }) as DesignElement,
        ),
      };
      useEditor.getState().commit(() => content);
      toast.success(t("applied", { name: template.name }));
    } catch {
      toast.error(t("failed"));
    }
  };

  if (mode === "admin" || !templates.length) return <p className="text-muted text-sm">{t("none")}</p>;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => (hasContent ? setPending(template) : void apply(template))}
              className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring flex w-full flex-col gap-1 rounded-lg border p-2 text-start outline-none focus-visible:ring-2"
            >
              <span className="flex h-12 items-center gap-1" aria-hidden="true">
                {template.colours.slice(0, 4).map((hex) => (
                  <span
                    key={hex}
                    className="border-border h-8 w-8 rounded-full border"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              <span className="text-sm font-medium">{template.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("replaceTitle")}
        description={t("replaceBody")}
        confirmLabel={t("replace")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => pending && void apply(pending)}
      />
    </>
  );
}
