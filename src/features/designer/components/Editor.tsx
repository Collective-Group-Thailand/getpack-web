"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type Konva from "konva";
import { nanoid } from "nanoid";

import { getStyle, PX_PER_MM, SPEC_VERSION } from "@packio/dieline";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { boardColour, getPaper, papersFor } from "@/features/designer/catalog";
import { dielineOf, insideSize } from "@/features/designer/document";
import {
  exportDielineDxf,
  exportDielinePdf,
  exportDielineSvg,
  exportPdf,
  exportPng,
  makeThumbnail,
} from "@/features/designer/export";
import { designRepo } from "@/features/designer/storage";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/features/designer/store/editor";
import type { BoxDims, BoxStyleId } from "@/features/designer/types";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/i18n/format";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { NumberInput } from "@/ui/components/Input";
import { Slider } from "@/ui/components/Slider";
import { toast } from "@/ui/components/Toast";
import { TooltipProvider } from "@/ui/components/Tooltip";
import { BrandMark } from "@/ui/brand";

import { PrintRulesModal } from "./PrintRulesModal";
import { SetupModal } from "./SetupModal";
import { PatternPanel, PropertiesPanel, ViewPanel } from "./SidePanel";
import { Toolbar } from "./Toolbar";

const DesignCanvas = dynamic(() => import("./DesignCanvas"), { ssr: false });

type ExportKind = "pdf" | "png" | "png-guides" | "svg" | "dxf" | "dieline-pdf";

function useSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }),
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);
  return [ref, size] as const;
}

/** A box to start a new design from — the configurator's style and inside size (F3 3.2). */
export interface EditorSeed {
  style: BoxStyleId;
  dims: BoxDims;
}

export default function Editor({ id, seed }: { id: string; seed?: EditorSeed }) {
  const t = useTranslations("designer");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();

  const state = useEditor();
  const { spec, content, selectedId, zoom, setZoom, name, dirty } = state;

  const stageRef = useRef<Konva.Stage | null>(null);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  /*
   * Loading the design. Both setState calls below are part of that load, not a reaction to
   * it: the design lives in localStorage, which cannot be read during render, and the editor
   * renders nothing until it arrives. That is the case `set-state-in-effect` cannot express,
   * so the two calls are exempted individually rather than the rule being downgraded
   * repo-wide. F4 Part B moves designs to the API and the effect goes with it.
   */
  useEffect(() => {
    const existing = id !== "new" ? designRepo.get(id) : undefined;
    if (existing) {
      useEditor
        .getState()
        .load({ id: existing.id, name: existing.name, spec: existing.spec, content: existing.content });
    } else {
      useEditor.getState().load({ id: id === "new" ? nanoid(10) : id, name: t("untitled"), spec: null });
      // A design with no box opens straight into setup — there is nothing else to show.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetupOpen(true);
    }
    setLoaded(true);
  }, [id, t]);

  const dieline = useMemo(() => (spec ? dielineOf(spec) : null), [spec]);
  const paperColour = spec ? boardColour(spec) : null;
  const paperName = spec ? (getPaper(spec.materialId)?.name ?? null) : null;
  const selected = content.elements.find((element) => element.id === selectedId);

  const save = useCallback(() => {
    const current = useEditor.getState();
    if (!current.spec || !dieline || !stageRef.current) return;

    const now = Date.now();
    const previous = designRepo.get(current.designId);
    const saved = designRepo.save({
      id: current.designId,
      name: current.name.trim() || t("unnamed"),
      spec: current.spec,
      content: current.content,
      thumbnail: makeThumbnail(stageRef.current, dieline),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });

    if (!saved) {
      toast.error(t("saveFailedStorageFull"));
      return;
    }

    current.markSaved();
    if (id === "new") router.replace(`/design/${current.designId}`);
    toast.success(tCommon("state.saved"));
  }, [dieline, id, router, t, tCommon]);

  // Keyboard shortcuts. Deliberately skipped while a form control has focus, so typing "d"
  // in the name field does not duplicate an element.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;

      const current = useEditor.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) current.redo();
        else current.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        current.redo();
      } else if (mod && key === "s") {
        event.preventDefault();
        save();
      } else if (mod && key === "d" && current.selectedId) {
        event.preventDefault();
        current.duplicateElement(current.selectedId);
      } else if ((event.key === "Delete" || event.key === "Backspace") && current.selectedId) {
        event.preventDefault();
        current.removeElement(current.selectedId);
      } else if (event.key === "Escape") {
        current.select(null);
      } else if (event.key.startsWith("Arrow") && current.selectedId) {
        event.preventDefault();
        const element = current.content.elements.find((candidate) => candidate.id === current.selectedId);
        if (!element) return;
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        current.updateElement(element.id, { x: element.x + dx, y: element.y + dy });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // The browser's own unsaved-changes prompt, for a tab close we cannot intercept with a
  // dialog of our own.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const viewCenter = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !dieline) return { x: 0, y: 0 };
    const scale = stage.scaleX();
    return { x: (size.width / 2 - stage.x()) / scale, y: (size.height / 2 - stage.y()) / scale };
  }, [dieline, size]);

  const doExport = (kind: ExportKind) => {
    const stage = stageRef.current;
    if (!stage || !dieline) return;

    // Deselect first: the transformer handles would otherwise be baked into the bitmap.
    state.select(null);
    setTimeout(() => {
      if (kind === "svg") exportDielineSvg(dieline, name);
      else if (kind === "dxf") exportDielineDxf(dieline, name);
      else if (kind === "dieline-pdf") exportDielinePdf(dieline, name);
      else if (kind === "pdf") exportPdf(stage, dieline, name);
      else exportPng(stage, dieline, name, kind === "png-guides");
    }, 50);
  };

  const leave = () => router.push("/account/designs");

  if (!loaded) return null;

  const zoomPercent = Math.round(zoom * 100);

  return (
    <TooltipProvider>
      <div className="bg-canvas text-fg flex h-dvh flex-col">
        <header className="bg-neutral text-neutral-fg flex h-14 shrink-0 items-center gap-3 px-3">
          <Link href="/" aria-label={tCommon("nav.home")} className="flex items-center gap-2">
            <BrandMark size={30} />
          </Link>

          <input
            value={name}
            onChange={(event) => state.setName(event.target.value)}
            aria-label={t("nameLabel")}
            className="w-40 rounded-md bg-transparent px-2 py-1 text-sm font-medium hover:bg-current/10 focus:bg-current/10 sm:w-64"
          />
          {dirty ? <span className="hidden text-xs sm:inline">{tCommon("state.unsaved")}</span> : null}

          {/*
           * Hierarchy here comes from size and weight, never `opacity-*`. Opacity compounds onto
           * the whole subtree — a child cannot undo a parent's `opacity-80` — so it silently
           * turns a gated 7.25:1 token pair into 4.46:1. axe in the browser caught exactly that.
           */}
          <p className="ml-auto hidden text-xs md:block">
            {spec && dieline ? (
              <>
                {getStyle(spec.styleId).name[locale]} · {t("summary", { ...insideSize(spec) })} ·{" "}
                <b className="font-semibold">
                  {t("flatSheet", { width: dieline.width.toFixed(0), height: dieline.height.toFixed(0) })}
                </b>
              </>
            ) : null}
          </p>

          <div className="ml-auto flex items-center gap-1 md:ml-4">
            <Button size="sm" onClick={save} disabled={!spec} iconStart="save">
              {tCommon("actions.save")}
            </Button>

            <DropdownMenu
              label={t("exportMenu.label")}
              trigger={
                <Button size="sm" variant="ghost" disabled={!spec} iconStart="download">
                  {tCommon("actions.export")}
                </Button>
              }
              items={[
                {
                  id: "pdf",
                  label: t("exportMenu.pdf"),
                  description: t("exportMenu.pdfHint"),
                  onSelect: () => doExport("pdf"),
                },
                {
                  id: "png",
                  label: t("exportMenu.png"),
                  description: t("exportMenu.pngHint"),
                  onSelect: () => doExport("png"),
                },
                {
                  id: "png-guides",
                  label: t("exportMenu.pngGuides"),
                  description: t("exportMenu.pngGuidesHint"),
                  onSelect: () => doExport("png-guides"),
                },
                {
                  id: "svg",
                  label: t("exportMenu.svg"),
                  description: t("exportMenu.svgHint"),
                  onSelect: () => doExport("svg"),
                },
                {
                  id: "dxf",
                  label: t("exportMenu.dxf"),
                  description: t("exportMenu.dxfHint"),
                  onSelect: () => doExport("dxf"),
                },
                {
                  id: "dieline-pdf",
                  label: t("exportMenu.dielinePdf"),
                  description: t("exportMenu.dielinePdfHint"),
                  onSelect: () => doExport("dieline-pdf"),
                },
              ]}
            />

            <IconButton
              name="close"
              label={tCommon("actions.close")}
              size="sm"
              onClick={() => (dirty ? setLeaveOpen(true) : leave())}
            />
          </div>
        </header>

        <Toolbar
          center={viewCenter}
          onOpenSetup={() => setSetupOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
          patternOpen={patternOpen}
          onTogglePattern={() => setPatternOpen((open) => !open)}
        />

        <div className="flex min-h-0 flex-1">
          <div
            ref={wrapRef}
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{
              backgroundImage: "radial-gradient(var(--color-canvas-grid) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            {dieline && paperColour && size.width > 0 ? (
              <DesignCanvas
                dieline={dieline}
                paperColor={paperColour}
                stageRef={stageRef}
                width={size.width}
                height={size.height}
                fitSignal={fitSignal}
              />
            ) : null}

            {!spec && !setupOpen ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button size="lg" onClick={() => setSetupOpen(true)}>
                  {t("chooseBoxFirst")}
                </Button>
              </div>
            ) : null}
          </div>

          {spec ? (
            <aside
              aria-label={t("view.heading")}
              className="border-border bg-surface hidden w-72 shrink-0 overflow-y-auto border-s p-4 lg:block"
            >
              {selected ? <PropertiesPanel el={selected} /> : patternOpen ? <PatternPanel /> : <ViewPanel />}
              {selected && patternOpen ? (
                <div className="border-border mt-6 border-t pt-4">
                  <PatternPanel />
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>

        {/* Properties as a bottom sheet on phones: the canvas keeps the top of the screen. */}
        {spec && (selected || patternOpen) ? (
          <div className="border-border bg-surface max-h-[40vh] overflow-y-auto border-t p-4 lg:hidden">
            {selected ? <PropertiesPanel el={selected} /> : <PatternPanel />}
          </div>
        ) : null}

        <footer className="border-border bg-surface flex h-11 shrink-0 items-center justify-end gap-3 border-t px-3 text-sm">
          <div className="text-muted mr-auto hidden items-center gap-3 text-xs sm:flex">
            {paperName ? <span>{t("material", { name: paperName })}</span> : null}
            <span className="flex items-center gap-1">
              <i className="inline-block h-0.5 w-4" style={{ backgroundColor: CANVAS_COLORS.cut }} />
              {t("legend.cut")}
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CANVAS_COLORS.fold }} />
              {t("legend.fold")}
            </span>
          </div>

          <Button size="sm" variant="ghost" iconStart="fit" onClick={() => setFitSignal((signal) => signal + 1)}>
            {t("zoom.fit")}
          </Button>

          <Slider
            aria-label={t("zoom.label")}
            className="w-32 sm:w-48"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            value={[zoomPercent]}
            onValueChange={([percent]) => setZoom(percent / 100)}
            valueText={`${formatNumber(zoomPercent, locale)} %`}
          />

          <NumberInput
            aria-label={t("zoom.percentLabel")}
            unit="%"
            inputSize="sm"
            className="w-24"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            value={zoomPercent}
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
          />
        </footer>

        <SetupModal
          /*
           * No `key` to force a remount. BoxStudio used one to reset the form, but remounting
           * unmounts Radix's focus scope instead of letting it close, so focus never returns to
           * the button that opened the dialog (WCAG 2.4.3 — e2e/a11y.spec.ts asserts it).
           * SetupModal resets itself from `initial` instead.
           */
          open={setupOpen}
          initial={
            spec ??
            (seed
              ? {
                  specVersion: SPEC_VERSION,
                  styleId: seed.style,
                  values: { ...seed.dims },
                  material: papersFor(seed.style)[0].material,
                  materialId: papersFor(seed.style)[0].id,
                }
              : null)
          }
          hasContent={content.elements.length > 0}
          onClose={spec ? () => setSetupOpen(false) : leave}
          onConfirm={(nextSpec) => {
            state.setSpec(nextSpec);
            setSetupOpen(false);
            setFitSignal((signal) => signal + 1);
          }}
        />

        <PrintRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

        <AlertDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          tone="destructive"
          title={t("leaveConfirm.title")}
          description={t("leaveConfirm.body")}
          confirmLabel={t("leaveConfirm.confirm")}
          cancelLabel={tCommon("actions.cancel")}
          onConfirm={leave}
        />
      </div>
    </TooltipProvider>
  );
}

export { PX_PER_MM };
