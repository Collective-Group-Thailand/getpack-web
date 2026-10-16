"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DEFAULT_SAFE_MM } from "@getpack/dieline";

import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { dielineOf, hingesOf } from "../../document";
import { measureText } from "../../lib/measure";
import { uprightAngles } from "../../lib/upright";
import { useEditor } from "../../store/editor";
import { readLayout, reflow } from "../../templates/layout";
import type { DesignElement } from "../../types";
import { useDesigner } from "../DesignerContext";

type Template = Schemas["StudioTemplateDto"];
const USE_CASES = ["coffee", "cosmetics", "snacks", "e_commerce", "gift", "electronics", "pharmacy"] as const;

/**
 * getpack's own templates (U4.4, `store.studio.listTemplates`): constraint layouts that re-flow
 * onto whatever box is on screen — any style, any size — with text kept upright on lids and within
 * its point range. Filtered by use case; applying replaces the artwork (after asking, when there is
 * some), as one undo step.
 */
export function StudioTemplates() {
  const t = useTranslations("designer.studioTemplates");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const { catalog } = useDesigner();
  const spec = useEditor((s) => s.spec);
  const hasContent = useEditor((s) => s.content.elements.length > 0);
  const [useCase, setUseCase] = useState<(typeof USE_CASES)[number] | "all">("all");
  const [pending, setPending] = useState<Template | null>(null);
  const templates = useQuery({
    queryKey: [...queryKeys.zone("customer"), "studio-templates", useCase],
    queryFn: async () =>
      (
        await browserApi().GET("/v1/store/studio/templates", {
          params: { query: useCase === "all" ? {} : { useCase } },
        })
      ).data!,
    staleTime: 10 * 60_000,
  });

  const apply = (template: Template) => {
    setPending(null);
    const layout = readLayout(template.layoutSchemaVersion, template.layout);
    if (!layout || !spec) return void toast.error(t("failed"));
    const d = dielineOf(spec);
    const hinges = hingesOf(spec);
    const { elements, pattern } = reflow(layout, d, {
      locale,
      safeMm: catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM,
      upright: hinges ? uprightAngles(d, hinges) : {},
      measure: (text, fontSize, fontFamily, bold) =>
        measureText({ text, fontSize, fontFamily, fontStyle: bold ? "bold" : "normal" }).width,
    });
    const editor = useEditor.getState();
    // The inside keeps what it has; the outside becomes the template.
    const inside = editor.content.elements.filter((el) => el.side === "inside");
    editor.commit(() => ({
      pattern,
      elements: [
        ...inside,
        ...elements.map((el, i) => ({ ...el, id: `tpl-${Date.now().toString(36)}-${i}` }) as DesignElement),
      ],
    }));
    toast.success(t("applied", { name: locale === "en" ? template.nameEn : template.nameTh }));
  };

  const list = templates.data ?? [];
  return (
    <section className="space-y-3" aria-labelledby="studio-templates">
      <h3 id="studio-templates" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <Select
        aria-label={t("useCase")}
        value={useCase}
        onValueChange={(value) => setUseCase(value as typeof useCase)}
        options={[
          { value: "all", label: t("all") },
          ...USE_CASES.map((value) => ({ value, label: t(`useCases.${value}`) })),
        ]}
      />
      {templates.isSuccess && list.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
      <ul className="grid grid-cols-2 gap-2" aria-label={t("title")}>
        {list.map((template) => {
          const layout = readLayout(template.layoutSchemaVersion, template.layout);
          return (
            <li key={template.id}>
              <button
                type="button"
                disabled={!layout || !spec}
                onClick={() => (hasContent ? setPending(template) : apply(template))}
                className="border-border hover:bg-surface-subtle focus-visible:ring-focus-ring flex w-full flex-col gap-1 rounded-lg border p-2 text-start outline-none focus-visible:ring-2 disabled:opacity-60"
              >
                <span className="flex h-8 items-center gap-1" aria-hidden="true">
                  {layout
                    ? (["primary", "accent", "ink", "paper"] as const).map((role) => (
                        <span
                          key={role}
                          className="border-border h-6 w-6 rounded-full border"
                          style={{ backgroundColor: layout.palette[role] }}
                        />
                      ))
                    : null}
                </span>
                <span className="text-sm font-medium">{locale === "en" ? template.nameEn : template.nameTh}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("replaceTitle")}
        description={t("replaceBody")}
        confirmLabel={t("replace")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => pending && apply(pending)}
      />
    </section>
  );
}
