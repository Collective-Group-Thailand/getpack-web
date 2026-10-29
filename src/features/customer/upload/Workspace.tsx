"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import type { Configurator } from "@/features/customer/configurator/state";
import { BoxPreview3D } from "@/features/designer/components/BoxPreview3D";
import type { BoxStyleId } from "@/features/designer/types";
import { useFormat } from "@/features/shared/format/useFormat";
import { Button } from "@/ui/components/Button";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { useFileCheckRules, versionFileUrl, type FileCheck, type FileCheckItem, type FileCheckVersion } from "./api";
import { PdfPreview, type MarkedItem, type PreviewSource } from "./PdfPreview";

const STAGES = ["read", "die", "match", "checks", "price"] as const;
const LEVEL_TONE: Record<string, { dot: string; tag: string }> = {
  must_fix: { dot: "bg-danger", tag: "bg-danger-subtle text-danger-subtle-fg" },
  review: { dot: "bg-warning", tag: "bg-warning-subtle text-warning-subtle-fg" },
  pass: { dot: "bg-success", tag: "bg-success-subtle text-success-subtle-fg" },
  not_checked: { dot: "bg-border-strong", tag: "bg-bg-subtle text-muted" },
};

/**
 * The file-check workspace (upload redesign Phase 2 items 2–4): file chips (each file a variant; its version, a
 * status dot, remove), "เพิ่มไฟล์ (รุ่นใหม่)"; the detection banner ("ไฟล์นี้คือ … อ่านจากเส้นไดคัทในไฟล์") with the
 * size ordered — a size or product that no longer matches the die lines turns it red and the size check fails
 * ("ไม่ตรงกับไฟล์", must fix) with "ใช้ขนาดตามไฟล์"; the file itself with numbered markers (or the box in 3D); the 12
 * checks with counts — must fix / review / passed / checked by the team — each with what, where and how to fix it in
 * Illustrator; "อัปโหลดไฟล์ที่แก้แล้ว" (a new version, checked again) and the file's history. All from the API's
 * report; nothing here judges a file.
 */
export function Workspace({
  check,
  configurator,
  boxStyle,
  localFiles,
  active,
  onActive,
  onAddFiles,
  onRemove,
  onSpec,
}: {
  check: FileCheck;
  configurator: Configurator | null;
  boxStyle: BoxStyleId | null;
  localFiles: ReadonlyMap<string, File>;
  active: number;
  onActive: (variantNo: number) => void;
  onAddFiles: (files: File[], variantNo?: number) => void;
  onRemove: (variantNo: number) => void;
  onSpec: (patch: { productSlug?: string | null; sizeCode?: string | null }) => void;
}) {
  const t = useTranslations("studio.upload.workspace");
  const tChecks = useTranslations("studio.upload.checks");
  const rules = useFileCheckRules();
  const ruleVars = { bleed: rules.data?.bleedMm ?? "", safe: rules.data?.safeZoneMm ?? "" };
  // C12 (D-460): an item states the distance the API checked it with (corrugated board has its own safe zone).
  const varsOf = (item?: { measurements?: Record<string, unknown> }) => {
    const safe = item?.measurements?.["safeZoneMm"];
    return typeof safe === "number" ? { ...ruleVars, safe: String(safe) } : ruleVars;
  };
  const tCheck = (key: string, item?: { measurements?: Record<string, unknown> }) =>
    (tChecks as unknown as (k: string, values: Record<string, string>) => string)(key, varsOf(item));
  const locale = useLocale();
  const format = useFormat();
  const variant = check.variants.find((v) => v.variantNo === active) ?? check.variants[0]!;
  // An earlier version opened from the history; it closes when another file or a new version comes up.
  const [opened, setViewing] = useState<FileCheckVersion | null>(null);
  const viewing = opened && variant.history.some((h) => h.id === opened.id) ? opened : null;
  const version = viewing ?? variant.current;
  const [view, setView] = useState<"flat" | "3d">("flat");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const fixInput = useRef<HTMLInputElement>(null);

  const report = version.report;
  const items = report?.items ?? [];
  const problems = items.filter((i) => i.level === "must_fix" || i.level === "review");
  const passed = items.filter((i) => i.level === "pass");
  const unchecked = items.filter((i) => i.level === "not_checked");
  const marked: MarkedItem[] = problems.filter((i) => i.at).map((item, index) => ({ item, n: index + 1 }));
  const numberOf = (item: FileCheckItem) => marked.find((m) => m.item.check === item.check)?.n ?? null;
  const firstProblem = problems.find((i) => i.level === "must_fix")?.check ?? problems[0]?.check ?? null;
  const expanded = open ?? selected ?? firstProblem;

  const source: PreviewSource = useMemo(() => {
    const local = localFiles.get(version.fileId);
    if (local) return { kind: "file", file: local };
    return { kind: "url", load: () => versionFileUrl(check.id, version.id) };
  }, [localFiles, version.fileId, version.id, check.id]);

  const match = version.detection?.match ?? null;
  const productMismatch =
    match !== null && check.spec.productSlug !== null && check.spec.productSlug !== match.productSlug;
  const sizeMismatch =
    match !== null && !productMismatch && check.spec.sizeCode !== null && check.spec.sizeCode !== match.sizeCode;
  const mismatch = productMismatch || sizeMismatch;
  const sizes = configurator?.standardSizes ?? [];
  const size = sizes.find((s) => s.code === check.spec.sizeCode) ?? null;

  return (
    <section
      aria-labelledby="upload-workspace"
      className="rounded-card border-border bg-surface overflow-hidden border"
    >
      <h2 id="upload-workspace" className="sr-only">
        {t("heading")}
      </h2>
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3.5 sm:px-5">
        {/* A group of switch buttons, not a tablist: each file also has its remove button, and there is no tab panel. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" role="group" aria-label={t("files")}>
          {check.variants.map((v) => {
            const on = v.variantNo === variant.variantNo;
            const tone =
              v.current.status !== "done"
                ? "bg-info"
                : v.current.report?.blocking
                  ? "bg-danger"
                  : v.current.report && v.current.report.counts.review > 0
                    ? "bg-warning"
                    : "bg-success";
            return (
              <span
                key={v.variantNo}
                className={cn(
                  "rounded-control bg-surface inline-flex h-[2.125rem] max-w-[16rem] items-center gap-2 border ps-2.5 pe-1.5 text-[0.8125rem]",
                  on ? "border-fg ring-fg ring-1" : "border-border-strong",
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-hidden="true" />
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onActive(v.variantNo)}
                  className="flex min-w-0 items-center gap-1.5 outline-none focus-visible:underline"
                >
                  <b className="truncate font-semibold">{v.current.fileName}</b>
                  <small className="bg-bg-subtle rounded-control px-1.5 text-[0.6875rem] font-semibold tabular-nums">
                    {t("version", { n: v.current.versionNo })}
                  </small>
                </button>
                {v.current.cartItemId ? null : (
                  <button
                    type="button"
                    onClick={() => onRemove(v.variantNo)}
                    aria-label={t("remove", { name: v.current.fileName })}
                    className="text-muted hover:text-fg hover:bg-bg-subtle rounded-control grid size-6 place-items-center"
                  >
                    <Icon name="close" size={14} aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => addInput.current?.click()}
            className="border-border-strong text-muted hover:border-primary hover:text-primary rounded-control inline-flex h-[2.125rem] items-center gap-1.5 border border-dashed px-3 text-[0.8125rem]"
          >
            <Icon name="plus" size={15} aria-hidden="true" />
            {t("addVariant")}
          </button>
        </div>
      </div>

      {version.status === "done" && version.detection ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5",
            mismatch || !match ? "bg-danger-subtle" : "bg-primary-subtle",
          )}
        >
          <Icon
            name={mismatch || !match ? "warning" : "scan"}
            size={20}
            className={mismatch || !match ? "text-danger" : "text-primary"}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            {match && !mismatch ? (
              <>
                <b className="font-semibold">
                  {t("detected", {
                    product: pick(locale, match.productNameTh, match.productNameEn),
                    size: match.sizeName,
                  })}
                </b>
                {" · "}
                <span className="tabular-nums">
                  {t("inside", { l: match.insideMm[0]!, w: match.insideMm[1]!, h: match.insideMm[2]! })}
                </span>
                {" · "}
                {version.detection.sheet?.source === "die" ? t("fromDie") : t("fromTrim")}
              </>
            ) : match ? (
              <>
                <b className="font-semibold">{t("mismatch")}</b>{" "}
                {t("mismatchBody", {
                  product: pick(locale, match.productNameTh, match.productNameEn),
                  size: match.sizeName,
                })}
              </>
            ) : (
              <>
                <b className="font-semibold">{t("noMatch")}</b> {t("noMatchBody")}
              </>
            )}
          </span>
          {mismatch && match ? (
            <Button size="sm" onClick={() => onSpec({ productSlug: match.productSlug, sizeCode: match.sizeCode })}>
              {t("useFileSize")}
            </Button>
          ) : null}
          {sizes.length ? (
            <div className="w-full sm:w-auto">
              <NativeSelect
                aria-label={t("orderSize")}
                className="h-8 text-[0.8125rem]"
                value={check.spec.sizeCode ?? ""}
                onValueChange={(value) => onSpec({ sizeCode: value || null })}
                options={[
                  ...(check.spec.sizeCode ? [] : [{ value: "", label: t("chooseSize") }]),
                  ...sizes.map((s) => ({
                    value: s.code,
                    label: t("sizeOption", { code: s.code, l: s.lengthMm, w: s.widthMm, h: s.heightMm }),
                  })),
                ]}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {version.status !== "done" && version.status !== "failed" ? (
        <div className="flex flex-col gap-3.5 px-5 py-7" aria-live="polite">
          <h3 className="text-[1.0625rem] font-semibold">{t("checking", { name: version.fileName })}</h3>
          <div
            className="bg-bg-subtle h-1.5 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={version.stage}
            aria-label={t("progress")}
          >
            <span className="bg-primary block h-full transition-[width]" style={{ width: `${version.stage * 20}%` }} />
          </div>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {STAGES.map((stage, index) => {
              const done = index < version.stage;
              const running = index === version.stage;
              return (
                <li
                  key={stage}
                  className={cn(
                    "flex items-center gap-2.5 text-sm",
                    done ? "text-muted" : running ? "text-fg" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-[1.375rem] place-items-center rounded-full border-2",
                      done
                        ? "border-primary bg-primary text-primary-fg"
                        : running
                          ? "border-primary"
                          : "border-border-strong",
                    )}
                    aria-hidden="true"
                  >
                    {done ? (
                      <Icon name="check" size={13} />
                    ) : running ? (
                      <Icon name="spinner" size={13} className="animate-spin" />
                    ) : null}
                  </span>
                  {t(`stages.${stage}`)}
                </li>
              );
            })}
          </ol>
          <p className="text-muted m-0 text-[0.8125rem]">{t("checkingNote")}</p>
        </div>
      ) : version.status === "failed" ? (
        <p className="text-danger m-0 px-5 py-7 text-sm">{t("failed")}</p>
      ) : (
        <>
          <div className="bg-bg-subtle border-border border-b">
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
              <SegmentedControl
                size="sm"
                label={t("view")}
                value={view}
                onValueChange={setView}
                options={[
                  { value: "flat", label: t("flat") },
                  ...(boxStyle && size ? [{ value: "3d" as const, label: t("threeD") }] : []),
                ]}
              />
              <span className="text-muted ms-auto flex gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <i className="border-danger w-4 border-t-2 border-dashed" aria-hidden="true" />
                  {t("legendDie")}
                </span>
              </span>
            </div>
            <div className="px-3.5 pb-3">
              {view === "3d" && boxStyle && size ? (
                <div className="grid min-h-72 place-items-center">
                  <BoxPreview3D
                    style={boxStyle}
                    dims={{ length: size.lengthMm, width: size.widthMm, height: size.heightMm }}
                    colour="#d8c3a0"
                    printed
                    label={t("threeDLabel", { l: size.lengthMm, w: size.widthMm, h: size.heightMm })}
                    labels={{
                      rotateLeft: t("rotateLeft"),
                      rotateRight: t("rotateRight"),
                      tiltUp: t("tiltUp"),
                      tiltDown: t("tiltDown"),
                      reset: t("reset"),
                    }}
                  />
                </div>
              ) : (
                <PdfPreview
                  source={source}
                  mediaBox={report?.page?.mediaBox ?? null}
                  dieBox={report?.page?.dieBox ?? report?.page?.trimBox ?? null}
                  marked={marked}
                  selected={selected}
                  onSelect={(c) => {
                    setSelected(c);
                    setOpen(c);
                  }}
                  label={t("previewLabel", { name: version.fileName })}
                />
              )}
              <p className="text-muted m-0 mt-2 text-xs">
                {view === "3d"
                  ? t("threeDNote")
                  : viewing
                    ? t("viewingOld", { v: viewing.versionNo })
                    : t("previewNote")}
              </p>
            </div>
          </div>

          {report ? (
            <>
              <div className="border-border grid grid-cols-3 border-b text-center" aria-live="polite">
                {(
                  [
                    ["mustFix", report.counts.mustFix, "text-danger"],
                    ["review", report.counts.review, "text-warning-subtle-fg"],
                    ["pass", report.counts.pass, "text-success"],
                  ] as const
                ).map(([key, value, tone], index) => (
                  <div key={key} className={cn("px-2.5 py-3.5", index < 2 && "border-border border-e")}>
                    <b className={cn("block text-2xl leading-none font-bold tabular-nums", tone)}>
                      {format.number(value)}
                    </b>
                    <small className="text-muted text-xs">{t(`counts.${key}`, { total: items.length })}</small>
                  </div>
                ))}
              </div>
              <div className="grid items-start gap-2 p-3 min-[860px]:grid-cols-2">
                {problems.length === 0 ? (
                  <p className="bg-success-subtle text-success-subtle-fg rounded-control m-0 p-3 text-sm font-semibold min-[860px]:col-span-2">
                    {t("allPassed")}
                  </p>
                ) : null}
                {problems.map((item) => {
                  const isOpen = expanded === item.check;
                  const n = numberOf(item);
                  const tone = LEVEL_TONE[item.level]!;
                  return (
                    <div
                      key={item.check}
                      className={cn(
                        "rounded-control border-border bg-surface overflow-hidden border",
                        isOpen && "min-[860px]:col-span-2",
                        selected === item.check && "border-info ring-info ring-1",
                      )}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => {
                          setOpen(isOpen ? "" : item.check);
                          setSelected(item.check);
                        }}
                        className="grid w-full grid-cols-[1.625rem_1fr_auto] items-start gap-2.5 p-3 text-start"
                      >
                        <span
                          className={cn(
                            "grid size-6 place-items-center rounded-full text-xs font-bold text-white",
                            tone.dot,
                          )}
                          aria-hidden="true"
                        >
                          {n ?? <Icon name="warning" size={13} />}
                        </span>
                        <span className="min-w-0">
                          <b className="block text-sm font-semibold">{tCheck(`${item.check}.title`, item)}</b>
                          <small className="text-muted mt-0.5 block text-[0.8125rem]">
                            {locale === "en" ? item.messageEn : item.messageTh}
                          </small>
                        </span>
                        <span
                          className={cn(
                            "rounded-control px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap",
                            tone.tag,
                          )}
                        >
                          {t(`levels.${item.level}`)}
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="text-muted flex flex-col gap-2.5 px-3 pb-3 text-[0.8125rem] sm:ps-12">
                          <div>
                            <b className="text-fg font-semibold">{t("howTo")}</b>
                            <p className="m-0">{tCheck(`${item.check}.howTo`, item)}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.check === "size_mismatch" && match ? (
                              <Button
                                size="sm"
                                onClick={() => onSpec({ productSlug: match.productSlug, sizeCode: match.sizeCode })}
                              >
                                {t("useFileSize")}
                              </Button>
                            ) : null}
                            {variant.current.cartItemId ? null : (
                              <Button
                                size="sm"
                                variant="secondary"
                                iconStart="upload"
                                onClick={() => fixInput.current?.click()}
                              >
                                {t("uploadFixed")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {unchecked.length ? (
                  <details className="rounded-control bg-bg-subtle min-[860px]:col-span-2">
                    <summary className="text-muted cursor-pointer px-3 py-2.5 text-[0.84375rem] font-semibold">
                      {t("notChecked", { count: unchecked.length })}
                    </summary>
                    <ul className="text-muted m-0 flex list-none flex-col gap-1.5 px-3 pb-3 text-[0.8125rem]">
                      {unchecked.map((item) => (
                        <li key={item.check} className="flex gap-2">
                          <Icon name="users" size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            <b className="text-fg font-semibold">{tCheck(`${item.check}.title`, item)}</b> ·{" "}
                            {locale === "en" ? item.messageEn : item.messageTh}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <details
                  className="rounded-control bg-success-subtle min-[860px]:col-span-2"
                  open={problems.length === 0}
                >
                  <summary className="text-success-subtle-fg cursor-pointer px-3 py-2.5 text-[0.84375rem] font-semibold">
                    {t("passedCount", { count: passed.length })}
                  </summary>
                  <ul className="text-muted m-0 flex list-none flex-col gap-1.5 px-3 pb-3 text-[0.8125rem]">
                    {passed.map((item) => (
                      <li key={item.check} className="flex gap-2">
                        <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          <b className="text-fg font-semibold">{tCheck(`${item.check}.title`, item)}</b> ·{" "}
                          {tCheck(`${item.check}.body`, item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </>
          ) : null}
        </>
      )}

      {variant.history.length ? (
        <details className="border-border border-t px-4 py-2.5">
          <summary className="text-muted cursor-pointer text-[0.84375rem] font-semibold">
            {t("history", { count: variant.history.length + 1 })}
          </summary>
          <ul className="m-0 list-none p-0">
            {[variant.current, ...variant.history].map((v) => (
              <li
                key={v.id}
                className="border-border grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-t border-dashed py-2 text-[0.8125rem] first:border-t-0"
              >
                <span className="bg-bg-subtle rounded-control px-1.5 text-xs font-semibold tabular-nums">
                  {t("version", { n: v.versionNo })}
                </span>
                <span className="min-w-0 truncate">
                  {v.fileName} ·{" "}
                  {v.report?.blocking ? (
                    <span className="text-danger">{t("historyFix", { count: v.report.counts.mustFix })}</span>
                  ) : v.report ? (
                    <span className="text-success">{t("historyPass")}</span>
                  ) : (
                    t("historyChecking")
                  )}
                </span>
                {v.id === version.id ? (
                  <span className="text-muted text-xs">{t("viewing")}</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setViewing(v.id === variant.current.id ? null : v)}>
                    {t("view")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {variant.current.cartItemId ? (
        <p className="border-border text-muted m-0 border-t p-3 text-sm">{t("inCart")}</p>
      ) : (
        <div className="border-border flex flex-wrap gap-2 border-t p-3">
          <Button variant="secondary" iconStart="upload" onClick={() => fixInput.current?.click()} className="flex-1">
            {t("uploadFixed")}
          </Button>
        </div>
      )}

      <input
        ref={addInput}
        type="file"
        hidden
        multiple
        accept=".pdf,.ai,application/pdf,application/postscript,application/illustrator"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) onAddFiles(files);
        }}
      />
      <input
        ref={fixInput}
        type="file"
        hidden
        accept=".pdf,.ai,application/pdf,application/postscript,application/illustrator"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files[0]) onAddFiles([files[0]], variant.variantNo);
        }}
      />
    </section>
  );
}
