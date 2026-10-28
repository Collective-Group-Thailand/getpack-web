"use client";

import { useTranslations } from "next-intl";

import { IconButton } from "@/ui/components/IconButton";
import { Icon } from "@/ui/icons";

import { useEditor } from "../../store/editor";
import type { DesignElement } from "../../types";
import { ArrangePanel } from "../panels/ArrangePanel";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { useSwatches } from "../panels/swatches";
import { GuideToggles } from "./PrintViewMenu";

/**
 * The pro inspector (Phase 3 items 2 and 4): one element — every property in mm and pt, flips, rotation, alignment
 * to its panel, gradient fill, stroke style, image resolution and one-ink; several — align, distribute, one colour
 * for all, and order; nothing — the document (side, print, count) and the guides.
 */
export function ProInspector({
  printLabel,
  bleedMm,
  safeMm,
}: {
  printLabel: string | null;
  bleedMm: number;
  safeMm: number;
}) {
  const selectedIds = useEditor((s) => s.selectedIds);
  const el = useEditor((s) => s.content.elements.find((e) => e.id === s.selectedId));
  if (selectedIds.length > 1) return <ProMany />;
  if (el) return <PropertiesPanel el={el} studio />;
  return <ProDocument printLabel={printLabel} bleedMm={bleedMm} safeMm={safeMm} />;
}

function ProDocument({ printLabel, bleedMm, safeMm }: { printLabel: string | null; bleedMm: number; safeMm: number }) {
  const t = useTranslations("designer.shell.pro");
  const side = useEditor((s) => s.side);
  const count = useEditor((s) => s.content.elements.filter((e) => (e.side ?? "outside") === s.side).length);
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2" aria-labelledby="pro-doc">
        <h3 id="pro-doc" className="text-muted text-xs font-semibold">
          {t("document")}
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-muted">{t("side")}</dt>
          <dd className="text-end">{t(`sides.${side}`)}</dd>
          {printLabel ? (
            <>
              <dt className="text-muted">{t("print")}</dt>
              <dd className="text-end">{printLabel}</dd>
            </>
          ) : null}
          <dt className="text-muted">{t("elements")}</dt>
          <dd className="text-end tabular-nums">{count}</dd>
        </dl>
      </section>
      <p className="bg-surface-subtle text-muted flex items-start gap-2 rounded-xl p-2.5 text-xs">
        <Icon name="check" size={16} aria-hidden="true" className="text-primary mt-px shrink-0" />
        {t("hint")}
      </p>
      <section className="flex flex-col gap-2" aria-labelledby="pro-guides">
        <h3 id="pro-guides" className="text-muted text-xs font-semibold">
          {t("guides")}
        </h3>
        <GuideToggles bleedMm={bleedMm} safeMm={safeMm} />
      </section>
    </div>
  );
}

function ProMany() {
  const t = useTranslations("designer.shell.pro");
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.content.elements);
  const swatches = useSwatches();
  const { updateElements, duplicateSelected, removeSelected, reorder } = useEditor.getState();
  const selected = elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
  const colourAll = (hex: string) =>
    updateElements(
      selected
        .filter((e) => e.type !== "image")
        .map((e) => ({ id: e.id, patch: { fill: hex, fillGradient: undefined } as Partial<DesignElement> })),
    );
  const colours = [...swatches.map((s) => s.value), "#111111"].filter((c, i, all) => all.indexOf(c) === i).slice(0, 10);
  return (
    <div className="flex flex-col gap-4">
      <p className="bg-primary-subtle text-primary-subtle-fg flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold">
        <Icon name="layers" size={18} aria-hidden="true" />
        {t("many", { count: selectedIds.length })}
      </p>
      <ArrangePanel />
      <section className="flex flex-col gap-2" aria-labelledby="pro-colour-all">
        <h3 id="pro-colour-all" className="text-muted text-xs font-semibold">
          {t("colourAll")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {colours.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              title={hex}
              onClick={() => colourAll(hex)}
              className="size-[30px] rounded-lg border border-black/15"
              style={{ backgroundColor: hex }}
            />
          ))}
          <label
            title={t("colourCustom")}
            className="border-border-strong bg-surface text-muted hover:text-fg relative grid size-[30px] cursor-pointer place-items-center rounded-lg border border-dashed"
          >
            <Icon name="plus" size={14} aria-hidden="true" />
            <span className="sr-only">{t("colourCustom")}</span>
            <input type="color" onChange={(e) => colourAll(e.target.value)} className="absolute inset-0 opacity-0" />
          </label>
        </div>
      </section>
      <div className="flex flex-wrap gap-1">
        <IconButton name="copy" size="sm" variant="secondary" label={t("duplicate")} onClick={duplicateSelected} />
        <IconButton
          name="layer-top"
          size="sm"
          variant="secondary"
          label={t("front")}
          onClick={() => selected.forEach((e) => reorder(e.id, "top"))}
        />
        <IconButton
          name="layer-bottom"
          size="sm"
          variant="secondary"
          label={t("back")}
          onClick={() => [...selected].reverse().forEach((e) => reorder(e.id, "bottom"))}
        />
        <IconButton
          name="trash"
          size="sm"
          variant="secondary"
          className="text-danger"
          label={t("remove")}
          onClick={removeSelected}
        />
      </div>
    </div>
  );
}
