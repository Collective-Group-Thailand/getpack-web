"use client";

import {
  buildFromRecipe,
  defaultsOf,
  dielineLines,
  flattenOpen,
  presetsOf,
  REFERENCE_MATERIALS,
  resolveParam,
  type Pt,
} from "@packio/dieline";
import { ALL_RECIPES, deviationFrom, INTAKE_TOLERANCE_MM, parseDxf, type DxfDrawing } from "@packio/dieline/library";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/features/shared/format";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";

/** What a match sends: the recipe and the deviation report (`MatchStyleIntakeDto`). */
export type MatchResult = Schemas["MatchStyleIntakeDto"];

const SIZE = 640;

function pathOf(lines: Pt[][], scale: number, dx: number, dy: number) {
  return lines
    .map((pts) =>
      pts.map((p, i) => `${i ? "L" : "M"}${(p[0] * scale + dx).toFixed(1)} ${(p[1] * scale + dy).toFixed(1)}`).join(""),
    )
    .join("");
}

/**
 * Laying a factory's DXF over a recipe (U3.6, D-272): Prepress opens the offer's DXF from disk
 * (downloaded from the offer — the file host's signed URL is not fetched by the page), picks the
 * closest recipe and board, adjusts its sizes until the two drawings agree, and reads the deviation
 * — the largest distance between their cut and crease lines, both ways, mirrored if that is closer.
 * Within 0.5 mm it is a match; the report goes to packio-api with the recipe. A PDF offer is
 * reviewed by eye: the page draws only DXF.
 */
export function IntakeMatcher({
  proposedBaseCode,
  onMatch,
  busy,
}: {
  proposedBaseCode: string | null;
  onMatch: (result: MatchResult) => void;
  busy: boolean;
}) {
  const t = useTranslations("catalogue.intakes.matcher");
  const format = useFormat();
  const initial = ALL_RECIPES.find((r) => r.base === proposedBaseCode) ?? ALL_RECIPES[0];
  const [drawing, setDrawing] = useState<DxfDrawing | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);
  const [recipeId, setRecipeId] = useState(initial.id);
  const [boardId, setBoardId] = useState("board-350");
  const recipe = ALL_RECIPES.find((r) => r.id === recipeId)!;
  const sizeParams = recipe.params
    .map((p) => resolveParam(p))
    .filter((p) => p.group === "size" && (p.kind === "length" || p.kind === "number"));
  const [values, setValues] = useState<Record<string, string>>({});
  const preset = { ...defaultsOf(recipe), ...presetsOf(recipe)[0]?.values } as Record<string, unknown>;
  const valueOf = (key: string) => values[key] ?? String(preset[key] ?? "");

  const built = useMemo(() => {
    try {
      const v = { ...preset } as Record<string, unknown>;
      for (const p of sizeParams) {
        const n = Number(values[p.key]);
        if (values[p.key] !== undefined && Number.isFinite(n) && n > 0) v[p.key] = n;
      }
      return buildFromRecipe(recipe, v as never, REFERENCE_MATERIALS[boardId]).dieline;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the recipe, board and typed sizes are the inputs
  }, [recipeId, boardId, values]);
  const deviation = useMemo(() => (drawing && built ? deviationFrom(drawing, built) : null), [drawing, built]);

  // The overlay: the recipe's cut and crease lines and the DXF's, top-left corners together.
  const overlay = useMemo(() => {
    if (!built) return null;
    const engine = dielineLines(built)
      .filter((l) => l.role === "cut" || l.role === "crease")
      .map((l) => flattenOpen(l.edge, 0.2));
    const all = engine.flat();
    const minX = Math.min(...all.map((p) => p[0]));
    const minY = Math.min(...all.map((p) => p[1]));
    const laid = engine.map((pts) => pts.map(([x, y]) => [x - minX, y - minY] as Pt));
    const theirs = (drawing?.polylines ?? []).map((pl) =>
      pl.points.map(([x, y]) => (deviation?.mirrored ? ([drawing!.width - x, y] as Pt) : ([x, y] as Pt))),
    );
    const w = Math.max(...laid.flat().map((p) => p[0]), drawing?.width ?? 0);
    const h = Math.max(...laid.flat().map((p) => p[1]), drawing?.height ?? 0);
    const scale = (SIZE - 20) / Math.max(w, h, 1);
    return { engine: pathOf(laid, scale, 10, 10), theirs: pathOf(theirs, scale, 10, 10), height: h * scale + 20 };
  }, [built, drawing, deviation?.mirrored]);

  const recipeOptions = ALL_RECIPES.filter((r) => r.base).map((r) => ({
    value: r.id,
    label: `${r.base} · ${r.name.th} (${r.id})`,
  }));
  const boardOptions = Object.keys(REFERENCE_MATERIALS).map((id) => ({ value: id, label: id }));

  return (
    <div className="flex flex-col gap-4">
      <FileDropzone
        accept=".dxf"
        maxBytes={20 * 1024 * 1024}
        onFiles={async (files) => {
          const f = files[0];
          if (!f) return;
          try {
            const read = parseDxf(await f.text());
            setReadError(read.polylines.length === 0);
            setDrawing(read.polylines.length ? read : null);
            setFileName(f.name);
          } catch {
            setReadError(true);
            setDrawing(null);
          }
        }}
        labels={{
          prompt: fileName ? t("opened", { name: fileName }) : t("drop"),
          browse: t("browse"),
          hint: t("hint"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      {readError ? <p className="text-danger text-sm">{t("unreadable")}</p> : null}
      {drawing ? (
        <p className="text-muted text-sm">
          {t("read", {
            lines: drawing.polylines.length,
            skipped: drawing.skipped,
            w: format.number(Math.round(drawing.width)),
            h: format.number(Math.round(drawing.height)),
          })}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("recipe")}>
          <Select
            value={recipeId}
            onValueChange={(next) => {
              setRecipeId(next);
              setValues({});
            }}
            options={recipeOptions}
          />
        </Field>
        <Field label={t("board")}>
          <Select value={boardId} onValueChange={setBoardId} options={boardOptions} />
        </Field>
        {sizeParams.map((p) => (
          <Field key={p.key} label={t("size", { name: p.label.th, unit: p.kind === "length" ? "mm" : "" })}>
            <Input
              type="number"
              inputMode="decimal"
              value={valueOf(p.key)}
              onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>

      {overlay ? (
        <figure className="flex flex-col gap-2">
          <svg
            role="img"
            aria-label={t("overlayLabel")}
            viewBox={`0 0 ${SIZE} ${Math.ceil(overlay.height)}`}
            className="border-border bg-surface w-full max-w-[40rem] rounded-md border"
          >
            <path d={overlay.engine} fill="none" stroke="var(--color-primary)" strokeWidth={1.2} />
            <path d={overlay.theirs} fill="none" stroke="var(--color-danger)" strokeWidth={0.8} strokeDasharray="3 2" />
          </svg>
          <figcaption className="text-muted text-xs">{t("legend")}</figcaption>
        </figure>
      ) : (
        <p className="text-danger text-sm">{t("buildFailed")}</p>
      )}

      {deviation ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={deviation.matches ? "success" : "danger"}>
            {deviation.matches ? t("matches") : t("doesNotMatch")}
          </Badge>
          <span className="text-sm tabular-nums">
            {t("deviation", {
              max: format.number(Number(deviation.max.toFixed(2))),
              mean: format.number(Number(deviation.mean.toFixed(2))),
              tolerance: format.number(INTAKE_TOLERANCE_MM),
            })}
          </span>
          {deviation.mirrored ? <span className="text-muted text-sm">{t("mirrored")}</span> : null}
        </div>
      ) : null}

      <div>
        <Button
          disabled={!deviation}
          loading={busy}
          onClick={() => {
            if (!deviation) return;
            const sizes = sizeParams.map((p) => `${p.key}=${valueOf(p.key)}`).join(", ");
            onMatch({
              recipeId,
              deviations: [
                {
                  aspect: "max_deviation_mm",
                  note: `${deviation.max.toFixed(2)} (≤ ${INTAKE_TOLERANCE_MM}: ${deviation.matches ? "yes" : "no"})`,
                },
                { aspect: "mean_deviation_mm", note: deviation.mean.toFixed(2) },
                { aspect: "size_delta_mm", note: deviation.sizeDelta.map((d) => d.toFixed(2)).join(" × ") },
                { aspect: "mirrored", note: deviation.mirrored ? "yes" : "no" },
                { aspect: "parameters", note: `${sizes}; board ${boardId}` },
              ],
            });
          }}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
