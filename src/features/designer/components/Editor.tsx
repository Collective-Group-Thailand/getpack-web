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
import { takeHandoff } from "@/features/designer/handoff";
import { newImageFromSrc, newText } from "@/features/designer/lib/create";
import { finishesIn, finishMask, type Finish } from "@/features/designer/lib/finishes";
import { uprightAngles } from "@/features/designer/lib/upright";
import { useFaceNames } from "@/features/designer/lib/useFaceNames";
import type { DesignIssue } from "@/features/designer/lib/checks";
import { softProofStyle, useCheckContext, useStudioRules } from "@/features/designer/data/rules";
import { fixContextFor, useDesignIssues } from "@/features/designer/lib/useIssues";
import { designRepo } from "@/features/designer/storage";
import { useEditor } from "@/features/designer/store/editor";
import { useCommentPins } from "@/features/designer/comments/pins";
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
import { ThemeToggle } from "@/ui/theme/ThemeToggle";
import { trackEditor } from "@/lib/analytics/editor";
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
import {
  overlaysFor,
  TOOL_KEYS,
  useEditorMode,
  type EditorMode,
  type EditorTool,
} from "@/features/designer/store/mode";
import { ColoursPanel } from "./panels/ColoursPanel";
import { EasyInspector } from "./studio-shell/EasyInspector";
import { PrintViewMenu } from "./studio-shell/PrintViewMenu";
import { ProInspector } from "./studio-shell/ProInspector";
import { AssetPanel, Inspector, Rail, StudioFrame, TopBar, type RailItem } from "./studio-shell/StudioFrame";
import { StudioStatusBar } from "./studio-shell/StudioStatusBar";
import { Toolbox } from "./studio-shell/Toolbox";
import { ModeSwitch, StepNav, type ShellStep } from "./studio-shell/TopBarParts";
import { ViewBar } from "./studio-shell/ViewBar";
import { WelcomeDialog, type WelcomeChoice } from "./studio-shell/WelcomeDialog";

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
/** The brand text's colour when the hero's print was full colour (C7): getpack's green, a CMYK-only colour. */
const HANDOFF_FULL_COLOUR = "#0f5f4e";

export interface EditorSeed {
  style: BoxStyleId;
  /** The inside size; absent for a variant that is not sized by length × width × height (C7) — then `values` size it. */
  dims?: BoxDims;
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
  /** "แก้ทั้งหมด" (C8): every fixable finding's fix, together as one undo step. */
  fixAll: (issues: DesignIssue[]) => void;
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
  /** A note over the canvas — the print mode and its limits (with the context: the design's saved version, C11). */
  notice?: React.ReactNode | ((ctx: EditorChromeContext) => React.ReactNode);
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
  /** The Studio editor shell (C8, `editor-prototype.html`): two modes, steps as inspector tabs, the live preflight. */
  shell?: StudioShellChrome;
}

/** What the Studio gives the C8 editor shell. */
export interface StudioShellChrome {
  /** The step shown — each is an inspector tab. */
  step: ShellStep;
  onStep: (step: ShellStep) => void;
  /** A rail panel to open from outside (`?step=box` opens "กล่อง"); `n` changes to ask again. */
  railRequest: { id: RailId; n: number } | null;
  /** The "กล่อง" rail panel: the box, its size, material and print. */
  box: (ctx: EditorChromeContext) => React.ReactNode;
  /** The ตรวจงาน tab. */
  checks: (ctx: EditorChromeContext) => React.ReactNode;
  /** The สั่งผลิต tab: the price and the way to order. */
  order: (ctx: EditorChromeContext) => React.ReactNode;
  /** The top bar's price chip. */
  priceChip: (ctx: EditorChromeContext) => React.ReactNode;
  /** The top bar's "สั่งผลิต" — off while something must be fixed. */
  orderButton: (ctx: EditorChromeContext) => React.ReactNode;
  /** The print priced, in words ("4 สี (CMYK)"), for the inspector and the colours panel; null = not chosen. */
  printLabel: string | null;
  /** Where the logo goes (the Studio's front door). */
  home: string;
  /** The account's mode has been read (or there is no account): only then may the first-open chooser ask. */
  modeReady: boolean;
  /** The first-open chooser: the design service when the product offers it (`null` = not offered). */
  welcome: {
    designService: { freeRevisions: number | null } | null;
    onPick: (choice: WelcomeChoice, ctx: EditorChromeContext) => void;
  };
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
  /** A seeded new box waits for the Studio front door's hand-off (C7). */
  const handoffDue = useRef(false);
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
  const [rail, setRail] = useState<RailId | null>(chrome?.shell ? "brand" : chrome?.views ? null : "box");
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
    chrome?.shell
      ? "split"
      : !chrome?.views
        ? "flat"
        : typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches
          ? "split"
          : "3d",
  );
  // C8 shell: the mode (D-456), the pro tool and the print view.
  const shell = chrome?.shell ?? null;
  const editorMode = useEditorMode((s) => s.mode);
  const modeChosen = useEditorMode((s) => s.chosen);
  const tool = useEditorMode((s) => s.tool);
  const overlays = useEditorMode((s) => s.overlays);
  const inkOnBoard = useEditorMode((s) => s.inkOnBoard);
  const separation = useEditorMode((s) => s.separation);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
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
      values: { ...seed.values, ...(seed.dims ?? {}) },
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
          handoffDue.current = true;
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

  // C7: the brand name or logo from the Studio front door's mini editor, placed once on a freshly seeded box —
  // centred on its largest face, the logo as an ordinary image element (uploaded only when the design is saved).
  useEffect(() => {
    if (!handoffDue.current || !loaded || !canvasDieline) return;
    handoffDue.current = false;
    const handoff = takeHandoff();
    if (!handoff) return;
    const faces = allFaces(canvasDieline).map((face) => faceBounds(face));
    const main = faces.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const at = main ? { x: main.x + main.width / 2, y: main.y + main.height / 2 } : { x: 0, y: 0 };
    const add = useEditor.getState().addElement;
    if (handoff.logo) {
      void newImageFromSrc(at, handoff.logo.src)
        .then((element) => {
          const fit = main ? Math.min(1, (main.width * 0.6) / (element as { width: number }).width) : 1;
          add({
            ...element,
            width: (element as { width: number }).width * fit,
            height: (element as { height: number }).height * fit,
            x: at.x - ((element as { width: number }).width * fit) / 2,
            y: at.y - ((element as { height: number }).height * fit) / 2,
          } as typeof element);
        })
        .catch(() => undefined);
    } else if (handoff.brand?.trim()) {
      const text = newText(at, handoff.brand.trim());
      add(handoff.print === "full" && text.type === "text" ? { ...text, fill: HANDOFF_FULL_COLOUR } : text);
    }
  }, [loaded, canvasDieline]);

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

  // C8 shell: this browser's mode first (the Studio adopts the account's), then the chooser if nobody chose yet.
  const [modeHydrated, setModeHydrated] = useState(false);
  useEffect(() => {
    if (!shell) return;
    useEditorMode.getState().hydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is read after mount
    setModeHydrated(true);
    // Read once, when the editor mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hasSpec = spec !== null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the chooser opens once the box is there
    if (shell && shell.modeReady && modeHydrated && hasSpec && editable && !modeChosen) setWelcomeOpen(true);
    // A mode adopted from the account meanwhile closes it.
    else if (modeChosen) setWelcomeOpen(false);
  }, [shell, shell?.modeReady, modeHydrated, hasSpec, editable, modeChosen]);
  const opened = useRef(false);
  useEffect(() => {
    if (!shell || !modeHydrated || !hasSpec || opened.current) return;
    opened.current = true;
    trackEditor("editor_open", { mode: useEditorMode.getState().mode });
  }, [shell, modeHydrated, hasSpec]);
  // The sheet refits when the mode changes (pro adds the toolbox and rulers).
  const lastMode = useRef(editorMode);
  useEffect(() => {
    if (lastMode.current === editorMode) return;
    lastMode.current = editorMode;

    setFitSignal((n) => n + 1);
  }, [editorMode]);
  const railRequest = shell?.railRequest;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a panel asked for from the address or a step
    if (railRequest) setRail(railRequest.id);
  }, [railRequest]);

  const switchMode = useCallback((next: EditorMode) => {
    const from = useEditorMode.getState().mode;
    if (from === next) return;
    useEditorMode.getState().setMode(next);
    trackEditor("editor_mode_switch", { from, to: next });
  }, []);
  const pickTool = useCallback((next: EditorTool) => {
    useEditorMode.getState().setTool(next);
    trackEditor("editor_tool", { tool: next });
    if (next === "comment") {
      setRail("comments");
      useCommentPins.getState().setPlacing(true);
    }
  }, []);
  // The comment pin is one-shot too: once placed (or cancelled), the tool is "select" again.
  useEffect(
    () =>
      useCommentPins.subscribe((next, prev) => {
        if (prev.placing && !next.placing && useEditorMode.getState().tool === "comment")
          useEditorMode.getState().setTool("select");
      }),
    [],
  );

  // C8 shell keys: the pro tools (V H Z T R E L P I C), ⇧1 fit, + / − zoom, ⌘] / ⌘[ order. In easy mode a pro key
  // offers the pro mode instead (the smart nudge, Phase 2 item 5).
  useEffect(() => {
    if (!shell || !editable) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], [role='dialog']")) return;
      const s = useEditor.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && (event.key === "]" || event.key === "[")) {
        event.preventDefault();
        const dir = event.key === "]" ? (event.shiftKey ? "top" : "up") : event.shiftKey ? "bottom" : "down";
        const ids = event.key === "]" ? [...s.selectedIds].reverse() : s.selectedIds;
        ids.forEach((id) => s.reorder(id, dir));
        return;
      }
      if (mod || event.altKey) return;
      if (event.shiftKey && (event.code === "Digit1" || event.key === "!")) {
        event.preventDefault();
        setFitSignal((n) => n + 1);
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        s.setZoom(s.zoom * 1.25);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        s.setZoom(s.zoom / 1.25);
        return;
      }
      const picked = TOOL_KEYS[key];
      if (!picked || event.shiftKey) return;
      event.preventDefault();
      if (useEditorMode.getState().mode === "pro") pickTool(picked);
      else
        toast(t("shell.nudge.body"), {
          action: { label: t("shell.nudge.action"), onClick: () => switchMode("pro") },
        });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shell, editable, pickTool, switchMode, t]);
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
    if (shell) trackEditor("editor_autofix", { rule: issue.ruleId, count: 1 });
  };
  const fixAll = (list: DesignIssue[]) => {
    if (!dieline) return;
    const fixable = list.filter((i) => i.fix);
    if (!fixable.length) return;
    void import("@/features/designer/lib/fixes").then(({ applyFix }) =>
      // One undo step for all of them.
      useEditor.getState().commit((content) =>
        fixable.reduce((c, issue) => {
          const target = c.elements.find((e) => e.id === issue.elementId);
          const ctx = fixContextFor(dieline, catalog, checkContext, target?.side === "inside" ? "inside" : "outside");
          return applyFix(c, issue, ctx);
        }, content),
      ),
    );
    const byRule = new Map<string, number>();
    for (const i of fixable) byRule.set(i.ruleId, (byRule.get(i.ruleId) ?? 0) + 1);
    for (const [rule, count] of byRule) trackEditor("editor_autofix", { rule, count });
  };
  const chromeContext: EditorChromeContext = {
    persistence,
    issues,
    fix,
    fixAll,
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
    item.id === "colours" ? false : item.id === "comments" ? !!chrome?.comments : (chrome?.rail?.(item.id) ?? true),
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
              controlsClassName:
                chrome?.shell && view === "split" ? "hidden" : view === "split" ? "max-xl:hidden" : undefined,
              compact: !!chrome?.shell && view === "split",
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

  const exportItems = [
    { id: "pdf", label: t("exportMenu.pdf"), description: t("exportMenu.pdfHint"), onSelect: () => doExport("pdf") },
    { id: "png", label: t("exportMenu.png"), description: t("exportMenu.pngHint"), onSelect: () => doExport("png") },
    {
      id: "png-guides",
      label: t("exportMenu.pngGuides"),
      description: t("exportMenu.pngGuidesHint"),
      onSelect: () => doExport("png-guides"),
    },
    { id: "svg", label: t("exportMenu.svg"), description: t("exportMenu.svgHint"), onSelect: () => doExport("svg") },
    { id: "dxf", label: t("exportMenu.dxf"), description: t("exportMenu.dxfHint"), onSelect: () => doExport("dxf") },
    {
      id: "dieline-pdf",
      label: t("exportMenu.dielinePdf"),
      description: t("exportMenu.dielinePdfHint"),
      onSelect: () => doExport("dieline-pdf"),
    },
  ];

  /** The dialogs every layout shares. */
  const dialogs = (
    <>
      {editable ? (
        <SetupModal
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
        shortcuts={shortcutList((key) => tShortcuts(key), mod, shell ? editorMode : undefined)}
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
    </>
  );

  if (shell) {
    const pro = editorMode === "pro";
    const blocking = issues.filter((i) => i.severity === "block").length;
    const advice = issues.filter((i) => i.severity === "warn").length;
    const narrow = size.width > 0 && typeof window !== "undefined" && window.innerWidth < 900;
    const pipWidth = narrow ? 150 : Math.min(Math.round(size.width * 0.3), 236);
    const pip =
      view === "split" && spec
        ? {
            width: pipWidth,
            height: Math.round(pipWidth * 0.75),
            top: narrow ? 10 : pro ? 58 : 12,
            right: narrow ? 10 : 14,
          }
        : null;
    const easyRail: RailId[] = ["templates", "brand", "text", "uploads", "elements", "background", "box", "comments"];
    const proRail: RailId[] = [
      "box",
      "templates",
      "elements",
      "text",
      "uploads",
      "brand",
      "colours",
      "background",
      "layers",
      "comments",
    ];
    const railIcons: Record<RailId, RailItem["icon"]> = Object.fromEntries(RAIL.map((r) => [r.id, r.icon])) as Record<
      RailId,
      RailItem["icon"]
    >;
    const railItems: RailItem[] = (pro ? proRail : easyRail)
      .filter((id) => (id === "comments" ? !!chrome?.comments : (chrome?.rail?.(id) ?? true)))
      .map((id) => ({
        id,
        icon: railIcons[id],
        label: t(pro ? `shell.rail.${id}` : `shell.railEasy.${id}`),
      }));
    const openRail = rail && railItems.some((r) => r.id === rail) ? rail : (railItems[0]?.id ?? null);
    const onIssue = (issue: DesignIssue) => {
      const editor = useEditor.getState();
      const el = editor.content.elements.find((e) => e.id === issue.elementId);
      if (el && (el.side ?? "outside") !== editor.side) editor.setSide(el.side ?? "outside");
      if (issue.elementId) editor.select(issue.elementId);
      shell.onStep("check");
      trackEditor("editor_issue_view", { rule: issue.ruleId });
    };
    const insetBottom = narrow && pro ? 112 : 64;
    const stageNode = (
      <div
        className="bg-canvas absolute inset-0 overflow-hidden"
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
          aria-label={t("shell.stage")}
          className={cn(
            "pk-dot-grid absolute inset-0",
            // Pro: the toolbox has its own column, so the rulers start beside it (the prototype's canvas padding).
            pro && editable && "min-[900px]:left-[58px]",
            view === "3d" && "pointer-events-none invisible",
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
              studio={{
                mode: editorMode,
                tool: pro ? tool : "select",
                overlays: overlaysFor(editorMode, overlays),
                inkOnBoard: pro && inkOnBoard,
                separation: pro ? separation : "all",
                issues,
                onIssue,
                insets: { top: pro ? 18 : 0, right: 0, bottom: insetBottom, left: pro ? 18 : 0 },
                pip,
                onToolDone: () => useEditorMode.getState().setTool("select"),
              }}
            />
          ) : null}
          {canvasDieline ? <FocusChip dieline={canvasDieline} /> : null}
        </div>
        {view === "3d" && spec ? (
          <section aria-label={t("stage.model")} className="absolute inset-0 flex flex-col p-3 pb-20">
            {show3d ? preview : <Skeleton className="size-full" />}
          </section>
        ) : null}
        {pip && spec ? (
          <section
            aria-label={t("shell.pip.label")}
            className="border-border bg-surface shadow-overlay absolute z-[4] overflow-hidden rounded-2xl border"
            style={{ top: pip.top, right: pip.right, width: pip.width, height: pip.height }}
          >
            {pip.width >= 200 ? (
              <span className="text-muted pointer-events-none absolute start-3 top-2.5 z-[1] text-[11px] font-medium tracking-wide">
                {t("shell.pip.caption")}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t("shell.pip.open")}
              title={t("shell.pip.open")}
              onClick={() => setPresenting(true)}
              className="text-muted hover:text-fg hover:bg-surface-subtle focus-visible:ring-focus-ring absolute end-2 top-2 z-[1] grid size-8 place-items-center rounded-lg outline-none focus-visible:ring-2"
            >
              <Icon name="play" size={17} aria-hidden="true" />
            </button>
            <div className="flex size-full flex-col">{show3d ? preview : <Skeleton className="size-full" />}</div>
          </section>
        ) : null}
        {pro && view !== "3d" && editable ? (
          <Toolbox
            tool={tool}
            onTool={pickTool}
            comments={!!chrome?.comments}
            className="absolute start-3 top-3 z-[5] max-[899px]:start-1/2 max-[899px]:top-auto max-[899px]:bottom-[58px] max-[899px]:max-w-[calc(100%-24px)] max-[899px]:-translate-x-1/2"
          />
        ) : null}
        {pro && view !== "3d" ? (
          <div className="absolute end-3 top-3 z-[5] max-[899px]:hidden">
            <PrintViewMenu
              bleedMm={useEditor.getState().bleedMm}
              safeMm={catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM}
            />
          </div>
        ) : null}
        {chrome?.notice ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[6] flex justify-center px-3 max-[899px]:top-auto max-[899px]:bottom-[112px]">
            <div className="pointer-events-auto flex max-w-[min(36rem,100%)] flex-wrap justify-center gap-2 [&>*]:max-w-full [&>*]:text-center [&>*]:whitespace-normal">
              {typeof chrome.notice === "function" ? chrome.notice(chromeContext) : chrome.notice}
            </div>
          </div>
        ) : null}
        <ViewBar
          view={view}
          onView={(next) => {
            setView(next);
            setFitSignal((n) => n + 1);
          }}
          side={side}
          onSide={(next) => void switchSide(next)}
          onFit={() => setFitSignal((n) => n + 1)}
          className="absolute bottom-3.5 left-1/2 z-[5] -translate-x-1/2 max-[600px]:bottom-2.5"
        />
      </div>
    );

    const panelNode =
      openRail === "box" ? (
        shell.box(chromeContext)
      ) : openRail === "colours" ? (
        <ColoursPanel printLabel={shell.printLabel} />
      ) : openRail ? (
        <RailPanel
          id={openRail}
          onOpenSetup={openSetup}
          onOpenRules={openRules}
          comments={chrome?.comments?.(chromeContext)}
        />
      ) : null;

    const designTab = !editable ? (
      <p className="text-muted text-sm">{t("readOnly.body")}</p>
    ) : pro ? (
      <ProInspector
        printLabel={shell.printLabel}
        bleedMm={useEditor.getState().bleedMm}
        safeMm={catalog?.rules.safeMarginMm ?? DEFAULT_SAFE_MM}
      />
    ) : (
      <EasyInspector
        issues={issues}
        actions={{
          rail: (id) => setRail(id),
          checks: () => shell.onStep("check"),
          mockup: () => setPresenting(true),
        }}
      />
    );

    const boxLabel = spec
      ? `${getStyle(spec.styleId).name[locale]} · ${
          sizeOf(spec).box ? t("summary", { ...insideSize(spec) }) : t("summaryOther", { size: sizeOf(spec).text })
        }`
      : null;

    return (
      <DesignerContext.Provider value={handle}>
        <TooltipProvider>
          {starting ? (
            <div className="bg-canvas text-fg flex h-dvh flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">{chrome!.empty!(chromeContext)}</div>
            </div>
          ) : (
            <StudioFrame
              top={
                <TopBar label={t("shell.topBar")}>
                  <NextLink
                    href={shell.home}
                    aria-label={t("shell.home")}
                    className="focus-visible:ring-focus-ring flex shrink-0 items-center rounded-md px-1 outline-none focus-visible:ring-2"
                  >
                    <BrandLogo height={20} />
                  </NextLink>
                  <input
                    value={name}
                    readOnly={!editable}
                    onChange={(event) => useEditor.getState().setName(event.target.value)}
                    aria-label={t("nameLabel")}
                    className="hover:border-border focus:border-focus-ring focus:bg-surface-subtle w-[170px] min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-[13.5px] font-semibold outline-none max-[1380px]:w-[150px] max-[1180px]:w-[130px] max-[899px]:w-auto max-[899px]:flex-[1_1_120px]"
                  />
                  {saveLabel ? (
                    <span
                      role="status"
                      className="text-muted inline-flex items-center gap-1.5 text-xs whitespace-nowrap max-[1180px]:hidden"
                    >
                      <i
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full",
                          persistence.state === "saved" ? "bg-success" : "bg-warning",
                        )}
                      />
                      {saveLabel}
                    </span>
                  ) : null}
                  {editable ? (
                    <ModeSwitch
                      mode={editorMode}
                      onMode={switchMode}
                      className="ms-1.5 max-[899px]:order-4 max-[899px]:ms-0 max-[600px]:flex-1"
                    />
                  ) : null}
                  <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0 max-[899px]:hidden" />
                  {editable ? (
                    <div
                      className="flex items-center gap-0.5 max-[899px]:order-2"
                      role="group"
                      aria-label={t("toolbar.label")}
                    >
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
                      {pro && session.mode === "store" && persistence.serverId() ? (
                        <IconButton
                          name="history"
                          label={t("history.open")}
                          size="sm"
                          variant="ghost"
                          className="max-[899px]:hidden"
                          onClick={() => setHistoryOpen(true)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <StepNav
                    step={shell.step}
                    onStep={shell.onStep}
                    blocking={blocking}
                    advice={advice}
                    className="mx-auto max-[899px]:hidden"
                  />
                  <div className="flex items-center gap-1 max-[1180px]:gap-0.5 max-[899px]:order-5 max-[899px]:ms-auto">
                    <span className="max-[600px]:hidden">
                      <ThemeToggle
                        label={tCommon("theme.label")}
                        choiceLabels={{
                          system: tCommon("theme.system"),
                          light: tCommon("theme.light"),
                          dark: tCommon("theme.dark"),
                          hc: tCommon("theme.hc"),
                        }}
                      />
                    </span>
                    {session.mode === "store" && persistence.serverId() ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconStart="link"
                        aria-label={t("shell.share")}
                        onClick={() => setShareOpen(true)}
                      >
                        <span className="max-[600px]:sr-only">{t("shell.share")}</span>
                      </Button>
                    ) : null}
                    {chrome?.presentation && spec ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconStart="play"
                        aria-label={t("shell.mockup")}
                        onClick={() => setPresenting(true)}
                      >
                        <span className="max-[600px]:sr-only">{t("shell.mockup")}</span>
                      </Button>
                    ) : null}
                    {pro && spec ? (
                      <DropdownMenu
                        label={t("exportMenu.label")}
                        trigger={
                          <Button
                            size="sm"
                            variant="secondary"
                            iconStart="download"
                            aria-label={tCommon("actions.export")}
                            className="max-[899px]:hidden"
                          >
                            <span className="max-[600px]:sr-only">{tCommon("actions.export")}</span>
                          </Button>
                        }
                        items={exportItems}
                      />
                    ) : null}
                    <span className="max-[1180px]:hidden">{shell.priceChip(chromeContext)}</span>
                    {shell.orderButton(chromeContext)}
                  </div>
                </TopBar>
              }
              notes={
                <>
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
                  <p className="bg-warning-subtle text-warning-subtle-fg px-3 py-2 text-xs min-[900px]:hidden">
                    {t("shell.phoneNote")}
                  </p>
                </>
              }
              rail={
                editable ? (
                  <Rail
                    items={railItems}
                    active={openRail}
                    label={t("rail.label")}
                    onPick={(id) => {
                      setRail(id);
                      if (id !== "comments") useCommentPins.getState().setPlacing(false);
                    }}
                  />
                ) : null
              }
              panel={
                editable && openRail ? (
                  <AssetPanel title={t(pro ? `shell.rail.${openRail}` : `shell.railEasy.${openRail}`)}>
                    {panelNode}
                  </AssetPanel>
                ) : null
              }
              stage={stageNode}
              inspector={
                <Inspector tab={shell.step} onTab={shell.onStep} blocking={blocking} advice={advice}>
                  {shell.step === "design"
                    ? designTab
                    : shell.step === "check"
                      ? shell.checks(chromeContext)
                      : shell.order(chromeContext)}
                </Inspector>
              }
              status={
                <StudioStatusBar
                  mode={editorMode}
                  boxLabel={boxLabel}
                  dieline={canvasDieline}
                  issues={issues}
                  onChecks={() => shell.onStep("check")}
                  onShortcuts={() => setShortcutsOpen(true)}
                />
              }
            />
          )}
          {dialogs}
          <WelcomeDialog
            open={welcomeOpen}
            designService={shell.welcome.designService}
            onClose={() => {
              setWelcomeOpen(false);
              // Closing keeps the mode shown (easy for a new person) as the choice: asked once.
              useEditorMode.getState().setMode(useEditorMode.getState().mode);
            }}
            onPick={(choice) => {
              setWelcomeOpen(false);
              trackEditor("editor_welcome_pick", { choice });
              const next: EditorMode = choice === "pro" || choice === "file" ? "pro" : "easy";
              useEditorMode.getState().setMode(next);
              shell.welcome.onPick(choice, chromeContext);
            }}
          />
        </TooltipProvider>
      </DesignerContext.Provider>
    );
  }

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
                        {typeof chrome.notice === "function" ? chrome.notice(chromeContext) : chrome.notice}
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

          {/*
           * The setup dialog takes no `key` to force a remount: BoxStudio used one to reset the form, but remounting
           * unmounts Radix's focus scope instead of letting it close, so focus never returned to the button that
           * opened it (WCAG 2.4.3 — e2e/a11y.spec.ts asserts it). SetupModal resets itself from `initial` instead.
           */}
          {dialogs}
        </div>
      </TooltipProvider>
    </DesignerContext.Provider>
  );
}

const RAIL_LABELS = Object.fromEntries(RAIL.map((item) => [item.id, true]));

export { PX_PER_MM };
