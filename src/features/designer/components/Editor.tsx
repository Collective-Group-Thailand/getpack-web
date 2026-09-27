"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type Konva from "konva";
import { nanoid } from "nanoid";

import { getStyle, PX_PER_MM, SPEC_VERSION } from "@packio/dieline";
import { CANVAS_COLORS } from "@/features/designer/canvas-colors";
import { boardColour, fallbackMaterial, materialsFor, withMaterial } from "@/features/designer/catalog";
import { storeDesigns, type DesignerCatalog } from "@/features/designer/data/api";
import { usePersistence, type PersistenceConfig, type PersistenceMode } from "@/features/designer/data/persistence";
import { dielineOf, insideSize, readDesign, sizeOf } from "@/features/designer/document";
import {
  exportDielineDxf,
  exportDielinePdf,
  exportDielineSvg,
  exportPng,
  exportPrintPdf,
  makeThumbnail,
} from "@/features/designer/export";
import { designRepo } from "@/features/designer/storage";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/features/designer/store/editor";
import type { BoxDims, BoxStyleId, DesignContent, DesignSpec, ImageElement } from "@/features/designer/types";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
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
import { DesignerContext, type DesignerHandle } from "./DesignerContext";
import { VersionHistory } from "./VersionHistory";

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

/**
 * A box to start a new design from — the configurator's product, pattern, size and material
 * (F3 3.2, F4 C.2), an order line's box, or a template.
 */
export interface EditorSeed {
  style: BoxStyleId;
  dims: BoxDims;
  materialId?: string | null;
  patternId?: string | null;
  productSlug?: string | null;
}

/** A design the server already has, as the page read it. */
export interface InitialDesign {
  id: string;
  name: string;
  document: { spec: unknown; content: unknown };
  versionNo: number;
  etag: string | null;
  updatedAt: string;
  /** Signed URLs for the design's assets, to refresh image sources on open. */
  assets?: { id: string; url: string }[];
}

export interface EditorSession {
  mode: PersistenceMode;
  editable: boolean;
  design: InitialDesign | null;
  /** How a new store design is created: its source, product, order line, template. */
  create?: PersistenceConfig["create"];
}

/**
 * How the designer moves between pages. Each zone's wrapper supplies its own router: the
 * storefront's keeps `/en`, the back office's must not add it (its locale is a cookie).
 */
export interface EditorNav {
  home: string;
  push: (href: string) => void;
  replace: (href: string) => void;
}

export interface EditorProps {
  /** The route's id, or `new`. */
  id: string;
  nav: EditorNav;
  session: EditorSession;
  catalog: DesignerCatalog | null;
  seed?: EditorSeed;
  /** Where "close" goes: My designs for a customer, the order's prepress page for staff. */
  exitHref?: string;
  /** Beside the save state in the top bar — the customer's live price. */
  topBarExtra?: React.ReactNode;
  /** The top bar's primary action — "order this" for a customer, "make a copy" for staff. */
  primaryAction?: React.ReactNode;
  /** A route base for the design's own page, `/design` for the storefront. */
  designHref?: (id: string) => string;
}

/** Refreshes image sources from the assets' current signed URLs (they expire; ids do not). */
function withAssetUrls(content: DesignContent, assets: InitialDesign["assets"]): DesignContent {
  if (!assets?.length) return content;
  const urls = new Map(assets.map((a) => [a.id, a.url]));
  return {
    ...content,
    elements: content.elements.map((el) =>
      el.type === "image" && el.assetId && urls.has(el.assetId) ? { ...el, src: urls.get(el.assetId)! } : el,
    ),
  };
}

export default function Editor({
  id,
  nav,
  session,
  catalog,
  seed,
  exitHref = "/account/designs",
  topBarExtra,
  primaryAction,
  designHref = (designId) => `/design/${designId}`,
}: EditorProps) {
  const t = useTranslations("designer");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";

  const state = useEditor();
  const { spec, content, selectedId, zoom, setZoom, name, dirty } = state;
  const editable = session.editable;

  const stageRef = useRef<Konva.Stage | null>(null);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  const dieline = useMemo(() => (spec ? dielineOf(spec) : null), [spec]);

  const persistence = usePersistence({
    mode: session.mode,
    editable,
    serverId: session.design?.id ?? null,
    etag: session.design?.etag ?? null,
    versionNo: session.design?.versionNo ?? null,
    updatedAt: session.design?.updatedAt ?? null,
    create: session.create,
    onCreated: (designId) => {
      if (id !== designId) nav.replace(designHref(designId));
    },
    thumbnail: () => (stageRef.current && dieline ? makeThumbnail(stageRef.current, dieline) : null),
  });

  /*
   * Loading the design. Both setState calls below are part of that load, not a reaction to it:
   * a guest's design lives in localStorage, which cannot be read during render, and the editor
   * renders nothing until it arrives. That is the case `set-state-in-effect` cannot express, so
   * the two calls are exempted individually rather than the rule being downgraded repo-wide.
   */
  useEffect(() => {
    const editor = useEditor.getState();
    const fromServer = session.design
      ? readDesign(session.design.document.spec, session.design.document.content)
      : null;
    if (session.design && fromServer) {
      editor.load({
        id: session.design.id,
        name: session.design.name,
        spec: fromServer.spec,
        content: withAssetUrls(fromServer.content, session.design.assets),
      });
    } else {
      const local = session.mode === "local" && id !== "new" ? designRepo.get(id) : undefined;
      if (local) {
        editor.load({ id: local.id, name: local.name, spec: local.spec, content: local.content });
      } else {
        editor.load({ id: id === "new" ? nanoid(10) : id, name: t("untitled"), spec: null });
        // A design with no box opens straight into setup — there is nothing else to show.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (editable) setSetupOpen(true);
      }
    }
    setLoaded(true);
  }, [id, t, session, editable]);

  // Images placed in an account design are uploaded once as design assets; the document then
  // keeps the asset id and its signed URL instead of the whole picture.
  const uploading = useRef(new Set<string>());
  useEffect(() => {
    if (session.mode !== "store" || !editable) return;
    return useEditor.subscribe((s) => {
      const designId = persistence.serverId();
      if (!designId) return;
      for (const el of s.content.elements) {
        if (el.type !== "image" || el.assetId || !el.src.startsWith("data:") || uploading.current.has(el.id)) continue;
        uploading.current.add(el.id);
        const image = el as ImageElement;
        void (async () => {
          try {
            const blob = await (await fetch(image.src)).blob();
            const file = new File([blob], `image-${image.id}.${blob.type.split("/")[1] ?? "png"}`, { type: blob.type });
            const asset = await storeDesigns.attachAsset(designId, file, {
              widthPx: image.naturalWidth,
              heightPx: image.naturalHeight,
            });
            useEditor
              .getState()
              .updateElement(image.id, { src: asset.url, assetId: asset.id } as Partial<ImageElement>);
          } catch {
            // Left as a data URL: still saved with the document, just larger.
          } finally {
            uploading.current.delete(image.id);
          }
        })();
      }
    });
  }, [session.mode, editable, persistence]);

  const save = useCallback(async () => {
    if (!editable || !useEditor.getState().spec) return;
    if (!useEditor.getState().name.trim()) useEditor.getState().setName(t("unnamed"));
    const ok = await persistence.save("manual");
    if (ok) toast.success(tCommon("state.saved"));
    else if (session.mode === "local") toast.error(t("saveFailedStorageFull"));
  }, [editable, persistence, session.mode, t, tCommon]);

  // Keyboard shortcuts. Deliberately skipped while a form control has focus, so typing "d"
  // in the name field does not duplicate an element.
  useEffect(() => {
    if (!editable) return;
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
        void save();
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
  }, [save, editable]);

  // The browser's own unsaved-changes prompt, for a tab close we cannot intercept with a
  // dialog of our own. An account design's draft is in IndexedDB by then, but say so anyway.
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
      else if (kind === "pdf") void exportPrintPdf(stage, dieline, name, useEditor.getState().bleedMm);
      else exportPng(stage, dieline, name, kind === "png-guides");
    }, 50);
  };

  const leave = () => nav.push(exitHref);

  /** The setup dialog's starting point for a new design: the seed, with the catalogue's material. */
  const seedSpec = (): DesignSpec | null => {
    if (!seed) return null;
    const materials = materialsFor(catalog, seed.style, seed.patternId);
    const chosen = materials.find((m) => m.id === seed.materialId) ?? materials[0];
    return {
      specVersion: SPEC_VERSION,
      styleId: seed.style,
      values: { ...seed.dims },
      ...(chosen ? withMaterial(chosen, locale) : fallbackMaterial(seed.style)),
      patternId: seed.patternId ?? null,
    };
  };

  const handle: DesignerHandle = {
    stage: () => stageRef.current,
    dieline,
    save: persistence.save,
    serverId: persistence.serverId,
  };

  if (!loaded) return null;

  const zoomPercent = Math.round(zoom * 100);
  const paperColour = spec ? boardColour(spec) : null;
  const selected = editable ? content.elements.find((element) => element.id === selectedId) : undefined;
  const saveLabel = {
    saved: persistence.lastSavedAt
      ? t("saveState.savedAt", { time: formatDateTime(persistence.lastSavedAt, locale) })
      : null,
    dirty: tCommon("state.unsaved"),
    saving: t("saveState.saving"),
    offline: t("saveState.offline"),
    conflict: t("saveState.conflict"),
    error: t("saveState.error"),
    readonly: t("saveState.readonly"),
  }[session.mode === "local" ? (dirty ? "dirty" : "saved") : persistence.state];

  return (
    <DesignerContext.Provider value={handle}>
      <TooltipProvider>
        <div className="bg-canvas text-fg flex h-dvh flex-col">
          <header className="bg-neutral text-neutral-fg flex h-14 shrink-0 items-center gap-3 px-3">
            <NextLink href={nav.home} aria-label={tCommon("nav.home")} className="flex items-center gap-2">
              <BrandMark size={30} />
            </NextLink>

            <input
              value={name}
              readOnly={!editable}
              onChange={(event) => state.setName(event.target.value)}
              aria-label={t("nameLabel")}
              className="w-40 rounded-md bg-transparent px-2 py-1 text-sm font-medium hover:bg-current/10 focus:bg-current/10 sm:w-64"
            />
            {saveLabel ? (
              <span role="status" className="hidden text-xs sm:inline">
                {saveLabel}
              </span>
            ) : null}

            {/*
             * Hierarchy here comes from size and weight, never `opacity-*`. Opacity compounds onto
             * the whole subtree — a child cannot undo a parent's `opacity-80` — so it silently
             * turns a gated 7.25:1 token pair into 4.46:1. axe in the browser caught exactly that.
             */}
            <p className="ml-auto hidden text-xs md:block">
              {spec && dieline ? (
                <>
                  {getStyle(spec.styleId).name[locale]} ·{" "}
                  {sizeOf(spec).box
                    ? t("summary", { ...insideSize(spec) })
                    : t("summaryOther", { size: sizeOf(spec).text })}{" "}
                  ·{" "}
                  <b className="font-semibold">
                    {t("flatSheet", { width: dieline.width.toFixed(0), height: dieline.height.toFixed(0) })}
                  </b>
                </>
              ) : null}
            </p>

            <div className="ml-auto flex items-center gap-1 md:ml-4">
              {topBarExtra}
              {editable ? (
                <Button size="sm" onClick={() => void save()} disabled={!spec} iconStart="save">
                  {tCommon("actions.save")}
                </Button>
              ) : null}
              {session.mode === "store" && persistence.serverId() ? (
                <IconButton name="history" label={t("history.open")} size="sm" onClick={() => setHistoryOpen(true)} />
              ) : null}

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
              {primaryAction}

              <IconButton
                name="close"
                label={tCommon("actions.close")}
                size="sm"
                onClick={() => (dirty && session.mode === "local" ? setLeaveOpen(true) : leave())}
              />
            </div>
          </header>

          {editable ? (
            <Toolbar
              center={viewCenter}
              onOpenSetup={() => setSetupOpen(true)}
              onOpenRules={() => setRulesOpen(true)}
              patternOpen={patternOpen}
              onTogglePattern={() => setPatternOpen((open) => !open)}
            />
          ) : (
            <Callout tone="info" title={t("readOnly.title")} className="rounded-none border-x-0 border-t-0">
              {t("readOnly.body")}
            </Callout>
          )}

          {persistence.draftOffer ? (
            <Callout tone="warning" title={t("draft.title")} className="rounded-none border-x-0 border-t-0">
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={persistence.restoreDraft}>
                  {t("draft.restore")}
                </Button>
                <Button size="sm" variant="secondary" onClick={persistence.discardDraft}>
                  {t("draft.discard")}
                </Button>
              </div>
            </Callout>
          ) : null}

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
                  readOnly={!editable}
                />
              ) : null}

              {!spec && !setupOpen && editable ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button size="lg" onClick={() => setSetupOpen(true)}>
                    {t("chooseBoxFirst")}
                  </Button>
                </div>
              ) : null}
            </div>

            {spec && editable ? (
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
          {spec && editable && (selected || patternOpen) ? (
            <div className="border-border bg-surface max-h-[40vh] overflow-y-auto border-t p-4 lg:hidden">
              {selected ? <PropertiesPanel el={selected} /> : <PatternPanel />}
            </div>
          ) : null}

          <footer className="border-border bg-surface flex h-11 shrink-0 items-center justify-end gap-3 border-t px-3 text-sm">
            <div className="text-muted mr-auto hidden items-center gap-3 text-xs sm:flex">
              {spec?.materialName ? <span>{t("material", { name: spec.materialName })}</span> : null}
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

          {editable ? (
            <SetupModal
              /*
               * No `key` to force a remount. BoxStudio used one to reset the form, but remounting
               * unmounts Radix's focus scope instead of letting it close, so focus never returns to
               * the button that opened the dialog (WCAG 2.4.3 — e2e/a11y.spec.ts asserts it).
               * SetupModal resets itself from `initial` instead.
               */
              open={setupOpen}
              initial={spec ?? seedSpec()}
              catalog={catalog}
              hasContent={content.elements.length > 0}
              isNew={!spec}
              onClose={spec ? () => setSetupOpen(false) : leave}
              onConfirm={(nextSpec) => {
                state.setSpec(nextSpec);
                setSetupOpen(false);
                setFitSignal((signal) => signal + 1);
              }}
            />
          ) : null}

          <PrintRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

          {historyOpen && persistence.serverId() ? (
            <VersionHistory
              designId={persistence.serverId()!}
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              onRestore={async (versionNo) => {
                const ok = await persistence.restoreVersion(versionNo);
                if (ok) {
                  setHistoryOpen(false);
                  toast.success(t("history.restored", { version: versionNo }));
                }
              }}
            />
          ) : null}

          <Dialog
            open={persistence.state === "conflict"}
            onOpenChange={() => undefined}
            title={t("conflict.title")}
            description={t("conflict.body")}
            size="md"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button onClick={() => void persistence.resolveConflict("mine")}>{t("conflict.keepMine")}</Button>
              <Button variant="secondary" onClick={() => void persistence.resolveConflict("theirs")}>
                {t("conflict.takeTheirs")}
              </Button>
              {session.mode === "store" ? (
                <Button variant="ghost" onClick={() => void persistence.resolveConflict("copy")}>
                  {t("conflict.saveCopy")}
                </Button>
              ) : null}
            </div>
          </Dialog>

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
    </DesignerContext.Provider>
  );
}

export { PX_PER_MM };
