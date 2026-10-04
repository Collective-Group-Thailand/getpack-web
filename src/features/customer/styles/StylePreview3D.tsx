"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  buildFromRecipe,
  defaultsOf,
  presetsOf,
  REFERENCE_BY_CATEGORY,
  REFERENCE_MATERIALS,
  styleFromRecipe,
  variantsOf,
} from "@packio/dieline";
import { ALL_RECIPES } from "@packio/dieline/library";

import Preview3D from "@/features/designer/components/Preview3D";

import { keyOf } from "./variants";

/**
 * The chosen variant in 3D (U3.5 §2), drawn by the engine from the recipe of the style's base whose
 * variant has exactly these options — the same recipe packio-api draws it from — at the first of
 * its starting sizes the variant is valid at, on the reference board of its category. Loaded only
 * when asked for (`next/dynamic`): the engine and three.js stay out of the page's first load.
 */
export default function StylePreview3D({
  code,
  options,
  name,
}: {
  code: string;
  options: Record<string, unknown>;
  name: string;
}) {
  const t = useTranslations("styles");
  const built = useMemo(() => {
    const wanted = Object.entries(options).map(([axis, value]) => [axis, keyOf(value)] as const);
    for (const recipe of ALL_RECIPES.filter((r) => r.base === code)) {
      const variant = variantsOf(recipe).find(
        (v) =>
          wanted.every(([axis, value]) => v.axes[axis] === value) &&
          Object.keys(v.axes).every((a) => options[a] !== undefined || a in (recipe.variant ?? {})),
      );
      if (!variant) continue;
      const ids = REFERENCE_BY_CATEGORY[recipe.category];
      const id = ids.find((x) => recipe.materials.includes(REFERENCE_MATERIALS[x].kind)) ?? ids[0];
      const material = REFERENCE_MATERIALS[id];
      const style = styleFromRecipe(recipe);
      const at = presetsOf(recipe).map((p) => ({ ...defaultsOf(recipe), ...p.values, ...variant.values }));
      const values = at.find((v) => style.validate(v as never, material).every((i) => i.severity !== "error")) ?? at[0];
      return { ...buildFromRecipe(recipe, values, material), material };
    }
    return null;
  }, [code, options]);

  if (!built) return <p className="text-muted text-sm">{t("detail.no3d")}</p>;
  return (
    <div className="flex flex-col gap-2">
      {!built.hinges ? <p className="text-muted text-sm">{t("detail.flatOnly")}</p> : null}
      <Preview3D
        dieline={built.dieline}
        hinges={built.hinges}
        artwork={null}
        boardColour={built.material.kind === "corrugated" ? "#c8a27a" : "#f4f1ea"}
        material={built.material}
        name={name}
        labels={{
          canvas: t("preview3d.canvas"),
          fold: t("preview3d.fold"),
          play: t("preview3d.play"),
          rotateLeft: t("preview3d.rotateLeft"),
          rotateRight: t("preview3d.rotateRight"),
          tiltUp: t("preview3d.tiltUp"),
          tiltDown: t("preview3d.tiltDown"),
          reset: t("preview3d.reset"),
          lighting: t("preview3d.lighting"),
          lightingPreset: {
            studio: t("preview3d.studio"),
            daylight: t("preview3d.daylight"),
            warm: t("preview3d.warm"),
          },
          exportPng: t("preview3d.exportPng"),
          flat: t("preview3d.flat"),
        }}
      />
    </div>
  );
}
