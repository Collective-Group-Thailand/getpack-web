"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";
import { getStyle, RECIPES, type ParamValues } from "@packio/dieline";

import { loadOf, useAdvisor, useAdvisorMethod, type AdvisorOption } from "@/features/customer/configurator/advisor";
import { LogisticsStep } from "@/features/customer/configurator/LogisticsStep";
import { groupsOf, sizeKindOf, type Configurator } from "@/features/customer/configurator/model";
import { DEFAULT_LOAD, type LoadInput } from "@/features/customer/configurator/state";
import { axisLabel, valueLabel, type StylesT } from "@/features/customer/styles/labels";
import { change, optionsOf, selectionOf, variantOf, type Selection } from "@/features/customer/styles/variants";
import { boardColour, materialSpecOf, materialsFor, withMaterial } from "@/features/designer/catalog";
import { patternIssues } from "@/features/designer/components/SetupModal";
import type { DesignerCatalog } from "@/features/designer/data/api";
import { insideSize } from "@/features/designer/document";
import { useEditor } from "@/features/designer/store/editor";
import type { DesignSpec, StudioChoices } from "@/features/designer/types";
import { formatDimensions } from "@/i18n/format";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DimensionInput, type LengthUnit } from "@/ui/components/DimensionInput";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";

import { recipeOfVariant } from "./library";

const AdvisorPanel = dynamic(
  () => import("@/features/customer/configurator/AdvisorPanel").then((module) => module.AdvisorPanel),
  { ssr: false },
);

type Basis = NonNullable<StudioChoices["basis"]>;
type Method = NonNullable<StudioChoices["printMethod"]> | "auto";
type Sides = NonNullable<StudioChoices["printSides"]>;
const BASES: Basis[] = ["internal", "external", "over_crease"];
const METHODS: Method[] = ["auto", "digital", "offset", "flexo", "none"];
const SIDES: Sides[] = ["outside", "inside", "both"];

export interface BoxStepProps {
  catalog: DesignerCatalog | null;
  configurator: Configurator | null;
  /** The flexo spot-colour limit Prepress set, or `null` while unset (D-278). */
  maxSpot: number | null;
  openSetup: () => void;
  onDone: () => void;
}

/**
 * ② Box (studio-spec §2, U4.2): the published variant of the style, the size on the basis the
 * customer measures with (and the API's three derived sizes), the material, the print method —
 * which configures the editor (flexo: spot colours up to Prepress's limit; digital / offset: full
 * CMYK; no print: structure only) — the print sides and the finishes. Every choice is saved with
 * the design and priced by the dock; nothing here computes a price. A size the engine or the
 * product cannot make says why, with the solver's reason.
 */
export function BoxStep({ catalog, configurator, maxSpot, openSetup, onDone }: BoxStepProps) {
  const t = useTranslations("studio.box");
  const spec = useEditor((s) => s.spec);
  if (!spec) return null;
  const studio = spec.studio ?? {};
  const update = (patch: Partial<StudioChoices>, rest: Partial<DesignSpec> = {}) =>
    useEditor.getState().setSpec({ ...spec, ...rest, studio: { ...studio, ...patch } });

  return (
    <div className="space-y-6">
      <h2 className="font-semibold">{t("title")}</h2>
      <StyleSection spec={spec} openSetup={openSetup} />
      <SizeSection spec={spec} catalog={catalog} configurator={configurator} />
      <MaterialSection spec={spec} catalog={catalog} />
      <PrintSection
        method={studio.printMethod ?? "auto"}
        sides={studio.printSides ?? "outside"}
        maxSpot={maxSpot}
        onMethod={(method) =>
          update({
            printMethod: method === "auto" ? null : method,
            ...(method === "none" ? { printSides: "none" as const } : studio.printSides === "none" ? { printSides: "outside" as const } : {}),
          })
        }
        onSides={(printSides) => update({ printSides })}
      />
      {configurator ? <FinishSection configurator={configurator} studio={studio} onChange={update} /> : null}
      {configurator && catalog ? <AdvisorSection configurator={configurator} catalog={catalog} spec={spec} /> : null}
      <Button className="w-full" onClick={onDone}>
        {t("confirm")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------------------ style + variant */

function StyleSection({ spec, openSetup }: { spec: DesignSpec; openSetup: () => void }) {
  const t = useTranslations("studio.box");
  const tStyles = useTranslations("styles") as unknown as StylesT & ReturnType<typeof useTranslations>;
  const locale = useLocale() as "th" | "en";
  // A core style names its base in the main entry; a library style keeps the one it was picked under.
  const base = RECIPES.find((r) => r.id === spec.styleId)?.base ?? spec.studio?.baseCode ?? null;
  const style = useQuery({
    queryKey: [...queryKeys.zone("customer"), "style", base, locale],
    queryFn: async () => {
      try {
        return (await browserApi().GET("/v1/store/styles/{code}", { params: { path: { code: base! } } })).data!;
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
    enabled: !!base,
    staleTime: 10 * 60_000,
  });
  const detail = style.data ?? null;
  const current = detail?.variants.find((v) => v.code === spec.studio?.styleVariantCode) ?? null;
  const [selection, setSelection] = useState<Selection | null>(null);
  const picked = selection ?? (current && detail ? selectionOf(current, detail.axes) : {});
  const choose = useMutation({
    mutationFn: async (next: Selection) => {
      const variant = detail ? variantOf(detail.variants, next) : undefined;
      if (!variant || !detail) return;
      const found = await recipeOfVariant(detail.code, variant.options);
      const editor = useEditor.getState();
      const now = editor.spec!;
      if (!found) {
        editor.setSpec({ ...now, studio: { ...now.studio, styleVariantCode: variant.code, baseCode: detail.code } });
        return;
      }
      const sizeKeys = new Set(["length", "width", "height"]);
      const keep = Object.fromEntries(Object.entries(now.values).filter(([k]) => sizeKeys.has(k)));
      editor.setSpec({
        ...now,
        styleId: found.recipe.id,
        values: { ...found.values, ...keep } as ParamValues,
        studio: { ...now.studio, styleVariantCode: variant.code, baseCode: detail.code },
      });
    },
  });

  return (
    <section className="space-y-3" aria-labelledby="studio-box-style">
      <h3 id="studio-box-style" className="text-sm font-semibold">
        {t("style")}
      </h3>
      <p className="text-sm">
        {getStyle(spec.styleId).name[locale]}
        {base ? <span className="text-muted font-mono"> · {base}</span> : null}
      </p>
      {detail && detail.variants.length > 0 ? (
        <div className="space-y-3">
          {detail.axes.map((axis) => (
            <Field key={axis.axis} label={axisLabel(tStyles, axis.axis)}>
              <Select
                value={typeof picked[axis.axis] === "string" ? (picked[axis.axis] as string) : ""}
                placeholder={t("chooseVariant")}
                onValueChange={(value) => {
                  const next = change(picked, axis, value);
                  setSelection(next);
                  if (variantOf(detail.variants, next)) choose.mutate(next);
                }}
                options={optionsOf(axis, picked, detail.variants).map((option) => ({
                  value: option.value,
                  label: valueLabel(tStyles, axis.axis, option.value),
                  disabled: !option.available,
                }))}
              />
            </Field>
          ))}
          {spec.studio?.styleVariantCode ? (
            <p className="text-muted font-mono text-xs">{t("variantCode", { code: spec.studio.styleVariantCode })}</p>
          ) : null}
        </div>
      ) : null}
      <Button size="sm" variant="secondary" iconStart="box" onClick={openSetup}>
        {t("changeStyle")}
      </Button>
    </section>
  );
}

/* ------------------------------------------------------------------------------ size */

function SizeSection({
  spec,
  catalog,
  configurator,
}: {
  spec: DesignSpec;
  catalog: DesignerCatalog | null;
  configurator: Configurator | null;
}) {
  const t = useTranslations("studio.box");
  const tSetup = useTranslations("designer.setup");
  const locale = useLocale() as "th" | "en";
  const style = getStyle(spec.styleId);
  const box = ["length", "width", "height"].every((k) => style.params.some((p) => p.key === k && p.group === "size"));
  const inside = insideSize(spec);
  const [basis, setBasis] = useState<Basis>(spec.studio?.basis ?? "internal");
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [draft, setDraft] = useState<Record<"l" | "w" | "d", number | null>>({
    l: inside.length,
    w: inside.width,
    d: inside.height,
  });
  const [confirm, setConfirm] = useState(false);
  const hasContent = useEditor((s) => s.content.elements.length > 0);
  const convertible = !!configurator && sizeKindOf(configurator) === "box";

  const body =
    convertible && draft.l && draft.w && draft.d
      ? {
          productTypeCode: configurator!.productTypeCode,
          basis,
          l: draft.l,
          w: draft.w,
          d: draft.d,
          ...(spec.patternId ? { patternId: spec.patternId } : {}),
          ...(spec.materialId ? { materialId: spec.materialId } : {}),
        }
      : null;
  const conversion = useQuery({
    queryKey: [...queryKeys.zone("customer"), "convert-dimensions", body],
    queryFn: async ({ signal }) =>
      (
        await browserApi().POST("/v1/store/specs/actions/convert-dimensions", {
          body: body as Schemas["ConvertDimensionsDto"],
          signal,
        })
      ).data!,
    enabled: body !== null,
    retry: false,
    staleTime: Infinity,
  });
  const converted = conversion.data ?? null;
  // The engine draws the inside: entered on another basis, the API's conversion gives it.
  const target =
    basis === "internal" ? draft : converted?.sizes.internal ? converted.sizes.internal : null;
  const values: ParamValues | null =
    target?.l && target.w && target.d ? { ...spec.values, length: target.l, width: target.w, height: target.d } : null;
  const pattern = spec.patternId ? catalog?.patterns.find((p) => p.id === spec.patternId) : undefined;
  const issues = values
    ? [
        ...style.validate(values, spec.material),
        ...patternIssues(pattern, values, style, locale, (key, v) => tSetup(key, v)),
      ].filter((issue) => issue.severity === "error")
    : [];
  const same =
    values && values.length === spec.values.length && values.width === spec.values.width && values.height === spec.values.height;
  const caliperUnknown = basis !== "internal" && converted && converted.caliperMm === null;

  const apply = () => {
    if (!values) return;
    const editor = useEditor.getState();
    editor.setSpec({ ...editor.spec!, values, studio: { ...editor.spec!.studio, basis } });
    setConfirm(false);
  };

  if (!box)
    return (
      <section className="space-y-2" aria-labelledby="studio-box-size">
        <h3 id="studio-box-size" className="text-sm font-semibold">
          {t("size")}
        </h3>
        <p className="text-muted text-sm">{t("sizeInSetup")}</p>
      </section>
    );

  return (
    <section className="space-y-3" aria-labelledby="studio-box-size">
      <h3 id="studio-box-size" className="text-sm font-semibold">
        {t("size")}
      </h3>
      {convertible ? (
        <SegmentedControl
          label={t("basis")}
          size="sm"
          value={basis}
          onValueChange={(next) => setBasis(next)}
          options={BASES.map((value) => ({ value, label: t(`bases.${value}`) }))}
        />
      ) : null}
      <DimensionInput
        legend={t(`legend.${basis}`)}
        unit={unit}
        onUnitChange={setUnit}
        unitLabels={{ mm: t("units.mm"), cm: t("units.cm"), in: t("units.in") }}
        unitToggleLabel={t("unit")}
        onChange={(key, valueMm) => setDraft((d) => ({ ...d, [key]: valueMm }))}
        axes={[
          { key: "l", label: t("axes.l"), valueMm: draft.l },
          { key: "w", label: t("axes.w"), valueMm: draft.w },
          { key: "d", label: t("axes.d"), valueMm: draft.d },
        ]}
      />
      {converted ? (
        <dl className="text-xs" aria-label={t("derived")}>
          {(
            [
              ["internal", "internal"],
              ["external", "external"],
              ["over_crease", "overCrease"],
            ] as const
          ).map(([label, key]) => {
            const size = converted.sizes[key];
            return size ? (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-muted">{t(`bases.${label}`)}</dt>
                <dd className="tabular-nums">
                  {formatDimensions({ length: size.l, width: size.w, height: size.d }, locale)}
                </dd>
              </div>
            ) : null;
          }          )}
        </dl>
      ) : null}
      {caliperUnknown ? <Callout tone="info" title={t("caliperUnknown")} /> : null}
      {issues.length > 0 ? (
        <Callout tone="danger" title={t("cannotMake")}>
          <ul className="mt-1 list-disc ps-4 text-sm">
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.param ?? ""}`}>
                {issue.message[locale]}{" "}
                <span className="text-muted font-mono text-xs">{t("reasonCode", { code: issue.code })}</span>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={!values || same || issues.length > 0 || conversion.isFetching}
        onClick={() => (hasContent ? setConfirm(true) : apply())}
      >
        {t("applySize")}
      </Button>
      <AlertDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("resizeTitle")}
        description={t("resizeBody")}
        confirmLabel={t("applySize")}
        cancelLabel={t("cancel")}
        onConfirm={apply}
      />
    </section>
  );
}

/* ------------------------------------------------------------------------------ material */

function MaterialSection({ spec, catalog }: { spec: DesignSpec; catalog: DesignerCatalog | null }) {
  const t = useTranslations("studio.box");
  const locale = useLocale() as "th" | "en";
  const materials = materialsFor(catalog, spec.styleId, spec.patternId);
  if (materials.length === 0) return null;
  return (
    <section className="space-y-2" aria-labelledby="studio-box-material">
      <h3 id="studio-box-material" className="text-sm font-semibold">
        {t("material")}
      </h3>
      <RadioCards
        aria-label={t("material")}
        columns={1}
        value={spec.materialId ?? undefined}
        onValueChange={(id) => {
          const material = materials.find((m) => m.id === id);
          if (!material) return;
          const editor = useEditor.getState();
          editor.setSpec({ ...editor.spec!, ...withMaterial(material, locale) });
        }}
        options={materials.map((m) => ({
          value: m.id,
          label: (locale === "en" ? m.nameEn : null) ?? m.nameTh,
          description: t("caliper", { mm: m.caliperMm }),
          visual: (
            <span
              aria-hidden="true"
              className="border-border block size-8 shrink-0 rounded-md border"
              style={{ background: boardColour({ material: materialSpecOf(m), boardColour: m.swatchHex ?? undefined }) }}
            />
          ),
        }))}
      />
    </section>
  );
}

/* ------------------------------------------------------------------------------ print */

function PrintSection({
  method,
  sides,
  maxSpot,
  onMethod,
  onSides,
}: {
  method: Method;
  sides: Sides | "none";
  maxSpot: number | null;
  onMethod: (method: Method) => void;
  onSides: (sides: Sides) => void;
}) {
  const t = useTranslations("studio.box");
  return (
    <section className="space-y-3" aria-labelledby="studio-box-print">
      <h3 id="studio-box-print" className="text-sm font-semibold">
        {t("printMethod")}
      </h3>
      <RadioCards
        aria-label={t("printMethod")}
        columns={1}
        value={method}
        onValueChange={onMethod}
        options={METHODS.map((value) => ({
          value,
          label: t(`methods.${value}.label`),
          description:
            value === "flexo" && maxSpot !== null
              ? t("methods.flexo.limited", { count: maxSpot })
              : t(`methods.${value}.description`),
        }))}
      />
      {method !== "none" ? (
        <SegmentedControl
          label={t("printSides")}
          size="sm"
          value={sides === "none" ? "outside" : sides}
          onValueChange={onSides}
          options={SIDES.map((value) => ({ value, label: t(`sides.${value}`) }))}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------------------ finishes */

function FinishSection({
  configurator,
  studio,
  onChange,
}: {
  configurator: Configurator;
  studio: StudioChoices;
  onChange: (patch: Partial<StudioChoices>) => void;
}) {
  const t = useTranslations("studio.box");
  const locale = useLocale();
  const groups = groupsOf(configurator);
  const coatings = groups.find((g) => g.kind === "coating_front")?.options ?? [];
  // Finishes the calculator places by size wait for finish layers (U4.4); the rest are chosen here.
  const finishGroup = groups.find((g) => g.kind === "finish");
  const finishes = finishGroup && !finishGroup.placed ? finishGroup.options : [];
  if (coatings.length === 0 && finishes.length === 0) return null;
  const name = (o: { nameTh: string; nameEn?: string | null }) => (locale === "en" ? (o.nameEn ?? o.nameTh) : o.nameTh);
  const chosen = studio.finishIds ?? [];
  return (
    <section className="space-y-3" aria-labelledby="studio-box-finish">
      <h3 id="studio-box-finish" className="text-sm font-semibold">
        {t("finishes")}
      </h3>
      {coatings.length > 0 ? (
        <Field label={t("coating")}>
          <Select
            value={studio.coatingId ?? "none"}
            onValueChange={(value) => onChange({ coatingId: value === "none" ? null : value })}
            options={[
              { value: "none", label: t("noCoating") },
              ...coatings.map((o) => ({ value: o.id, label: name(o) })),
            ]}
          />
        </Field>
      ) : null}
      {finishes.map((o) => (
        <Checkbox
          key={o.id}
          label={name(o)}
          checked={chosen.includes(o.id)}
          onCheckedChange={(checked) =>
            onChange({ finishIds: checked ? [...chosen, o.id] : chosen.filter((id) => id !== o.id) })
          }
        />
      ))}
      <p className="text-muted text-xs">{t("finishPrice")}</p>
    </section>
  );
}

/* ------------------------------------------------------------------------------ advisor */

/**
 * The Structure Advisor card (U2.F1 §3) for a corrugated box: the goods and their journey, then the
 * API's recommended board with its reasons; taking one changes the design's material (and the price).
 */
function AdvisorSection({
  configurator,
  catalog,
  spec,
}: {
  configurator: Configurator;
  catalog: DesignerCatalog;
  spec: DesignSpec;
}) {
  const t = useTranslations("studio.box");
  const locale = useLocale() as "th" | "en";
  const method = useAdvisorMethod(configurator);
  const advisor = useAdvisor(configurator);
  const [load, setLoad] = useState<LoadInput>(DEFAULT_LOAD);
  const [open, setOpen] = useState(false);
  if (!method.data?.available) return null;
  const answers = loadOf(load);
  const recommend = () => {
    if (!answers) return;
    // The advisor sizes the same configuration the studio prices.
    void import("./state").then(({ stateForDesign }) =>
      advisor.recommend.mutate({
        load: answers,
        state: stateForDesign(configurator, spec, useEditor.getState().content, configurator.quantity.default ?? 1),
      }),
    );
  };
  const choose = async (option: AdvisorOption) => {
    const recommendation = advisor.recommend.data;
    if (!recommendation) return;
    await advisor.choose.mutateAsync({ recommendationId: recommendation.id, option });
    const material = catalog.materials.find((m) => m.id === option.board.id);
    const editor = useEditor.getState();
    if (material) editor.setSpec({ ...editor.spec!, ...withMaterial(material, locale) });
  };
  return (
    <section className="space-y-3" aria-labelledby="studio-box-advisor">
      <h3 id="studio-box-advisor" className="text-sm font-semibold">
        {t("advisor")}
      </h3>
      {!open ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {t("advisorOpen")}
        </Button>
      ) : (
        <>
          <LogisticsStep load={load} onChange={(patch) => patch.load && setLoad(patch.load)} />
          <AdvisorPanel
            method={method.data}
            ready={!!answers}
            recommendation={advisor.recommend.data ?? null}
            recommending={advisor.recommend.isPending}
            recommendError={advisor.recommend.error}
            onRecommend={recommend}
            onEditLoad={() => undefined}
            chosenBoardId={spec.materialId ?? null}
            onChoose={choose}
            choosing={advisor.choose.isPending}
            rfqHref="/rfq"
          />
        </>
      )}
    </section>
  );
}
