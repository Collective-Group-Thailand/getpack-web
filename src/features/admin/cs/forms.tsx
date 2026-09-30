"use client";

import { useLocale, useTranslations } from "next-intl";

import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";

import type {
  CorrugateInputData,
  CorrugateSelection,
  FoldingInputData,
  FoldingSelection,
  Selection,
} from "./configuration";

type Named = { id: string; nameTh: string; nameEn: string };

function useNameOf() {
  const locale = useLocale();
  return (row: Named) => (locale === "en" ? row.nameEn : row.nameTh);
}

function Choice({
  label,
  options,
  value,
  onChange,
  required,
  allowNone,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  /** The option is optional: offer "none" to clear it. */
  allowNone?: boolean;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("cs.form");
  const NONE = "__none__";
  return (
    <Field label={label} required={required} requiredLabel={tCommon("state.required")}>
      <Select
        value={value ?? (allowNone ? NONE : undefined)}
        onValueChange={(next) => onChange(next === NONE ? undefined : next)}
        placeholder={t("choose")}
        options={[...(allowNone ? [{ value: NONE, label: t("none") }] : []), ...options]}
      />
    </Field>
  );
}

function Millimetres({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const tCommon = useTranslations("common");
  return (
    <Field label={label} required requiredLabel={tCommon("state.required")}>
      <NumberInput
        unit={tCommon("units.mm")}
        min={1}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    </Field>
  );
}

function Colours({
  label,
  colours,
  value,
  onChange,
}: {
  label: string;
  colours: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {colours.map((colour) => (
          <Checkbox
            key={colour.id}
            label={colour.name}
            checked={value.includes(colour.id)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, colour.id] : value.filter((id) => id !== colour.id))
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Pattern, sub-pattern, size, material and difficulty — what both calculators ask first. */
function Shape<S extends Selection>({
  patterns,
  materials,
  difficulties,
  materialLabel,
  value,
  onChange,
}: {
  patterns: { id: string; name: string; subPatterns: { id: string; name: string }[] }[];
  materials: { value: string; label: string }[];
  difficulties: Named[];
  materialLabel: string;
  value: S;
  onChange: (value: S) => void;
}) {
  const t = useTranslations("cs.form");
  const nameOf = useNameOf();
  const pattern = patterns.find((candidate) => candidate.id === value.patternId);
  return (
    <div className="space-y-4">
      <Choice
        label={t("pattern")}
        required
        options={patterns.map((row) => ({ value: row.id, label: row.name }))}
        value={value.patternId}
        onChange={(patternId) => onChange({ ...value, patternId, subPatternId: undefined })}
      />
      {pattern && pattern.subPatterns.length > 0 ? (
        <Choice
          label={t("subPattern")}
          allowNone
          options={pattern.subPatterns.map((row) => ({ value: row.id, label: row.name }))}
          value={value.subPatternId}
          onChange={(subPatternId) => onChange({ ...value, subPatternId })}
        />
      ) : null}
      {/* Pattern size limits and standard sizes are not in the input data (CONTRACT-GAP admin.cs-calculators). */}
      <div className="grid grid-cols-3 gap-2">
        <Millimetres label={t("length")} value={value.l} onChange={(l) => onChange({ ...value, l })} />
        <Millimetres label={t("width")} value={value.w} onChange={(w) => onChange({ ...value, w })} />
        <Millimetres label={t("height")} value={value.d} onChange={(d) => onChange({ ...value, d })} />
      </div>
      <Choice
        label={materialLabel}
        required
        options={materials}
        value={value.materialId}
        onChange={(materialId) => onChange({ ...value, materialId })}
      />
      <Choice
        label={t("difficulty")}
        required
        options={difficulties.map((row) => ({ value: row.id, label: nameOf(row) }))}
        value={value.difficultyLevelId}
        onChange={(difficultyLevelId) => onChange({ ...value, difficultyLevelId })}
      />
    </div>
  );
}

function Design<S extends Selection>({ value, onChange }: { value: S; onChange: (value: S) => void }) {
  const t = useTranslations("cs.form");
  return (
    <div className="space-y-2">
      <Switch
        label={t("designGraphic")}
        checked={value.graphic}
        onCheckedChange={(graphic) => onChange({ ...value, graphic })}
      />
      <Switch
        label={t("designStructure")}
        checked={value.structure}
        onCheckedChange={(structure) => onChange({ ...value, structure })}
      />
    </div>
  );
}

function FoldingForm({
  data,
  value,
  onChange,
}: {
  data: FoldingInputData;
  value: FoldingSelection;
  onChange: (value: FoldingSelection) => void;
}) {
  const t = useTranslations("cs.form");
  const nameOf = useNameOf();
  const finishes = data.finishes
    .filter((row) => row.slot === "finish1")
    .map((row) => ({ value: row.id, label: nameOf(row) }));
  return (
    <div className="space-y-4">
      <Shape
        patterns={data.patterns}
        materials={data.materials.map((row) => ({
          value: row.id,
          label: row.gsm ? `${nameOf(row)} · ${row.gsm} gsm` : nameOf(row),
        }))}
        difficulties={data.difficultyLevels}
        materialLabel={t("material")}
        value={value}
        onChange={onChange}
      />
      <Colours
        label={t("frontColours")}
        colours={data.inkColours}
        value={value.printFront}
        onChange={(printFront) => onChange({ ...value, printFront })}
      />
      <Colours
        label={t("backColours")}
        colours={data.inkColours}
        value={value.printBack}
        onChange={(printBack) => onChange({ ...value, printBack })}
      />
      <Choice
        label={t("finishFront")}
        allowNone
        options={finishes}
        value={value.finish1FrontId}
        onChange={(finish1FrontId) => onChange({ ...value, finish1FrontId })}
      />
      <Choice
        label={t("finishBack")}
        allowNone
        options={finishes}
        value={value.finish1BackId}
        onChange={(finish1BackId) => onChange({ ...value, finish1BackId })}
      />
      <Choice
        label={t("diecut")}
        allowNone
        options={data.diecutTypes.map((row) => ({ value: row.id, label: nameOf(row) }))}
        value={value.diecutTypeId}
        onChange={(diecutTypeId) => onChange({ ...value, diecutTypeId })}
      />
      <Design value={value} onChange={onChange} />
    </div>
  );
}

function CorrugateForm({
  data,
  value,
  onChange,
}: {
  data: CorrugateInputData;
  value: CorrugateSelection;
  onChange: (value: CorrugateSelection) => void;
}) {
  const t = useTranslations("cs.form");
  const nameOf = useNameOf();
  const pattern = data.patterns.find((candidate) => candidate.id === value.patternId);
  // A board is offered only in a flute the pattern can be made in.
  const boards = data.boards.filter((board) => !pattern || pattern.fluteTypeIds.includes(board.flute.id));
  const board = data.boards.find((candidate) => candidate.id === value.materialId);
  const coatings = data.coatings.map((row) => ({ value: row.id, label: nameOf(row) }));
  return (
    <div className="space-y-4">
      <Shape
        patterns={data.patterns}
        materials={boards.map((row) => ({ value: row.id, label: `${nameOf(row)} · ${row.flute.name}` }))}
        difficulties={data.difficultyLevels}
        materialLabel={t("board")}
        value={value}
        onChange={onChange}
      />
      <Colours
        label={t("frontColours")}
        colours={data.inkColours}
        value={value.printFront}
        onChange={(printFront) => onChange({ ...value, printFront })}
      />
      <Colours
        label={t("backColours")}
        colours={data.inkColours}
        value={value.printBack}
        onChange={(printBack) => onChange({ ...value, printBack })}
      />
      <Choice
        label={t("printArea")}
        options={data.printAreas.map((area) => ({ value: area, label: t(`printAreas.${area}`) }))}
        value={value.printArea}
        onChange={(printArea) => onChange({ ...value, printArea: printArea as CorrugateSelection["printArea"] })}
      />
      {board?.coatable ? (
        <>
          <Choice
            label={t("coatingFront")}
            allowNone
            options={coatings}
            value={value.coatingFrontId}
            onChange={(coatingFrontId) => onChange({ ...value, coatingFrontId })}
          />
          <Choice
            label={t("coatingBack")}
            allowNone
            options={coatings}
            value={value.coatingBackId}
            onChange={(coatingBackId) => onChange({ ...value, coatingBackId })}
          />
        </>
      ) : null}
      <Design value={value} onChange={onChange} />
    </div>
  );
}

/** The chosen calculator's form over its published input data. */
export function CalculatorForm({
  data,
  value,
  onChange,
}: {
  data: FoldingInputData | CorrugateInputData;
  value: Selection;
  onChange: (value: Selection) => void;
}) {
  return value.calculator === "folding" ? (
    <FoldingForm data={data as FoldingInputData} value={value} onChange={onChange} />
  ) : (
    <CorrugateForm data={data as CorrugateInputData} value={value} onChange={onChange} />
  );
}
