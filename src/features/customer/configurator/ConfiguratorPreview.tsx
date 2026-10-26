"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { BoxPreview } from "@/features/designer/components/BoxPreview";
import { BoxPreview3D } from "@/features/designer/components/BoxPreview3D";
import { ProductMockup2D, type MockupKind } from "@/features/designer/components/ProductMockup2D";
import { resolveStyleId } from "@getpack/dieline";

import type { BoxStyleId } from "@/features/designer/types";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

import { optionsById, sizeKindOf } from "./model";
import { patternOf, type Configurator, type ConfiguratorState } from "./state";

/** The `@getpack/dieline` style of the chosen pattern, when it draws one (aliases like `rte` resolved). */
export function boxStyleOf(configurator: Configurator, state: ConfiguratorState): BoxStyleId | null {
  return resolveStyleId(patternOf(configurator, state)?.dielineKey);
}

const MOCKUP_OF: Partial<Record<Configurator["calculator"], MockupKind>> = {
  label: "label",
  tag_sleeve: "tag",
  pouch: "pouch",
};

/**
 * "Show the box" (design-system.md §1.2, D-152): the 3D box for box styles, turning live as the
 * size and material change, with the flat dieline one tap away; a 2D mockup for labels, tags,
 * sleeves and pouches. Nothing is shown for a product with no shape (a service).
 */
export function ConfiguratorPreview({
  configurator,
  state,
  productName,
  side,
}: {
  configurator: Configurator;
  state: ConfiguratorState;
  productName: string;
  /** The panel beside the box (size, dimensions, spec): under it on a narrow page. */
  side?: React.ReactNode;
}) {
  const t = useTranslations("configurator.preview");
  const locale = useLocale();
  const [view, setView] = useState<"3d" | "flat">("3d");

  const byId = optionsById(configurator);
  const chosen = Object.values(state.choices)
    .flat()
    .flatMap((id) => (id && byId.has(id) ? [byId.get(id)!] : []));
  const material = state.choices.material?.[0] ? byId.get(state.choices.material[0]) : undefined;
  const colour = material?.swatchHex ?? "#e8e2d6";
  const printed = (state.choices.print_front?.length ?? 0) > 0 || (state.choices.print_set?.length ?? 0) > 0;
  const codes = new Set(chosen.map((option) => option.code));
  const materialName = material ? pick(locale, material.nameTh, material.nameEn) : "";

  const { l, w, d } = state.dims;
  const gusset = state.dims.b ?? state.dims.s ?? 0;
  const style = boxStyleOf(configurator, state);
  const kind = sizeKindOf(configurator);

  if (kind === "none") return null;

  if (kind === "box") {
    const dims = { length: l ?? 100, width: w ?? 100, height: d ?? 50 };
    const label = t("boxLabel", {
      name: productName,
      l: dims.length,
      w: dims.width,
      h: dims.height,
      material: materialName,
    });
    return (
      <div className="border-border bg-bg-subtle rounded-card grid overflow-hidden border min-[1100px]:grid-cols-[minmax(0,1fr)_14rem]">
        <figure className="m-0 flex min-w-0 flex-col gap-3 p-4">
          {style ? (
            <SegmentedControl
              label={t("view")}
              size="sm"
              value={view}
              onValueChange={setView}
              options={[
                { value: "3d", label: t("view3d") },
                { value: "flat", label: t("viewFlat") },
              ]}
              className="self-center"
            />
          ) : null}
          {view === "flat" && style ? (
            <div className="h-64">
              <BoxPreview styleId={style} values={dims} colour={colour} label={t("flatLabel", { name: productName })} />
            </div>
          ) : (
            <BoxPreview3D
              style={style ?? "rsc"}
              dims={dims}
              colour={colour}
              printed={printed}
              label={label}
              labels={{
                rotateLeft: t("rotateLeft"),
                rotateRight: t("rotateRight"),
                tiltUp: t("tiltUp"),
                tiltDown: t("tiltDown"),
                reset: t("reset"),
              }}
            />
          )}
          <figcaption className="text-muted text-center text-xs">
            {printed ? t("captionPrinted") : t("caption")}
          </figcaption>
        </figure>
        {side}
      </div>
    );
  }

  const mockup = MOCKUP_OF[configurator.calculator] ?? "label";
  const shape = chosen.find((option) => ["rect", "circle", "oval", "custom"].includes(option.code))?.code;
  return (
    <figure className="border-border bg-bg-subtle flex flex-col gap-3 rounded-2xl border p-4">
      <ProductMockup2D
        kind={mockup}
        widthMm={w ?? 50}
        lengthMm={l ?? 50}
        gussetMm={gusset ?? 0}
        shape={shape}
        colour={colour}
        printed={printed}
        zip={codes.has("zip")}
        window={codes.has("window")}
        hole={codes.has("hole") || codes.has("hole-string")}
        string={codes.has("hole-string")}
        label={t("flatItemLabel", { name: productName, w: w ?? 0, l: l ?? 0, material: materialName })}
      />
      <figcaption className="text-muted text-center text-xs">{t("caption2d")}</figcaption>
    </figure>
  );
}
