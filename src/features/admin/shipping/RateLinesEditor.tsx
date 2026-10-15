"use client";

import { useLocale, useTranslations } from "next-intl";

import { IconButton } from "@/ui/components/IconButton";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

import { emptyLine, lineKey, type EditableLine, type LineProblem } from "./rates";
import { zoneLabel, type Zone } from "./zones";

/**
 * Every line of a rate card as one editable table (D-013): zone, an optional postcode override,
 * the weight band in kg and an optional volume band, the amount and the charge per extra kg. A
 * line with a problem is marked in place; the card is sent whole (copy-on-write).
 */
export function RateLinesEditor({
  lines,
  onChange,
  zones,
  problems,
  amountLabel,
}: {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  zones: readonly Zone[];
  problems: Map<string, LineProblem[]>;
  amountLabel: string;
}) {
  const t = useTranslations("shipping.editor");
  const locale = useLocale();
  const set = (key: string, patch: Partial<EditableLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const zoneOptions = [
    { value: "", label: t("chooseZone") },
    ...zones.map((zone) => ({ value: zone.id, label: zoneLabel(zone, locale) })),
  ];
  const cell = (line: EditableLine, field: keyof EditableLine, label: string, invalid: boolean, wide = false) => (
    <td className="px-1 py-1">
      <Input
        inputSize="sm"
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        className={wide ? "min-w-24" : "min-w-20"}
        value={line[field]}
        onChange={(e) => set(line.key, { [field]: e.target.value })}
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
              <th className="px-2 py-2 text-start font-medium">{t("zone")}</th>
              <th className="px-2 py-2 text-start font-medium">{t("postcode")}</th>
              <th className="px-2 py-2 text-start font-medium">{t("weightMin")}</th>
              <th className="px-2 py-2 text-start font-medium">{t("weightMax")}</th>
              <th className="px-2 py-2 text-start font-medium">{t("volumeMin")}</th>
              <th className="px-2 py-2 text-start font-medium">{t("volumeMax")}</th>
              <th className="px-2 py-2 text-start font-medium">{amountLabel}</th>
              <th className="px-2 py-2 text-start font-medium">{t("perExtraKg")}</th>
              <th className="px-2 py-2">
                <span className="sr-only">{t("lineActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const issues = problems.get(line.key) ?? [];
              const has = (...kinds: LineProblem[]) => kinds.some((kind) => issues.includes(kind));
              return (
                <tr key={line.key} className={issues.length ? "bg-danger-subtle" : undefined}>
                  <td className="px-1 py-1">
                    <NativeSelect
                      aria-label={t("zone")}
                      aria-invalid={has("zone") || undefined}
                      className="min-w-56"
                      value={line.zoneId}
                      onValueChange={(zoneId) => set(line.key, { zoneId })}
                      options={zoneOptions}
                    />
                  </td>
                  {cell(line, "postcode", t("postcode"), has("postcode"))}
                  {cell(line, "weightMinKg", t("weightMin"), has("weight", "weightOrder", "overlap"))}
                  {cell(line, "weightMaxKg", t("weightMax"), has("weight", "weightOrder", "overlap"))}
                  {cell(line, "volumeMinCm3", t("volumeMin"), has("volume", "volumeOrder"))}
                  {cell(line, "volumeMaxCm3", t("volumeMax"), has("volume", "volumeOrder"))}
                  {cell(line, "amount", amountLabel, has("amount"), true)}
                  {cell(line, "perExtraKg", t("perExtraKg"), has("perExtraKg"))}
                  <td className="px-1 py-1 whitespace-nowrap">
                    <IconButton
                      name="copy"
                      size="sm"
                      variant="ghost"
                      label={t("duplicate", { n: index + 1 })}
                      onClick={() => {
                        const next = [...lines];
                        next.splice(index + 1, 0, {
                          ...line,
                          key: lineKey(),
                          weightMinKg: line.weightMaxKg,
                          weightMaxKg: "",
                        });
                        onChange(next);
                      }}
                    />
                    <IconButton
                      name="trash"
                      size="sm"
                      variant="ghost"
                      label={t("remove", { n: index + 1 })}
                      onClick={() => onChange(lines.filter((x) => x.key !== line.key))}
                    />
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted px-3 py-6 text-center">
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
          onClick={() => onChange([...lines, emptyLine(lines.at(-1)?.zoneId)])}
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
