"use client";

import { useTranslations } from "next-intl";
import type { z } from "zod";

import type { csInput, csInputData } from "@/lib/api/requests/admin-sales";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";

export type InputData = z.output<typeof csInputData>;
export type CalculatorInput = z.input<typeof csInput>;
export type CalculatorKey = CalculatorInput["calculator"];

type Of<K extends CalculatorKey> = Extract<CalculatorInput, { calculator: K }>;

/* --------------------------------------------------------------------------------- blocks */

function OptionSelect({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: InputData["options"][string] | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("cs.form");
  return (
    <Field label={label} required={required} requiredLabel={tCommon("state.required")}>
      <Select
        value={value || undefined}
        onValueChange={onChange}
        placeholder={t("choose")}
        options={(options ?? []).map((option) => ({
          value: option.code,
          label: option.group ? `${option.group} · ${option.name}` : option.name,
        }))}
      />
    </Field>
  );
}

function Millimetres({
  label,
  value,
  onChange,
  min,
  max,
  error,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number | null;
  max?: number | null;
  error?: string;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("cs.form");
  return (
    <Field
      label={label}
      hint={min != null && max != null ? t("range", { min, max }) : undefined}
      error={error}
      required
      requiredLabel={tCommon("state.required")}
    >
      <NumberInput
        unit={tCommon("units.mm")}
        min={min ?? undefined}
        max={max ?? undefined}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      />
    </Field>
  );
}

function Count({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
}) {
  return (
    <Field label={label}>
      <NumberInput
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))}
      />
    </Field>
  );
}

/** The size inputs, checked against the chosen pattern's rules (legacy `l_must_more_than_w` …). */
function Size({
  data,
  pattern,
  value,
  onChange,
  withHeight = true,
}: {
  data: InputData;
  pattern?: string;
  value: { lengthMm?: number; widthMm?: number; heightMm?: number };
  onChange: (value: { lengthMm?: number; widthMm?: number; heightMm?: number }) => void;
  withHeight?: boolean;
}) {
  const t = useTranslations("cs.form");
  const rules = data.patterns.find((candidate) => candidate.code === pattern)?.constraints;
  const lengthError =
    rules?.lengthMustExceedWidth &&
    value.lengthMm !== undefined &&
    value.widthMm !== undefined &&
    value.lengthMm < value.widthMm
      ? t("lengthMustExceedWidth")
      : undefined;
  const sizes = data.patterns.find((candidate) => candidate.code === pattern)?.standardSizes ?? [];
  return (
    <div className="space-y-3">
      {sizes.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("standardSizes")}>
          {sizes.map((size) => (
            <Button
              key={size.code}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                onChange({ lengthMm: size.lengthMm, widthMm: size.widthMm, heightMm: size.heightMm ?? undefined })
              }
            >
              {size.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        <Millimetres
          label={t("length")}
          value={value.lengthMm}
          onChange={(lengthMm) => onChange({ ...value, lengthMm })}
          min={rules?.minLengthMm}
          max={rules?.maxLengthMm}
          error={lengthError}
        />
        <Millimetres
          label={t("width")}
          value={value.widthMm}
          onChange={(widthMm) => onChange({ ...value, widthMm })}
          min={rules?.minWidthMm}
          max={rules?.maxWidthMm}
        />
        {withHeight ? (
          <Millimetres
            label={t("height")}
            value={value.heightMm}
            onChange={(heightMm) => onChange({ ...value, heightMm })}
            min={rules?.minHeightMm}
            max={rules?.maxHeightMm}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Finishes, several at once; the ones priced by area ask for it (legacy type 2 foil / emboss). */
function Finishes({
  options,
  value,
  onChange,
}: {
  options: InputData["options"][string] | undefined;
  value: { code: string; widthMm?: number; lengthMm?: number }[];
  onChange: (value: { code: string; widthMm?: number; lengthMm?: number }[]) => void;
}) {
  const t = useTranslations("cs.form");
  const tCommon = useTranslations("common");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("finishes")}</legend>
      {(options ?? []).map((option) => {
        const chosen = value.find((item) => item.code === option.code);
        return (
          <div key={option.code} className="space-y-2">
            <Checkbox
              label={option.name}
              checked={Boolean(chosen)}
              onCheckedChange={(checked) =>
                onChange(
                  checked ? [...value, { code: option.code }] : value.filter((item) => item.code !== option.code),
                )
              }
            />
            {chosen && option.meta.needsArea ? (
              <div className="ms-7 grid grid-cols-2 gap-2">
                <Field label={t("areaWidth", { finish: option.name })}>
                  <NumberInput
                    unit={tCommon("units.mm")}
                    value={chosen.widthMm ?? ""}
                    onChange={(event) =>
                      onChange(
                        value.map((item) =>
                          item.code === option.code
                            ? { ...item, widthMm: Number(event.target.value) || undefined }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={t("areaLength", { finish: option.name })}>
                  <NumberInput
                    unit={tCommon("units.mm")}
                    value={chosen.lengthMm ?? ""}
                    onChange={(event) =>
                      onChange(
                        value.map((item) =>
                          item.code === option.code
                            ? { ...item, lengthMm: Number(event.target.value) || undefined }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function gsmOptions(data: InputData, material: string | undefined) {
  const gsm = data.options.materials?.find((option) => option.code === material)?.meta.gsm;
  return Array.isArray(gsm)
    ? gsm.map((value) => ({ code: String(value), name: `${value} gsm`, group: null, meta: {} }))
    : [];
}

/* ------------------------------------------------------------------------------- per type */

export function emptyInput(type: CalculatorKey): CalculatorInput {
  const side = { colours: 4 };
  switch (type) {
    case "folding":
      return {
        calculator: "folding",
        pattern: "",
        lengthMm: 0,
        widthMm: 0,
        heightMm: 0,
        material: "",
        gsm: 0,
        printType: "offset",
        front: side,
        back: { colours: 0 },
        finishes: [],
      };
    case "corrugate":
      return {
        calculator: "corrugate",
        pattern: "",
        lengthMm: 0,
        widthMm: 0,
        heightMm: 0,
        flute: "",
        paperGrade: "",
        printType: "offset",
        colours: 1,
      };
    case "label":
      return {
        calculator: "label",
        shape: "",
        lengthMm: 0,
        widthMm: 0,
        material: "",
        printType: "digital",
        colours: 4,
        finishes: [],
      };
    case "tag_sleeve":
      return {
        calculator: "tag_sleeve",
        kind: "tag",
        lengthMm: 0,
        widthMm: 0,
        material: "",
        gsm: 0,
        printType: "offset",
        front: side,
        back: { colours: 0 },
        finishes: [],
      };
    case "pouch":
      return {
        calculator: "pouch",
        pouchType: "",
        lengthMm: 0,
        widthMm: 0,
        material: "",
        micron: 0,
        printType: "digital",
        colours: 4,
        zipper: true,
        window: false,
      };
    case "standard_product":
      return { calculator: "standard_product", productCode: "" };
    case "service":
      return { calculator: "service", services: [] };
  }
}

/** What stops "calculate": the fields the backend would refuse, found before asking it. */
export function missingFields(input: CalculatorInput): string[] {
  const missing: string[] = [];
  const need = (ok: unknown, name: string) => (ok ? undefined : missing.push(name));
  switch (input.calculator) {
    case "folding":
    case "corrugate":
      need(input.pattern, "pattern");
      need(input.lengthMm > 0 && input.widthMm > 0 && input.heightMm > 0, "size");
      if (input.calculator === "folding") {
        need(input.material, "material");
        need(input.gsm, "gsm");
      } else {
        need(input.flute, "flute");
        need(input.paperGrade, "paperGrade");
      }
      break;
    case "label":
      need(input.shape, "shape");
      need(input.material, "material");
      need(input.lengthMm > 0 && input.widthMm > 0, "size");
      break;
    case "tag_sleeve":
      need(input.material, "material");
      need(input.gsm, "gsm");
      need(input.lengthMm > 0 && input.widthMm > 0, "size");
      break;
    case "pouch":
      need(input.pouchType, "pouchType");
      need(input.material, "material");
      need(input.micron, "micron");
      need(input.lengthMm > 0 && input.widthMm > 0, "size");
      break;
    case "standard_product":
      need(input.productCode, "product");
      break;
    case "service":
      need(input.services.length > 0, "services");
      break;
  }
  return missing;
}

export function CalculatorForm({
  data,
  value,
  onChange,
}: {
  data: InputData;
  value: CalculatorInput;
  onChange: (value: CalculatorInput) => void;
}) {
  const t = useTranslations("cs.form");
  const printTypes = data.printTypes.map((option) => ({ code: option.code, name: option.name, group: null, meta: {} }));
  const size = (input: { lengthMm: number; widthMm: number; heightMm?: number }) => ({
    lengthMm: input.lengthMm || undefined,
    widthMm: input.widthMm || undefined,
    heightMm: input.heightMm || undefined,
  });
  const setSize = <T extends CalculatorInput>(
    input: T,
    next: { lengthMm?: number; widthMm?: number; heightMm?: number },
  ) =>
    onChange({
      ...input,
      lengthMm: next.lengthMm ?? 0,
      widthMm: next.widthMm ?? 0,
      ...("heightMm" in input ? { heightMm: next.heightMm ?? 0 } : {}),
    } as T);

  switch (value.calculator) {
    case "folding": {
      const input = value as Of<"folding">;
      const pattern = data.patterns.find((candidate) => candidate.code === input.pattern);
      return (
        <div className="space-y-4">
          <OptionSelect
            label={t("pattern")}
            required
            options={data.patterns.map((p) => ({ code: p.code, name: p.name, group: null, meta: {} }))}
            value={input.pattern}
            onChange={(pattern) => onChange({ ...input, pattern, subPattern: undefined })}
          />
          {pattern && pattern.subPatterns.length > 0 ? (
            <OptionSelect
              label={t("subPattern")}
              options={pattern.subPatterns.map((p) => ({ ...p, group: null, meta: {} }))}
              value={input.subPattern}
              onChange={(subPattern) => onChange({ ...input, subPattern })}
            />
          ) : null}
          <Size data={data} pattern={input.pattern} value={size(input)} onChange={(next) => setSize(input, next)} />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("material")}
              required
              options={data.options.materials}
              value={input.material}
              onChange={(material) => onChange({ ...input, material, gsm: 0 })}
            />
            <OptionSelect
              label={t("gsm")}
              required
              options={gsmOptions(data, input.material)}
              value={input.gsm ? String(input.gsm) : undefined}
              onChange={(gsm) => onChange({ ...input, gsm: Number(gsm) })}
            />
          </div>
          <OptionSelect
            label={t("printType")}
            options={printTypes}
            value={input.printType}
            onChange={(printType) => onChange({ ...input, printType })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Count
              label={t("frontColours")}
              max={8}
              value={input.front.colours}
              onChange={(colours) => onChange({ ...input, front: { ...input.front, colours } })}
            />
            <Count
              label={t("backColours")}
              max={8}
              value={input.back.colours}
              onChange={(colours) => onChange({ ...input, back: { ...input.back, colours } })}
            />
          </div>
          <Finishes
            options={data.options.finishes}
            value={input.finishes}
            onChange={(finishes) => onChange({ ...input, finishes })}
          />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("diecut")}
              options={data.options.diecutGroups}
              value={input.diecutGroup}
              onChange={(diecutGroup) => onChange({ ...input, diecutGroup })}
            />
            <OptionSelect
              label={t("assembly")}
              options={data.options.assemblies}
              value={input.assembly}
              onChange={(assembly) => onChange({ ...input, assembly })}
            />
          </div>
          <OptionSelect
            label={t("difficulty")}
            options={data.options.difficultyLevels}
            value={input.difficulty}
            onChange={(difficulty) => onChange({ ...input, difficulty })}
          />
        </div>
      );
    }
    case "corrugate": {
      const input = value as Of<"corrugate">;
      const parts = input.parts ?? [];
      return (
        <div className="space-y-4">
          <OptionSelect
            label={t("pattern")}
            required
            options={data.patterns.map((p) => ({ code: p.code, name: p.name, group: null, meta: {} }))}
            value={input.pattern}
            onChange={(pattern) => onChange({ ...input, pattern })}
          />
          <Size data={data} pattern={input.pattern} value={size(input)} onChange={(next) => setSize(input, next)} />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("flute")}
              required
              options={data.options.flutes}
              value={input.flute}
              onChange={(flute) => onChange({ ...input, flute })}
            />
            <OptionSelect
              label={t("paperGrade")}
              required
              options={data.options.paperGrades}
              value={input.paperGrade}
              onChange={(paperGrade) => onChange({ ...input, paperGrade })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("printType")}
              options={printTypes}
              value={input.printType}
              onChange={(printType) => onChange({ ...input, printType })}
            />
            <Count
              label={t("colours")}
              max={6}
              value={input.colours}
              onChange={(colours) => onChange({ ...input, colours })}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("combine")}</legend>
            <p className="text-muted text-xs">{t("combineHint")}</p>
            {parts.map((part, index) => (
              <div key={index} className="border-border flex items-end gap-2 rounded-lg border p-2">
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <Millimetres
                    label={t("partLength", { no: index + 2 })}
                    value={part.lengthMm || undefined}
                    onChange={(lengthMm) =>
                      onChange({
                        ...input,
                        parts: parts.map((p, i) => (i === index ? { ...p, lengthMm: lengthMm ?? 0 } : p)),
                      })
                    }
                  />
                  <Millimetres
                    label={t("partWidth", { no: index + 2 })}
                    value={part.widthMm || undefined}
                    onChange={(widthMm) =>
                      onChange({
                        ...input,
                        parts: parts.map((p, i) => (i === index ? { ...p, widthMm: widthMm ?? 0 } : p)),
                      })
                    }
                  />
                  <Millimetres
                    label={t("partHeight", { no: index + 2 })}
                    value={part.heightMm || undefined}
                    onChange={(heightMm) =>
                      onChange({
                        ...input,
                        parts: parts.map((p, i) => (i === index ? { ...p, heightMm: heightMm ?? 0 } : p)),
                      })
                    }
                  />
                </div>
                <IconButton
                  name="trash"
                  variant="ghost"
                  size="sm"
                  label={t("removePart", { no: index + 2 })}
                  onClick={() => onChange({ ...input, parts: parts.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconStart="plus"
              onClick={() =>
                onChange({
                  ...input,
                  parts: [...parts, { pattern: input.pattern, lengthMm: 0, widthMm: 0, heightMm: 0 }],
                })
              }
            >
              {t("addPart")}
            </Button>
          </fieldset>
        </div>
      );
    }
    case "label": {
      const input = value as Of<"label">;
      return (
        <div className="space-y-4">
          <OptionSelect
            label={t("shape")}
            required
            options={data.options.shapes}
            value={input.shape}
            onChange={(shape) => onChange({ ...input, shape })}
          />
          <Size data={data} value={size(input)} onChange={(next) => setSize(input, next)} withHeight={false} />
          <OptionSelect
            label={t("material")}
            required
            options={data.options.materials}
            value={input.material}
            onChange={(material) => onChange({ ...input, material })}
          />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("printType")}
              options={printTypes}
              value={input.printType}
              onChange={(printType) => onChange({ ...input, printType })}
            />
            <Count
              label={t("colours")}
              max={8}
              value={input.colours}
              onChange={(colours) => onChange({ ...input, colours })}
            />
          </div>
          <Finishes
            options={data.options.finishes}
            value={input.finishes}
            onChange={(finishes) => onChange({ ...input, finishes })}
          />
        </div>
      );
    }
    case "tag_sleeve": {
      const input = value as Of<"tag_sleeve">;
      return (
        <div className="space-y-4">
          <OptionSelect
            label={t("kind")}
            options={[
              { code: "tag", name: t("tag"), group: null, meta: {} },
              { code: "sleeve", name: t("sleeve"), group: null, meta: {} },
            ]}
            value={input.kind}
            onChange={(kind) => onChange({ ...input, kind: kind as "tag" | "sleeve" })}
          />
          <Size data={data} value={size(input)} onChange={(next) => setSize(input, next)} withHeight={false} />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("material")}
              required
              options={data.options.materials}
              value={input.material}
              onChange={(material) => onChange({ ...input, material, gsm: 0 })}
            />
            <OptionSelect
              label={t("gsm")}
              required
              options={gsmOptions(data, input.material)}
              value={input.gsm ? String(input.gsm) : undefined}
              onChange={(gsm) => onChange({ ...input, gsm: Number(gsm) })}
            />
          </div>
          <OptionSelect
            label={t("printType")}
            options={printTypes}
            value={input.printType}
            onChange={(printType) => onChange({ ...input, printType })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Count
              label={t("frontColours")}
              max={8}
              value={input.front.colours}
              onChange={(colours) => onChange({ ...input, front: { ...input.front, colours } })}
            />
            <Count
              label={t("backColours")}
              max={8}
              value={input.back.colours}
              onChange={(colours) => onChange({ ...input, back: { ...input.back, colours } })}
            />
          </div>
          <Finishes
            options={data.options.finishes}
            value={input.finishes}
            onChange={(finishes) => onChange({ ...input, finishes })}
          />
        </div>
      );
    }
    case "pouch": {
      const input = value as Of<"pouch">;
      return (
        <div className="space-y-4">
          <OptionSelect
            label={t("pouchType")}
            required
            options={data.options.pouchTypes}
            value={input.pouchType}
            onChange={(pouchType) => onChange({ ...input, pouchType })}
          />
          <Size data={data} value={size(input)} onChange={(next) => setSize(input, next)} withHeight={false} />
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("material")}
              required
              options={data.options.materials}
              value={input.material}
              onChange={(material) => onChange({ ...input, material })}
            />
            <OptionSelect
              label={t("micron")}
              required
              options={data.options.microns}
              value={input.micron ? String(input.micron) : undefined}
              onChange={(micron) => onChange({ ...input, micron: Number(micron) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OptionSelect
              label={t("printType")}
              options={printTypes}
              value={input.printType}
              onChange={(printType) => onChange({ ...input, printType })}
            />
            <Count
              label={t("colours")}
              max={10}
              value={input.colours}
              onChange={(colours) => onChange({ ...input, colours })}
            />
          </div>
          <Switch
            label={t("zipper")}
            checked={input.zipper}
            onCheckedChange={(zipper) => onChange({ ...input, zipper })}
          />
          <Switch
            label={t("window")}
            checked={input.window}
            onCheckedChange={(window) => onChange({ ...input, window })}
          />
        </div>
      );
    }
    case "standard_product": {
      const input = value as Of<"standard_product">;
      return (
        <OptionSelect
          label={t("product")}
          required
          options={data.options.products}
          value={input.productCode}
          onChange={(productCode) => onChange({ ...input, productCode })}
        />
      );
    }
    case "service": {
      const input = value as Of<"service">;
      return (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("services")}</legend>
          {(data.options.services ?? []).map((service) => {
            const chosen = input.services.find((item) => item.code === service.code);
            return (
              <div key={service.code} className="flex items-end justify-between gap-3">
                <Checkbox
                  label={service.name}
                  checked={Boolean(chosen)}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...input,
                      services: checked
                        ? [...input.services, { code: service.code, quantity: 1 }]
                        : input.services.filter((item) => item.code !== service.code),
                    })
                  }
                />
                {chosen ? (
                  <Field label={t("serviceQuantity", { service: service.name })} className="w-32">
                    <NumberInput
                      min={1}
                      unit={String(service.meta.unit ?? "")}
                      value={chosen.quantity}
                      onChange={(event) =>
                        onChange({
                          ...input,
                          services: input.services.map((item) =>
                            item.code === service.code
                              ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      );
    }
  }
}
