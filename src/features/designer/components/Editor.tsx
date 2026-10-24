"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import type Konva from "konva";
import { nanoid } from "nanoid";

import {
  allFaces,
  DEFAULT_SAFE_MM,
  faceBounds,
  getStyle,
  mirrorDieline,
  PX_PER_MM,
  SPEC_VERSION,
  type ParamValues,
} from "@getpack/dieline";
import { setActiveStage } from "@/features/designer/active-stage";
import { boardColour, fallbackMaterial, materialsFor, withMaterial } from "@/features/designer/catalog";
import { storeDesigns, type DesignerCatalog } from "@/features/designer/data/api";
import {
  usePersistence,
  type Persistence,
  type PersistenceConfig,
  type PersistenceMode,
} from "@/features/designer/data/persistence";
import { dielineOf, hingesOf, insideSize, readDesign, sizeOf } from "@/features/designer/document";
import { exportPng, exportPrintPdf, makeThumbnail, renderDieline } from "@/features/designer/export";
import { finishesIn, finishMask, type Finish } from "@/features/designer/lib/finishes";
import { uprightAngles } from "@/features/designer/lib/upright";
import { useFaceNames } from "@/features/designer/lib/useFaceNames";
import type { DesignIssue } from "@/features/designer/lib/checks";
import { softProofStyle, useCheckContext, useStudioRules } from "@/features/designer/data/rules";
import { fixContextFor, useDesignIssues } from "@/features/designer/lib/useIssues";
import { designRepo } from "@/features/designer/storage";
import { useEditor } from "@/features/designer/store/editor";
import type { BoxDims, BoxStyleId, DesignContent, DesignSpec, ImageElement } from "@/features/designer/types";
import { formatDateTime } from "@/i18n/format";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { useModKey } from "@/ui/components/CommandPalette";
import { ShortcutsOverlay, useShortcutsOverlayShortcut } from "@/ui/components/ShortcutsOverlay";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";
import { Tooltip, TooltipProvider } from "@/ui/components/Tooltip";
import { BrandLogo } from "@/ui/brand";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { PrintRulesModal } from "./PrintRulesModal";
import { SetupModal } from "./SetupModal";
import { DesignerContext, type DesignerHandle } from "./DesignerContext";
import { ChecksPanel } from "./panels/ChecksPanel";
import { FocusChip } from "./shell/FocusChip";
import { RAIL, RailPanel, SelectionPanel, type RailId } from "./shell/panels";
import { shortcutList, useEditorShortcuts } from "./shell/shortcuts";
import { StatusBar } from "./shell/StatusBar";
import { proofTerms } from "@/i18n/terms";

const DesignCanvas = dynamic(() => import("./DesignCanvas"), { ssr: false });
const Presentation = dynamic(() => import("./Presentation"), { ssr: false });
// Opened on demand: the history (with its compare view) and the view-only link.
const VersionHistory = dynamic(() => import("./VersionHistory").then((m) => m.VersionHistory), { ssr: false });
const ShareDialog = dynamic(() => import("./ShareDialog").then((m) => m.ShareDialog), { ssr: false });
// three.js loads only when the 3D tab opens.
const Preview3D = dynamic(() => import("./Preview3D"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-square w-full rounded-lg" />,
});

/**
 * Whether the visitor has done anything yet — moved the pointer, touched, typed or scrolled.
 *
 * The split view shows the model beside the canvas from the start, and ADR-0010 keeps three.js
 * (~250 KB) out of the first load: the split's model waits for this, which a person at the page
 * does within a moment and a page load alone never does.
 */
function useFirstInteraction(): boolean {
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (interacted) return;
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    const done = () => setInteracted(true);
    for (const event of events) window.addEventListener(event, done, { once: true, passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, done);
    };
  }, [interacted]);
  return interacted;
}

type SideTab = "properties" | "checks" | "preview";
type MobilePanel = RailId | SideTab;

/**
 * The artwork of each side as an image for the 3D preview: the side on the canvas is redrawn a
 * moment after each change while the 3D view is shown; the other side keeps its last drawing.
 * Level of detail: the sheet is drawn at the resolution the 3D view can show (2048 px on its long
 * side at most, 1024 for a small view), one texture for every face (the sheet is the atlas).
 */
function useArtwork(
  active: boolean,
  stage: () => Konva.Stage | null,
  dieline: DesignerHandle["dieline"],
  side: "outside" | "inside",
  longSidePx: number,
) {
  const [urls, setUrls] = useState<{
    outside: string | null;
    inside: string | null;
    finishes: Partial<Record<Finish, string>>;
  }>({ outside: null, inside: null, finishes: {} });
  useEffect(() => {
    if (!active || !dieline) return;
    let waits = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      const s = stage();
      // The canvas mounts a moment after the dieline exists; a first draw that found no stage
      // tried again only on the next edit, so the 3D box stayed blank (round 2, B6).
      if (!s) {
        if (waits++ < 40) retry = setTimeout(draw, 150);
        return;
      }
      const pxPerMm = longSidePx / Math.max(dieline.width, dieline.height);
      const url = renderDieline(s, dieline, { pxPerMm, withGuides: false, marginMm: 0 });
      // The outside's finishes as masks for the model (U4.4): the window's inverted (the board stays).
      const elements = useEditor.getState().content.elements;
      const finishes =
        side === "outside"
          ? Object.fromEntries(
              finishesIn(elements).map((f) => {
                const mask = finishMask(elements, f, dieline, Math.min(pxPerMm, 4));
                if (f === "window") {
                  const ctx = mask.getContext("2d")!;
                  ctx.globalCompositeOperation = "difference";
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, mask.width, mask.height);
                }
                return [f, mask.toDataURL("image/png")];
              }),
            )
          : null;
      setUrls((current) => ({ ...current, [side]: url, ...(finishes ? { finishes } : {}) }));
    };
    const first = setTimeout(draw, 50);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((next, prev) => {
      if (next.content === prev.content && next.spec === prev.spec) return;
      clearTimeout(timer);
      timer = setTimeout(draw, 700);
    });
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
      clearTimeout(retry);
      unsubscribe();
    };
  }, [active, stage, dieline, side, longSidePx]);
  return urls;
}

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
  /** The engine values that make a library variant (D-407): its closures, inserts, windows — the size still `dims`. */
  values?: ParamValues;
  /** The published variant the box is (D-407), priced and quoted as that variant. */
  variant?: { baseCode: string; styleVariantCode: string } | null;
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
  /** After each confirmed save — the zone's wrapper decides what, if anything, to record. */
  onSaved?: () => void;
  /** The studio's box fields and spec, saved with each version (U4.1, D-275). */
  box?: PersistenceConfig["box"];
  initialBox?: PersistenceConfig["initialBox"];
  /** An edit link (U4.7, mode `shared`). */
  shared?: PersistenceConfig["shared"];
}

/** What the studio's frame is handed: the editor's own actions and facts. */
export interface EditorChromeContext {
  persistence: Persistence;
  issues: DesignIssue[];
  /** Applies a finding's safe fix, as one undo step (U4.5). */
  fix: (issue: DesignIssue) => void;
  /** The outside's die, for the studio's order renders (U4.6; the canvas: `activeStage()`). */
  dieline: DesignerHandle["dieline"];
  openSetup: () => void;
  openRules: () => void;
}

/**
 * The studio's frame around the editor (U4.1): a bar under the header (the step bar), a panel in
 * place of the tool rail for the steps other than ③ (`null` keeps the rail), and the price dock —
 * a rail on wide screens, a bar on phones. The editor stays mounted whatever the step, so nothing
 * on the canvas is lost going back and forth.
 */
export interface EditorChrome {
  below?: (ctx: EditorChromeContext) => React.ReactNode;
  panel?: (ctx: EditorChromeContext) => React.ReactNode;
  dock?: (ctx: EditorChromeContext, layout: "rail" | "bar") => React.ReactNode;
  /** Which tools the rail offers (the print method configures the editor, U4.2); all when absent. */
  rail?: (id: RailId) => boolean;
  /** A note over the canvas — the print mode and its limits. */
  notice?: React.ReactNode;
  /** Open the setup dialog by itself when there is no box yet (the studio's ① offers its own ways). */
  autoSetup?: boolean;
  /**
   * A new design whose seed is complete (style and size, `?style=&l=&w=&h=`) starts with that box
   * instead of the setup dialog — the studio's "ลองเล่นกับแบบตัวอย่าง" and links that ask for the
   * design step (round 2, B6). The dialog stays one click away to change it.
   */
  applySeed?: boolean;
  /**
   * What fills the canvas before there is a box (the studio's start screen, UX audit) — in place of
   * the lone "choose a box" button. It is given the same context as the panels.
   */
  empty?: (ctx: EditorChromeContext) => React.ReactNode;
  /**
   * The studio's stage (U4.3): 3D and flat side by side (split, the default on wide screens),
   * either alone (3D first on phones), and the outside / inside of the board.
   */
  views?: boolean;
  /** Asked before switching to the inside — the studio shows the cost first; `false` stays outside. */
  onSide?: (side: "outside" | "inside") => boolean | Promise<boolean>;
  /** The studio's comments (U4.7), as a rail tool; the tool is offered only with it. */
  comments?: (ctx: EditorChromeContext) => React.ReactNode;
  /** More top-bar actions. */
  actions?: (ctx: EditorChromeContext) => React.ReactNode;
  /** Presentation mode with AR (U4.7): turntable, scenes, PNG / video, the box at real size. */
  presentation?: boolean;
  /** The studio's own share dialog (U4.7: links with a scope) in place of the view-only link. */
  share?: (designId: string, close: () => void) => React.ReactNode;
}

type StageView = "split" | "flat" | "3d";

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
  chrome?: EditorChrome;
}

/** Refreshes image sources from the assets' current signed URLs (they expire; ids do not). */
function withAssetUrls(content: DesignContent, assets: InitialDesign["assets"]): DesignContent {
  if (!assets?.length) return content;
  const urls = new Map(assets.map((a) => [a.id, a.url]));
  const wrap = content.pattern.image;
  return {
    ...content,
    pattern:
      wrap?.assetId && urls.has(wrap.assetId)
        ? { ...content.pattern, image: { ...wrap, src: urls.get(wrap.assetId)! } }
        : content.pattern,
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
  chrome,
}: EditorProps) {
  const t = useTranslations("designer");
  const tCommon = useTranslations("common");
  const tShortcuts = useTranslations("designer.shortcuts");
  const locale = useLocale() as "th" | "en";
  const mod = useModKey();

  const spec = useEditor((s) => s.spec);
  const name = useEditor((s) => s.name);
  const dirty = useEditor((s) => s.dirty);
  const hasContent = useEditor((s) => s.content.elements.length > 0 || s.content.pattern.kind !== "none");
  const elementCount = useEditor((s) => s.content.elements.length);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const editable = session.editable;

  const stageRef = useRef<Konva.Stage | null>(null);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  // The studio opens on the stage; its box has its own step (②).
  const [rail, setRail] = useState<RailId | null>(chrome?.views ? null : "box");
  const [sideTab, setSideTab] = useState<SideTab>("properties");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);

  const dieline = useMemo(() => (spec ? dielineOf(spec) : null), [spec]);
  const hinges = useMemo(() => (spec ? hingesOf(spec) : null), [spec]);
  const side = useEditor((s) => s.side);
  // The inside is drawn on the sheet as seen from inside (U4.3); faces keep their ids.
  const canvasDieline = useMemo(
    () => (dieline && side === "inside" ? mirrorDieline(dieline) : dieline),
    [dieline, side],
  );
  const upright = useMemo(
    () => (dieline && hinges && side === "outside" ? uprightAngles(dieline, hinges) : {}),
    [dieline, hinges, side],
  );
  const faceNames = useFaceNames(dieline);
  const focusedFaceId = useEditor((s) => s.focusedFaceId);
  const [view, setView] = useState<StageView>(() =>
    !chrome?.views
      ? "flat"
      : typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches
        ? "split"
        : "3d",
  );
  const checkContext = useCheckContext(spec, session.mode);
  // Soft proof (U4.5, D-279): the substrate's simplified transform, when Prepress has set one.
  const rulesQuery = useStudioRules(session.mode !== "admin");
  const proofProfile =
    (chrome?.views &&
      spec &&
      rulesQuery.data?.softProof.profiles.find((p) => p.materialClass === spec.material.kind)) ||
    null;
  const [softProof, setSoftProof] = useState(false);
  const proofStyle = softProof ? softProofStyle(proofProfile) : {};
  const issues = useDesignIssues(dieline, catalog, checkContext);

  const persistence = usePersistence({
    mode: session.mode,
    editable,
    serverId: session.design?.id ?? null,
    etag: session.design?.etag ?? null,
    versionNo: session.design?.versionNo ?? null,
    updatedAt: session.design?.updatedAt ?? null,
    create: session.create,
    onCreated: (designId) => {
      if (id === designId) return;
      // A guest's design is autosaved from its first change, often mid-typing: a navigation would
      // remount the editor and drop what was typed meanwhile, so only the address bar changes.
      if (session.mode === "local")
        window.history.replaceState(window.history.state, "", getPathname({ href: designHref(designId), locale }));
      else nav.replace(designHref(designId));
    },
    onSaved: session.onSaved,
    box: session.box,
    initialBox: session.initialBox,
    ...(session.shared ? { shared: session.shared } : {}),
    thumbnail: () =>
      stageRef.current && dieline && useEditor.getState().side === "outside"
        ? makeThumbnail(stageRef.current, dieline)
        : null,
  });

  /** The setup dialog's starting point for a new design: the seed, with the catalogue's material. */
  const seedSpec = (): DesignSpec | null => {
    if (!seed) return null;
    const materials = materialsFor(catalog, seed.style, seed.patternId);
    const chosen = materials.find((m) => m.id === seed.materialId) ?? materials[0];
    return {
      specVersion: SPEC_VERSION,
      styleId: seed.style,
      values: { ...seed.values, ...seed.dims },
      ...(chosen ? withMaterial(chosen, locale) : fallbackMaterial(seed.style)),
      patternId: seed.patternId ?? null,
      ...(seed.variant ? { studio: { ...seed.variant } } : {}),
    };
  };

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
        const seeded = editable && chrome?.applySeed ? seedSpec() : null;
        if (seeded) {
          editor.setSpec(seeded);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFitSignal((signal) => signal + 1);
        }
        // A design with no box opens straight into setup — there is nothing else to show.
        else if (editable && chrome?.autoSetup !== false) setSetupOpen(true);
      }
    }
    setLoaded(true);
    // The frame's wish is read once, when the design loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t, session, editable]);

  // Images placed in an account design are uploaded once as design assets; the document then
  // keeps the asset id and its signed URL instead of the whole picture.
  const uploading = useRef(new Set<string>());
  useEffect(() => {
    if (session.mode !== "store" || !editable) return;
    return useEditor.subscribe((s) => {
      const designId = persistence.serverId();
      if (!designId) return;
      // The full-wrap background picture (U4.4) is a design asset too.
      const wrap = s.content.pattern.image;
      if (wrap && !wrap.assetId && wrap.src.startsWith("data:") && !uploading.current.has("pattern")) {
        uploading.current.add("pattern");
        void (async () => {
          try {
            const blob = await (await fetch(wrap.src)).blob();
            const file = new File([blob], `background.${blob.type.split("/")[1] ?? "png"}`, { type: blob.type });
            const asset = await storeDesigns.attachAsset(designId, file);
            const now = useEditor.getState().content.pattern.image;
            if (now?.src === wrap.src)
              useEditor.getState().setPattern({ image: { ...now, src: asset.url, assetId: asset.id } });
          } catch {
            // Left as a data URL: saved with the document.
          } finally {
            uploading.current.delete("pattern");
          }
        })();
      }
      for (const el of s.content.elements) {
        if (el.type !== "image" || el.assetId || !el.src.startsWith("data:") || uploading.current.has(el.id)) continue;
        uploading.current.add(el.id);
        const image = el as ImageElement;
        void (async () => {
          try {
            const blob = await (await fetch(image.src)).blob();
            const file = new File([blob], `image-${image.id}.${blob.type.split("/")[1] ?? "png"}`, { type: blob.type });
            const asset = await storeDesigns.attachAsset(designId, file);
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

  useEditorShortcuts({ editable, save: () => void save() });
  useShortcutsOverlayShortcut(() => setShortcutsOpen(true));

  // A new selection brings its properties forward (on phones, the panel opens).
  useEffect(
    () =>
      useEditor.subscribe((next, prev) => {
        if (next.selectedId && next.selectedId !== prev.selectedId) {
          setSideTab("properties");
          // Phones only: on a wide screen the side panel shows it, and the hidden phone panel
          // would mount a second copy of the properties.
          if (!window.matchMedia("(min-width: 64rem)").matches) {
            setMobilePanel((open) => (open === null || open === "properties" ? "properties" : open));
          }
        }
      }),
    [],
  );

  // No `beforeunload` prompt: every design autosaves a moment after each change — a guest's in this
  // browser, an account's to the server with an IndexedDB draft meanwhile — and the bar says when
  // (UX audit, studio: the browser's dialog also stalled automation). Leaving from the studio's own
  // button still asks while a save is pending.

  /** Where a new element goes: the middle of the focused face, or of the view. */
  const viewCenter = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !canvasDieline) return { x: 0, y: 0 };
    const focused = useEditor.getState().focusedFaceId;
    const face = focused ? allFaces(canvasDieline).find((f) => f.id === focused) : undefined;
    if (face) {
      const b = faceBounds(face);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    const world = stage.findOne(".world");
    if (world)
      return world
        .getAbsoluteTransform()
        .copy()
        .invert()
        .point({ x: size.width / 2, y: size.height / 2 });
    const scale = stage.scaleX();
    return { x: (size.width / 2 - stage.x()) / scale, y: (size.height / 2 - stage.y()) / scale };
  }, [canvasDieline, size]);

  const doExport = (kind: ExportKind) => {
    const stage = stageRef.current;
    if (!stage || !dieline) return;

    // Deselect first: the transformer handles would otherwise be baked into the bitmap. The files
    // are the outside's: the canvas turns back to it before drawing (U4.3).
    useEditor.getState().select(null);
    if (useEditor.getState().side === "inside") useEditor.getState().setSide("outside");
    setTimeout(() => {
      // The die's file writers load with the first die export, not with the editor.
      if (kind === "svg" || kind === "dxf" || kind === "dieline-pdf")
        void import("@/features/designer/export-files").then((files) =>
          kind === "svg"
            ? files.exportDielineSvg(dieline, name)
            : kind === "dxf"
              ? files.exportDielineDxf(dieline, name)
              : files.exportDielinePdf(dieline, name),
        );
      else if (kind === "pdf") void exportPrintPdf(stage, dieline, name, useEditor.getState().bleedMm);
      else exportPng(stage, dieline, name, kind === "png-guides");
    }, 150);
  };

  const leave = () => nav.push(exitHref);

  const stage = useCallback(() => stageRef.current, []);
  useEffect(() => {
    setActiveStage(stage);
    return () => setActiveStage(null);
  }, [stage]);
  const interacted = useFirstInteraction();
  const show3d = chrome?.views
    ? view === "3d" || (view === "split" && interacted)
    : sideTab === "preview" || mobilePanel === "preview";
  const artworks = useArtwork(show3d || presenting, stage, canvasDieline, side, view === "split" ? 1024 : 2048);
  const artwork = artworks.outside;
  const finishMasks = artworks.finishes;

  const switchSide = async (next: "outside" | "inside") => {
    if (next === side) return;
    if (chrome?.onSide && !(await chrome.onSide(next))) return;
    useEditor.getState().setSide(next);
    setFitSignal((signal) => signal + 1);
  };

  const handle: DesignerHandle = {
    stage,
    dieline: canvasDieline,
    save: persistence.save,
    serverId: persistence.serverId,
    center: viewCenter,
    catalog,
    mode: session.mode,
  };

  if (!loaded) return null;

  const paperColour = spec ? boardColour(spec) : null;
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
  }[persistence.state];

  const openSetup = () => setSetupOpen(true);
  const openRules = () => setRulesOpen(true);
  const showChecks = () => {
    setSideTab("checks");
    if (!window.matchMedia("(min-width: 64rem)").matches) setMobilePanel("checks");
  };
  const errors = issues.filter((i) => i.severity === "block").length;
  const fix = (issue: DesignIssue) => {
    if (!dieline) return;
    const editor = useEditor.getState();
    const target = editor.content.elements.find((e) => e.id === issue.elementId);
    const ctx = fixContextFor(dieline, catalog, checkContext, target?.side === "inside" ? "inside" : "outside");
    // The fixes load on first use: most sessions never need one.
    void import("@/features/designer/lib/fixes").then(({ applyFix }) =>
      useEditor.getState().commit((content) => applyFix(content, issue, ctx)),
    );
  };
  const chromeContext: EditorChromeContext = {
    persistence,
    issues,
    fix,
    openSetup,
    openRules,
    dieline,
  };
  const stepPanel = chrome?.panel?.(chromeContext) ?? null;
  // Before a box (the "StudioStart" board): the start screen is the whole page — no rail, stage,
  // step bar or status bar; the stage stays mounted, out of sight, so it measures itself in time.
  // It stays under the setup dialog too, so closing the dialog returns focus to the card that
  // opened it (WCAG 2.4.3).
  const starting = !spec && editable && Boolean(chrome?.empty);
  const railTools = RAIL.filter((item) =>
    item.id === "comments" ? !!chrome?.comments : (chrome?.rail?.(item.id) ?? true),
  );

  const preview =
    dieline && paperColour && spec ? (
      <Preview3D
        dieline={dieline}
        hinges={hinges}
        artwork={artwork}
        boardColour={paperColour}
        material={spec.material}
        name={name}
        labels={{
          canvas: t("preview3d.canvas", { name }),
          fold: t("preview3d.fold"),
          play: t("preview3d.play"),
          rotateLeft: t("preview3d.rotateLeft"),
          rotateRight: t("preview3d.rotateRight"),
          tiltUp: t("preview3d.tiltUp"),
          tiltDown: t("preview3d.tiltDown"),
          reset: t("preview3d.reset"),
          lighting: t("preview3d.lighting"),
          lightingPreset: {
            studio: t("preview3d.preset.studio"),
            daylight: t("preview3d.preset.daylight"),
            warm: t("preview3d.preset.warm"),
          },
          exportPng: t("preview3d.exportPng"),
          flat: t("preview3d.flat"),
        }}
        {...(chrome?.views
          ? {
              fill: true,
              // The small floating card below 1280 shows the box alone; "3 มิติ" has the controls.
              controlsClassName: view === "split" ? "max-xl:hidden" : undefined,
              insideArtwork: artworks.inside,
              finishMasks,
              faceLabels: Object.fromEntries(faceNames),
              focusedFaceId,
              pickLabel: t("stage.pick"),
              onPickFace: (faceId: string | null) => useEditor.getState().focusFace(faceId),
            }
          : {})}
      />
    ) : null;

  const selectionEmpty = <p className="text-muted text-sm">{t("selection.empty")}</p>;
  const checksLabel = issues.length ? t("side.checksCount", { count: issues.length }) : t("side.checks");
  const sidePanel = (tab: SideTab) =>
    tab === "properties" ? (
      <SelectionPanel empty={selectionEmpty} />
    ) : tab === "checks" ? (
      <ChecksPanel issues={issues} onFix={fix} />
    ) : (
      preview
    );

  return (
    <DesignerContext.Provider value={handle}>
      <TooltipProvider>
        <div className="bg-canvas text-fg flex h-dvh flex-col">
          <header className="bg-neutral text-neutral-fg flex h-14 shrink-0 items-center gap-2 px-3">
            <NextLink href={nav.home} aria-label={tCommon("nav.home")} className="flex shrink-0 items-center gap-2">
              <BrandLogo height={22} tone="mono" />
            </NextLink>

            <input
              value={name}
              readOnly={!editable}
              onChange={(event) => useEditor.getState().setName(event.target.value)}
              aria-label={t("nameLabel")}
              className="w-32 min-w-0 rounded-md bg-transparent px-2 py-1 text-sm font-medium hover:bg-current/10 focus:bg-current/10 sm:w-56"
            />
            {saveLabel ? (
              <span role="status" className="hidden text-xs whitespace-nowrap sm:inline">
                {saveLabel}
              </span>
            ) : null}

            {editable && !starting ? (
              <div className="ms-2 hidden items-center gap-0.5 md:flex" role="group" aria-label={t("toolbar.label")}>
                <IconButton
                  name="undo"
                  label={t("toolbar.undo")}
                  size="sm"
                  variant="ghost"
                  disabled={!canUndo}
                  onClick={() => useEditor.getState().undo()}
                />
                <IconButton
                  name="redo"
                  label={t("toolbar.redo")}
                  size="sm"
                  variant="ghost"
                  disabled={!canRedo}
                  onClick={() => useEditor.getState().redo()}
                />
                <IconButton
                  name="reset"
                  label={t("toolbar.resetAll")}
                  size="sm"
                  variant="ghost"
                  disabled={!hasContent}
                  onClick={() => setResetOpen(true)}
                />
              </div>
            ) : null}

            {/*
             * Hierarchy here comes from size and weight, never `opacity-*`. Opacity compounds onto
             * the whole subtree — a child cannot undo a parent's `opacity-80` — so it silently
             * turns a gated 7.25:1 token pair into 4.46:1. axe in the browser caught exactly that.
             */}
            <p className="ms-auto hidden truncate text-xs xl:block">
              {spec ? (
                <>
                  {getStyle(spec.styleId).name[locale]} ·{" "}
                  {sizeOf(spec).box
                    ? t("summary", { ...insideSize(spec) })
                    : t("summaryOther", { size: sizeOf(spec).text })}
                </>
              ) : null}
            </p>

            <div className="ms-auto flex items-center gap-1 xl:ms-4">
              {topBarExtra}
              {chrome?.actions?.(chromeContext)}
              {chrome?.presentation && spec ? (
                <IconButton name="eye" label={t("present.launch")} size="sm" onClick={() => setPresenting(true)} />
              ) : null}
              {starting ? (
                <span className="me-2 hidden text-xs sm:inline">{t("autosaveOnStart")}</span>
              ) : editable ? (
                <Button size="sm" onClick={() => void save()} disabled={!spec} iconStart="save">
                  {tCommon("actions.save")}
                </Button>
              ) : null}
              {session.mode === "store" && persistence.serverId() ? (
                <>
                  <IconButton name="history" label={t("history.open")} size="sm" onClick={() => setHistoryOpen(true)} />
                  <IconButton
                    name="link"
                    label={chrome?.share ? t("share.openStudio") : t("share.open")}
                    size="sm"
                    onClick={() => setShareOpen(true)}
                  />
                </>
              ) : null}

              {starting ? null : (
                <DropdownMenu
                  label={t("exportMenu.label")}
                  trigger={
                    <Button size="sm" variant="ghost" disabled={!spec} iconStart="download">
                      <span className="hidden sm:inline">{tCommon("actions.export")}</span>
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
              )}
              {primaryAction}

              <IconButton
                name="close"
                label={tCommon("actions.close")}
                size="sm"
                onClick={() => (dirty && session.mode === "local" ? setLeaveOpen(true) : leave())}
              />
            </div>
          </header>

          {!editable ? (
            <Callout tone="info" title={t("readOnly.title")} className="rounded-none border-x-0 border-t-0">
              {t("readOnly.body")}
            </Callout>
          ) : null}

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

          {starting ? null : chrome?.below?.(chromeContext)}

          {starting ? <div className="min-h-0 flex-1 overflow-y-auto">{chrome!.empty!(chromeContext)}</div> : null}

          {/* One step panel: beside the stage on wide screens, under it on phones (CSS order). */}
          <div className={cn("flex min-h-0 flex-1", stepPanel && "flex-col lg:flex-row", starting && "hidden")}>
            {stepPanel ? (
              <section
                aria-label={t("rail.label")}
                className="border-border bg-surface order-last max-h-[45dvh] w-full shrink-0 overflow-y-auto border-t p-4 lg:order-first lg:max-h-none lg:w-80 lg:border-e lg:border-t-0"
              >
                {stepPanel}
              </section>
            ) : spec && editable ? (
              <>
                <nav
                  aria-label={t("rail.label")}
                  className="border-border bg-surface hidden w-20 shrink-0 flex-col gap-1 overflow-y-auto border-e p-1.5 lg:flex"
                >
                  {railTools.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={rail === item.id}
                      aria-controls={rail === item.id ? "designer-rail-panel" : undefined}
                      onClick={() => setRail((open) => (open === item.id ? null : item.id))}
                      className={cn(
                        "focus-visible:ring-focus-ring flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] outline-none focus-visible:ring-2",
                        "duration-fast ease-standard transition-colors",
                        rail === item.id
                          ? "bg-primary-subtle text-primary-subtle-fg"
                          : "text-fg hover:bg-surface-subtle",
                      )}
                    >
                      <Icon name={item.icon} size={20} aria-hidden="true" />
                      <span className="text-center leading-tight">{t(`rail.${item.id}`)}</span>
                    </button>
                  ))}
                </nav>
                {rail && railTools.some((item) => item.id === rail) ? (
                  <section
                    id="designer-rail-panel"
                    aria-label={t(`rail.${rail}`)}
                    className="border-border bg-surface hidden w-72 shrink-0 overflow-y-auto border-e p-4 lg:block"
                  >
                    <h2 className="mb-3 font-semibold">{t(`rail.${rail}`)}</h2>
                    <RailPanel
                      id={rail}
                      onOpenSetup={openSetup}
                      onOpenRules={openRules}
                      comments={chrome?.comments?.(chromeContext)}
                    />
                  </section>
                ) : null}
              </>
            ) : null}

            <div className="relative flex min-w-0 flex-1 flex-col">
              <div
                className="relative flex min-h-0 flex-1"
                style={proofStyle.filter ? { filter: proofStyle.filter } : undefined}
              >
                {proofStyle.overlay ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 mix-blend-multiply"
                    style={{ background: proofStyle.overlay.background, opacity: proofStyle.overlay.opacity }}
                  />
                ) : null}
                <div
                  ref={wrapRef}
                  className={cn(
                    "pk-dot-grid relative min-w-0 flex-1 overflow-hidden",
                    // In 3D only the flat canvas stays mounted (it draws the 3D's artwork), out of sight.
                    view === "3d" && "pointer-events-none invisible absolute inset-0",
                  )}
                  aria-hidden={view === "3d" || undefined}
                >
                  {dieline && paperColour && size.width > 0 ? (
                    <DesignCanvas
                      dieline={canvasDieline!}
                      paperColor={paperColour}
                      stageRef={stageRef}
                      width={size.width}
                      height={size.height}
                      fitSignal={fitSignal}
                      readOnly={!editable}
                      upright={upright}
                      safeMm={catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM}
                    />
                  ) : null}
                  {canvasDieline ? <FocusChip dieline={canvasDieline} /> : null}
                  {chrome?.notice ? (
                    <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
                      {/* Notices wrap inside the stage: a long one (a locked version's) was clipped at both edges. */}
                      <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-2 [&>*]:max-w-full [&>*]:text-center [&>*]:whitespace-normal">
                        {chrome.notice}
                      </div>
                    </div>
                  ) : null}

                  {!spec && !setupOpen && editable && !chrome?.empty ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button size="lg" onClick={openSetup}>
                        {t("chooseBoxFirst")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                {chrome?.views && view !== "flat" && spec ? (
                  <section
                    aria-label={t("stage.model")}
                    className={cn(
                      "bg-surface flex min-h-0 flex-col p-2",
                      // Below 1280 the split's 3D floats as a card over the canvas, so an open tool
                      // panel never squeezes the artwork (the "StudioEditor" board's responsive note).
                      view === "split"
                        ? // Small enough that the artwork stays visible beside it when a tool panel
                          // narrows the canvas (a 256 px card covered most of a 370 px canvas).
                          "border-border shadow-overlay absolute end-3 bottom-3 z-20 max-h-[40%] w-40 overflow-y-auto rounded-2xl border lg:w-52 xl:static xl:max-h-none xl:w-[42%] xl:shrink-0 xl:overflow-visible xl:rounded-none xl:border-0 xl:border-s xl:shadow-none"
                        : "flex-1",
                    )}
                  >
                    {show3d ? preview : <Skeleton className="aspect-square w-full rounded-lg" />}
                  </section>
                ) : null}
              </div>
              {chrome?.views && spec ? (
                <div
                  role="toolbar"
                  aria-label={t("stage.label")}
                  className="border-border bg-surface flex flex-wrap items-center gap-2 border-t px-2 py-1"
                >
                  <SegmentedControl
                    label={t("stage.mode")}
                    size="sm"
                    value={view}
                    onValueChange={(next) => setView(next as StageView)}
                    options={(["split", "flat", "3d"] as const).map((value) => ({ value, label: t(`stage.${value}`) }))}
                  />
                  <SegmentedControl
                    label={t("stage.side")}
                    size="sm"
                    value={side}
                    onValueChange={(next) => void switchSide(next as "outside" | "inside")}
                    options={(["outside", "inside"] as const).map((value) => ({ value, label: t(`stage.${value}`) }))}
                  />
                  {proofProfile ? (
                    <Switch
                      label={t("stage.softProof")}
                      checked={softProof}
                      onCheckedChange={setSoftProof}
                      className="text-xs"
                    />
                  ) : null}
                  {softProof && proofProfile ? (
                    <span className="text-muted text-xs" role="status">
                      {proofTerms(
                        locale === "en" ? rulesQuery.data!.softProof.label.en : rulesQuery.data!.softProof.label.th,
                        "customer",
                      )}
                      {proofProfile.label ? ` · ${proofProfile.label}` : null}
                    </span>
                  ) : null}
                  {focusedFaceId && faceNames.get(focusedFaceId) ? (
                    // The canvas's focus chip announces it; this repeats it beside the views, quietly.
                    <span aria-hidden="true" className="text-xs">
                      {t("stage.editing", { face: faceNames.get(focusedFaceId)! })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {spec ? (
              <aside
                aria-label={t("side.label")}
                className="border-border bg-surface hidden w-80 shrink-0 overflow-y-auto border-s px-4 pb-4 lg:block"
              >
                {chrome?.dock ? (
                  <div className="border-border -mx-4 mb-2 border-b px-4 py-4">
                    {chrome.dock(chromeContext, "rail")}
                  </div>
                ) : null}
                <Tabs
                  label={t("side.label")}
                  value={sideTab}
                  onValueChange={(value) => setSideTab(value as SideTab)}
                  items={[
                    ...(editable
                      ? [{ value: "properties", label: t("side.properties"), content: sidePanel("properties") }]
                      : []),
                    { value: "checks", label: checksLabel, content: sidePanel("checks") },
                    ...(chrome?.views
                      ? []
                      : [
                          {
                            value: "preview",
                            label: t("side.preview"),
                            content: sideTab === "preview" ? preview : null,
                          },
                        ]),
                  ]}
                />
              </aside>
            ) : null}
          </div>

          {/* Phones: the tools as a bottom bar; a tool's panel opens above it, the canvas stays in view. */}
          {spec && mobilePanel ? (
            <section
              aria-label={
                mobilePanel in RAIL_LABELS
                  ? t(`rail.${mobilePanel}`)
                  : t(`side.${mobilePanel === "checks" ? "checks" : mobilePanel}`)
              }
              className="border-border bg-surface max-h-[45dvh] overflow-y-auto border-t p-4 lg:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">
                  {mobilePanel in RAIL_LABELS
                    ? t(`rail.${mobilePanel}`)
                    : mobilePanel === "checks"
                      ? checksLabel
                      : t(`side.${mobilePanel}`)}
                </h2>
                <IconButton
                  name="close"
                  label={tCommon("actions.close")}
                  size="sm"
                  variant="ghost"
                  onClick={() => setMobilePanel(null)}
                />
              </div>
              {mobilePanel in RAIL_LABELS ? (
                <RailPanel
                  id={mobilePanel as RailId}
                  onOpenSetup={openSetup}
                  onOpenRules={openRules}
                  comments={chrome?.comments?.(chromeContext)}
                />
              ) : (
                sidePanel(mobilePanel as SideTab)
              )}
            </section>
          ) : null}
          {chrome?.dock && !starting ? (
            <div className="border-border bg-surface shrink-0 border-t px-3 py-2 lg:hidden">
              {chrome.dock(chromeContext, "bar")}
            </div>
          ) : null}
          {spec && !stepPanel ? (
            <nav
              aria-label={t("rail.label")}
              className="border-border bg-surface flex shrink-0 gap-1 overflow-x-auto border-t px-1 py-1 lg:hidden"
            >
              {[
                ...(editable
                  ? railTools.map((item) => ({
                      id: item.id as MobilePanel,
                      icon: item.icon,
                      label: t(`rail.${item.id}`),
                    }))
                  : []),
                ...(editable
                  ? [{ id: "properties" as MobilePanel, icon: "edit" as const, label: t("side.properties") }]
                  : []),
                {
                  id: "checks" as MobilePanel,
                  icon: (errors ? "error" : issues.length ? "warning" : "check") as "check",
                  label: checksLabel,
                },
                { id: "preview" as MobilePanel, icon: "box" as const, label: t("side.preview") },
              ].map((item) => (
                <Tooltip key={item.id} content={item.label}>
                  <button
                    type="button"
                    aria-pressed={mobilePanel === item.id}
                    onClick={() => setMobilePanel((open) => (open === item.id ? null : item.id))}
                    className={cn(
                      "flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px]",
                      mobilePanel === item.id
                        ? "bg-primary-subtle text-primary-subtle-fg"
                        : "text-fg hover:bg-surface-subtle",
                    )}
                  >
                    <Icon name={item.icon} size={20} aria-hidden="true" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                </Tooltip>
              ))}
            </nav>
          ) : null}

          {starting ? null : (
            <StatusBar
              dieline={canvasDieline}
              issues={issues}
              onShowChecks={showChecks}
              onFit={() => setFitSignal((signal) => signal + 1)}
              onShortcuts={() => setShortcutsOpen(true)}
            />
          )}

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
              hasContent={elementCount > 0}
              isNew={!spec}
              onClose={spec ? () => setSetupOpen(false) : leave}
              onConfirm={(nextSpec) => {
                useEditor.getState().setSpec(nextSpec);
                setSetupOpen(false);
                setFitSignal((signal) => signal + 1);
              }}
            />
          ) : null}

          <PrintRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

          <ShortcutsOverlay
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
            title={tShortcuts("title")}
            closeLabel={tCommon("actions.close")}
            shortcuts={shortcutList((key) => tShortcuts(key), mod)}
          />

          {historyOpen && persistence.serverId() ? (
            <VersionHistory
              designId={persistence.serverId()!}
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              onName={async (label) => {
                const ok = await persistence.save("manual", label);
                if (ok) toast.success(t("history.named", { label }));
                return ok;
              }}
              onRestore={async (versionNo) => {
                const ok = await persistence.restoreVersion(versionNo);
                if (ok) {
                  setHistoryOpen(false);
                  toast.success(t("history.restored", { version: versionNo }));
                }
              }}
            />
          ) : null}

          {presenting && dieline && spec && paperColour ? (
            <Presentation
              dieline={dieline}
              hinges={hinges}
              material={spec.material}
              artwork={artwork}
              insideArtwork={artworks.inside}
              finishMasks={finishMasks}
              boardColour={paperColour}
              name={name}
              onClose={() => setPresenting(false)}
              onDownloadDieline={() => doExport("dieline-pdf")}
            />
          ) : null}

          {shareOpen && persistence.serverId() ? (
            chrome?.share ? (
              chrome.share(persistence.serverId()!, () => setShareOpen(false))
            ) : (
              <ShareDialog designId={persistence.serverId()!} open={shareOpen} onClose={() => setShareOpen(false)} />
            )
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
            open={resetOpen}
            onOpenChange={setResetOpen}
            tone="destructive"
            title={t("resetAllConfirm.title")}
            description={t("resetAllConfirm.body")}
            confirmLabel={t("resetAllConfirm.confirm")}
            cancelLabel={tCommon("actions.cancel")}
            onConfirm={() => {
              useEditor.getState().resetAll();
              setResetOpen(false);
            }}
          />

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

const RAIL_LABELS = Object.fromEntries(RAIL.map((item) => [item.id, true]));

export { PX_PER_MM };
