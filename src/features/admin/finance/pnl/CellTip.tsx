"use client";

import { useTranslations } from "next-intl";

import { PNL_CELL_MODE } from "@/domain/status";
import { Icon } from "@/ui/icons";

import { usePnlFormat, type PnlFormat } from "./format";
import type { PnlCell, PnlLine, PnlMonth } from "./resources";

/** One labelled part of a tooltip: the label quiet, the text full strength. */
function Part({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <span className="block" data-tip-part={testId}>
      <span className="opacity-75">{label}: </span>
      {children}
    </span>
  );
}

/**
 * What a line is (D-472 item 3, PNL-LINES.md): the definition, the formula, where the system takes it from (with the
 * GL accounts mapped to it), and how to fill it by hand. All four parts are always drawn — a line nobody fills says
 * why instead — so a reader learns the same shape for every line.
 */
export function LineTipContent({ line }: { line: PnlLine }) {
  const t = useTranslations("finance.pnl.tip");
  const format = usePnlFormat();
  const howToFill =
    format.text(line.howToFill) ??
    (line.calc === "formula" ? t("formulaNoFill") : line.key === "depreciation" ? t("noHowToFill") : t("systemNoFill"));
  return (
    <span className="flex max-w-80 flex-col gap-1.5 py-1 text-start leading-snug" data-line-tip={line.key}>
      <span className="font-semibold">{format.label(line)}</span>
      <span data-tip-part="definition">{format.text(line.definition)}</span>
      <Part label={t("formula")} testId="formula">
        {format.text(line.formula)}
      </Part>
      <Part label={t("source")} testId="source">
        {format.text(line.source)}
        {line.glAccounts.length ? (
          <span className="mt-0.5 block opacity-90">
            {t("accounts")}{" "}
            {line.glAccounts
              .map((account) => {
                const name = format.locale === "th" ? account.nameTh : (account.nameEn ?? account.nameTh);
                const rules = account.onlyRules.length
                  ? ` (${t("onlyRules", { rules: account.onlyRules.join(", ") })})`
                  : account.excludeRules.length
                    ? ` (${t("excludeRules", { rules: account.excludeRules.join(", ") })})`
                    : "";
                return `${account.code}${name ? ` ${name}` : ""}${rules}`;
              })
              .join(" · ")}
          </span>
        ) : null}
      </Part>
      <Part label={t("howToFill")} testId="howToFill">
        {howToFill}
      </Part>
    </span>
  );
}

/** The concrete inputs behind a cell (`sourceRef`), in words: accounts, entries, window, ratio, deals, assets. */
function refWords(ref: Record<string, unknown> | null, format: PnlFormat, t: ReturnType<typeof useTranslations>) {
  if (!ref) return [];
  const out: string[] = [];
  const num = (key: string) => (typeof ref[key] === "number" ? (ref[key] as number) : null);
  const str = (key: string) => (typeof ref[key] === "string" ? (ref[key] as string) : null);
  if (Array.isArray(ref["accounts"]) && ref["accounts"].length)
    out.push(t("ref.accounts", { codes: (ref["accounts"] as string[]).join(", ") }));
  if (num("lines") !== null) out.push(t("ref.lines", { count: num("lines")! }));
  const window = str("window");
  if (window && window.includes("..")) {
    const [from, to] = window.split("..") as [string, string];
    out.push(t("ref.window", { from: format.month(from), to: format.month(to) }));
  }
  if (str("ratioPct")) out.push(t("ref.ratioPct", { pct: format.percent(str("ratioPct")) }));
  if (str("pipelinePerMonth")) out.push(t("ref.pipeline", { amount: format.thb(str("pipelinePerMonth")) }));
  if (str("runRatePerMonth")) out.push(t("ref.runRate", { amount: format.thb(str("runRatePerMonth")) }));
  if (num("openLeads")) out.push(t("ref.openLeads", { count: num("openLeads")! }));
  if (num("repeatCustomers")) out.push(t("ref.repeatCustomers", { count: num("repeatCustomers")! }));
  if (num("assets")) out.push(t("ref.assets", { count: num("assets")! }));
  if (ref["smeApplied"] === true) out.push(t("ref.citSme"));
  else if (ref["smeApplied"] === false && str("ratePct"))
    out.push(t("ref.citStandard", { pct: format.percent(str("ratePct")) }));
  return out;
}

/**
 * A cell explains itself (D-472 item 3): what the line is and its formula, where this value came from (the source in
 * words with its inputs, and a drill-down to the records), when the data was true, and — for a person's value — who
 * entered it and why. An empty manual cell shows how to fill it. The drill-down button works with a pointer; the
 * keyboard reaches the same list with Shift+Enter on the cell (a tooltip holds no tab stop).
 */
export function CellTipContent({
  line,
  cell,
  month,
  onDrill,
}: {
  line: PnlLine;
  cell: PnlCell;
  month: PnlMonth | undefined;
  onDrill?: () => void;
}) {
  const t = useTranslations("finance.pnl.tip");
  const tGrid = useTranslations("finance.pnl.grid");
  const tStatus = useTranslations("status");
  const format = usePnlFormat();
  const mode = PNL_CELL_MODE[cell.mode];
  const refs = refWords(cell.sourceRef, format, t);
  const person = cell.mode === "manual" || cell.mode === "override";

  return (
    <span
      className="flex max-w-80 flex-col gap-1.5 py-1 text-start leading-snug"
      data-cell-tip={`${line.key}:${cell.month}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold">
          {tGrid("cellName", { line: format.label(line), month: format.month(cell.month) })}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs opacity-90">
          <Icon name={mode.icon} size={12} aria-hidden />
          {tStatus(mode.labelKey)}
        </span>
      </span>
      <span data-tip-part="definition">{format.text(line.definition)}</span>
      <Part label={t("formula")} testId="formula">
        {format.text(line.formula)}
      </Part>
      <Part label={t("source")} testId="source">
        {t(`kinds.${cell.source}`)}
        {refs.length ? <span className="block opacity-90">{refs.join(" · ")}</span> : null}
      </Part>
      {month ? (
        <span className="block opacity-90">
          {month.kind === "forecast" ? t("forecastMonth") : t("actualMonth")}
          {month.periodOpen ? ` — ${t("periodOpen")}` : ""}
        </span>
      ) : null}
      {cell.value === null && cell.sourceRef?.["status"] === "not_set" ? <span>{t("notSet")}</span> : null}
      {cell.mode === "manual" && cell.value === null ? (
        <Part label={t("howToFill")} testId="howToFill">
          {format.text(line.howToFill) ?? t("noHowToFill")}
        </Part>
      ) : null}
      {cell.mode === "override" ? (
        <span className="block">{t("autoValue", { value: format.value(line, cell.autoValue) })}</span>
      ) : null}
      {person && cell.note ? (
        <Part label={cell.mode === "override" ? t("reason") : t("note")} testId="note">
          {cell.note}
        </Part>
      ) : null}
      {person && cell.updatedBy ? (
        <Part label={t("entered")}>
          {t("by", { name: cell.updatedBy.displayName, at: format.dateTime(cell.updatedAt) })}
        </Part>
      ) : null}
      {cell.asOf && !person ? (
        <span className="opacity-75">
          {t("asOf")} {format.dateTime(cell.asOf)}
        </span>
      ) : null}
      {cell.drillable && onDrill ? (
        <button
          type="button"
          onClick={onDrill}
          className="focus-visible:ring-focus-ring mt-0.5 inline-flex items-center gap-1.5 self-start rounded-sm font-medium underline underline-offset-2 outline-none focus-visible:ring-2"
        >
          <Icon name="list-bullet" size={12} aria-hidden />
          {t("drill")}
          <span className="opacity-75">{t("drillKeyHint")}</span>
        </button>
      ) : null}
    </span>
  );
}
