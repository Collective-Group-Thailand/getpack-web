"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

import { emptyMarginLine, marginLineKey, type EditableMarginLine, type MarginLineProblem } from "./margins";

/**
 * Every line of a sell-margin version as one editable table (D-063): the run and buy-price bands,
 * an optional colour count and difficulty level, the value as a percentage or an amount and an
 * optional minimum. A line with a problem is marked in place; the version is sent whole.
 */
export function MarginLinesEditor({
  lines,
  onChange,
  problems,
  levels,
}: {
  lines: EditableMarginLine[];
  onChange: (lines: EditableMarginLine[]) => void;
  problems: Map<string, MarginLineProblem[]>;
  levels: readonly { value: string; label: string }[];
}) {
  const t = useTranslations("pricing.lines");
  const set = (key: string, patch: Partial<EditableMarginLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const cell = (line: EditableMarginLine, field: keyof EditableMarginLine, label: string, invalid: boolean) => (
    <td className="px-1 py-1">
      <Input
        inputSize="sm"
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        className="min-w-20"
        value={line[field]}
        onChange={(event) => set(line.key, { [field]: event.target.value })}
      />
    </td>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead className="bg-surface-subtle text-muted text-xs">
            <tr>
              {(
                [
                  "qtyMin",
                  "qtyMax",
                  "priceMin",
                  "priceMax",
                  "colourCount",
                  "level",
                  "valueKind",
                  "value",
                  "minAmount",
                ] as const
              ).map((column) => (
                <th key={column} className="px-2 py-2 text-start font-medium whitespace-nowrap">
                  {t(column)}
                </th>
              ))}
              <th className="px-2 py-2">
                <span className="sr-only">{t("lineActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const issues = problems.get(line.key) ?? [];
              const has = (...kinds: MarginLineProblem[]) => kinds.some((kind) => issues.includes(kind));
              return (
                <tr key={line.key} className={issues.length ? "bg-danger-subtle" : undefined}>
                  {cell(line, "qtyMin", t("qtyMin"), has("qty", "qtyOrder", "overlap"))}
                  {cell(line, "qtyMax", t("qtyMax"), has("qty", "qtyOrder", "overlap"))}
                  {cell(line, "priceMin", t("priceMin"), has("price", "priceOrder", "overlap"))}
                  {cell(line, "priceMax", t("priceMax"), has("price", "priceOrder", "overlap"))}
                  {cell(line, "colourCount", t("colourCount"), has("colourCount"))}
                  <td className="px-1 py-1">
                    <NativeSelect
                      aria-label={t("level")}
                      className="min-w-40"
                      value={line.difficultyLevelId}
                      onValueChange={(difficultyLevelId) => set(line.key, { difficultyLevelId })}
                      options={[{ value: "", label: t("anyLevel") }, ...levels]}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <NativeSelect
                      aria-label={t("valueKind")}
                      className="min-w-28"
                      value={line.valueKind}
                      onValueChange={(valueKind) => set(line.key, { valueKind: valueKind as "pct" | "amount" })}
                      options={[
                        { value: "pct", label: t("kinds.pct") },
                        { value: "amount", label: t("kinds.amount") },
                      ]}
                    />
                  </td>
                  {cell(line, "value", t("value"), has("value", "pct"))}
                  {cell(line, "minAmount", t("minAmount"), has("minAmount"))}
                  <td className="px-1 py-1 whitespace-nowrap">
                    <IconButton
                      name="copy"
                      size="sm"
                      variant="ghost"
                      label={t("duplicate", { n: index + 1 })}
                      onClick={() => {
                        const next = [...lines];
                        const after = line.qtyMax.trim() && /^\d+$/.test(line.qtyMax.trim());
                        next.splice(index + 1, 0, {
                          ...line,
                          key: marginLineKey(),
                          qtyMin: after ? String(Number(line.qtyMax) + 1) : line.qtyMin,
                          qtyMax: "",
                        });
                        onChange(next);
                      }}
                    />
                    <IconButton
                      name="trash"
                      size="sm"
                      variant="ghost"
                      label={t("remove", { n: index + 1 })}
                      onClick={() => onChange(lines.filter((candidate) => candidate.key !== line.key))}
                    />
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-muted px-3 py-6 text-center">
                  {t("noLines")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          iconStart="plus"
          onClick={() => onChange([...lines, emptyMarginLine()])}
        >
          {t("add")}
        </Button>
        <p className="text-muted text-xs">{t("hint")}</p>
      </div>
      {problems.size ? (
        <ul className="text-danger flex flex-col gap-0.5 text-sm" aria-live="polite">
          {[...problems.entries()].slice(0, 8).map(([key, issues]) => (
            <li key={key}>
              {t("lineProblem", {
                n: lines.findIndex((line) => line.key === key) + 1,
                problems: issues.map((issue) => t(`errors.${issue}`)).join(", "),
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
