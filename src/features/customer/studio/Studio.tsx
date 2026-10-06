"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OrderAction, type OrderLink } from "@/features/customer/designer/OrderAction";
import { ChecksPanel } from "@/features/designer/components/panels/ChecksPanel";
import Editor, {
  type EditorChromeContext,
  type EditorSeed,
  type EditorSession,
  type InitialDesign,
} from "@/features/designer/components/Editor";
import type { BoxFields, DesignerCatalog } from "@/features/designer/data/api";
import { designRepo } from "@/features/designer/storage";
import { useEditor } from "@/features/designer/store/editor";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";

import { loadLibrary, needsLibrary } from "./library";
import { PriceDock } from "./PriceDock";
import { maxSpotColours, useStudioRules } from "./rules";
import type { PrintRule } from "@/features/designer/lib/checks";
import { artworkColours } from "./state";
import { studioFieldsOf } from "./spec";
import { IntentPicker } from "@/features/customer/help/IntentPickerLazy";
import { StartScreen } from "./StartScreen";
import { RULE_HELP } from "./help";
import { SampleDesignLink } from "./SampleDesign";
import { StepBar } from "./StepBar";
import { StudioGuide } from "./StudioGuide";
import { initialStep, lockedReason, type StepFacts, type StudioStep } from "./steps";
import { useStudioChecks } from "./checks";
import { useChecksClean, useStudioFunnel } from "./funnel";

const STUDIO_ROUTE = "/studio/[designId]";

// ① and ② load when they are shown: a design opened on ③ never pays for them.
const StudioComments = dynamic(() => import("./comments/StudioComments").then((m) => m.StudioComments), {
  ssr: false,
});
const ShareLinks = dynamic(() => import("./ShareLinks").then((m) => m.ShareLinks), { ssr: false });
const OrderSheet = dynamic(() => import("./OrderSheet").then((m) => m.OrderSheet), { ssr: false });
const BoxStep = dynamic(() => import("./BoxStep").then((m) => m.BoxStep), { ssr: false });
const DescribeProduct = dynamic(() => import("./DescribeProduct").then((m) => m.DescribeProduct), { ssr: false });

export interface StudioProps {
  id: string;
  signedIn: boolean;
  design: (InitialDesign & { box: BoxFields | null }) | null;
  catalog: DesignerCatalog | null;
  seed?: EditorSeed;
  link: OrderLink | null;
  productSlug: string | null;
  catalogProductId: string | null;
  templateId?: string | null;
  /** `?step=` as the page was opened. */
  step?: string;
  /** D-276: the version the latest order locked (editing makes a new version, never touches it). */
  lock?: Schemas["DesignLockDto"] | null;
}

/**
 * Packio 3D Studio (U4.1, studio-spec §2): the F4 designer framed by five reversible steps on
 * one URL, with the price dock from ② onwards. The editor stays mounted across the steps, so the
 * canvas, its history and the selection survive going back and forth; the step is kept in the
 * address (`?step=`) without a navigation.
 *
 * A signed-in customer's design lives in the account: each version is saved with its box and the
 * calculator spec (D-275), content changes as JSON Patch (D-276), and the dock prices the saved
 * version (`store.studio.quote`). A guest's design stays in the browser until sign-in imports it,
 * and the dock prices the same configuration directly (`store.quotes.calculate`).
 */
export function Studio({
  id,
  signedIn,
  design,
  catalog,
  seed,
  link,
  productSlug: openedWith,
  catalogProductId,
  templateId,
  step: askedStep,
  lock = null,
}: StudioProps) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const router = useRouter();
  const [localFallback] = useState(
    () => signedIn && !design && id !== "new" && typeof window !== "undefined" && !!designRepo.get(id),
  );
  const cannotCreate = !design && id === "new" && !catalogProductId;
  const mode = signedIn && !localFallback && !cannotCreate ? "store" : "local";
  const productSlug = openedWith ?? seed?.productSlug ?? catalog?.product?.slug ?? null;

  const configurator = useQuery({
    queryKey: [...queryKeys.zone("customer"), "configurator", productSlug, locale],
    queryFn: async () => {
      const { data } = await browserApi().GET("/v1/store/catalog/products/{slug}/configurator", {
        params: { path: { slug: productSlug! } },
      });
      return data!;
    },
    enabled: !!productSlug,
    staleTime: 5 * 60_000,
  });
  const configuratorRef = useRef(configurator.data ?? null);
  useEffect(() => {
    configuratorRef.current = configurator.data ?? null;
  }, [configurator.data]);

  useEffect(() => {
    if (catalog?.rules.bleedMm) useEditor.getState().setBleed(catalog.rules.bleedMm);
  }, [catalog]);

  // The flexo spot-colour limit (D-278) shapes the spec, the dock and the editor's flexo mode.
  const rules = useStudioRules();
  const maxSpot = maxSpotColours(rules.data);
  const maxSpotRef = useRef(maxSpot);
  useEffect(() => {
    maxSpotRef.current = maxSpot;
  }, [maxSpot]);

  // A design on a style only the library draws (a published variant, U3.4) opens once it is loaded.
  const [libraryReady, setLibraryReady] = useState(
    () => !needsLibrary((design?.document.spec as { styleId?: unknown } | null)?.styleId),
  );
  useEffect(() => {
    if (libraryReady) return;
    let cancelled = false;
    void loadLibrary().then(() => !cancelled && setLibraryReady(true));
    return () => {
      cancelled = true;
    };
  }, [libraryReady]);

  const hasBox = useEditor((s) => s.spec !== null);
  // A plain box (no print, ②) is ready to check and order without artwork.
  const hasContent = useEditor(
    (s) => s.content.elements.length > 0 || s.content.pattern.kind !== "none" || s.spec?.studio?.printMethod === "none",
  );
  const facts: StepFacts = { hasBox, hasContent };
  const [step, setStepState] = useState<StudioStep>(() =>
    initialStep(askedStep, { hasBox: !!design?.document.spec || !!seed, hasContent: true }),
  );
  const [quantity, setQuantity] = useState<number | null>(null);
  const styleFamily = configurator.data?.productTypeCode;
  const printMethod = useEditor((s) => s.spec?.studio?.printMethod ?? undefined) ?? undefined;
  const colours = useEditor((s) => artworkColours(s.content));
  const funnel = useStudioFunnel({ route: STUDIO_ROUTE, styleFamily, printMethod });
  // A company member's order may need the company's approval at checkout (D-281).
  const companies = useQuery({
    queryKey: [...queryKeys.zone("customer"), "my-companies"],
    queryFn: async () => (await browserApi().GET("/v1/store/companies")).data!,
    enabled: mode === "store",
    staleTime: 10 * 60_000,
  });

  // Inside printing (U4.3): its cost is shown before the first switch to the inside.
  const [insideAsk, setInsideAsk] = useState<((ok: boolean) => void) | null>(null);
  const onSide = useCallback(async (next: "outside" | "inside") => {
    if (next === "outside") return true;
    const spec = useEditor.getState().spec;
    const sides = spec?.studio?.printSides ?? "outside";
    if (sides === "inside" || sides === "both") return true;
    const ok = await new Promise<boolean>((resolve) => setInsideAsk(() => resolve));
    setInsideAsk(null);
    if (!ok || !spec) return false;
    const now = useEditor.getState().spec!;
    useEditor.getState().setSpec({
      ...now,
      studio: {
        ...now.studio,
        printSides: sides === "none" ? "inside" : "both",
        ...(now.studio?.printMethod === "none" ? { printMethod: null } : {}),
      },
    });
    return true;
  }, []);

  // ① offers its own ways to a box: the setup dialog opens only when asked there.
  const [autoSetup] = useState(() => step !== "start");

  /** Moves to a step and keeps it in the address, without a navigation (the editor stays as it is). */
  const goTo = useCallback(
    (next: StudioStep) => {
      if (lockedReason(next, { hasBox: useEditor.getState().spec !== null, hasContent: true }) === "needsBox") return;
      if (next !== "start" && next !== "box" && useEditor.getState().spec) funnel.boxConfirmed();
      setStepState(next);
      const url = new URL(window.location.href);
      url.searchParams.set("step", next);
      window.history.replaceState(window.history.state, "", url);
    },
    [funnel],
  );

  // A box set up from ① (the setup dialog: style, size, material) goes straight on to ③.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (s.spec && !prev.spec && stepRef.current === "start" && s.dirty) goTo("design");
      }),
    [goTo],
  );

  // A step that closed (the content was removed) falls back to the last open one.
  const shown = lockedReason(step, facts) ? initialStep(step, facts) : step;

  const carried = new URLSearchParams({
    ...(productSlug ? { product: productSlug } : {}),
    ...(link ? { order: link.orderId, item: link.itemId, orderCode: link.orderCode } : {}),
  });

  // Stable: the editor loads the design again whenever its session changes.
  const session: EditorSession = useMemo(
    () => ({
      mode,
      editable: true,
      design,
      create: catalogProductId
        ? {
            catalogProductId,
            ...(seed?.patternId ? { patternId: seed.patternId } : {}),
            ...(seed?.materialId ? { materialId: seed.materialId } : {}),
            ...(templateId ? { semiDesignTemplateId: templateId } : {}),
          }
        : undefined,
      box:
        mode === "store"
          ? () => {
              const c = configuratorRef.current;
              const { spec, content } = useEditor.getState();
              return c ? studioFieldsOf(c, spec, content, maxSpotRef.current) : null;
            }
          : undefined,
      initialBox: design?.box ?? null,
    }),
    [mode, design, catalogProductId, seed, templateId],
  );

  const panel = (ctx: EditorChromeContext) => {
    switch (shown) {
      case "start":
        return (
          <div className="space-y-6">
            <StartPanel
              productName={
                catalog?.product ? (locale === "en" ? catalog.product.nameEn : catalog.product.nameTh) : null
              }
              productSlug={productSlug}
              hasBox={hasBox}
              onChooseBox={ctx.openSetup}
              onNext={() => goTo(hasBox ? "box" : "start")}
            />
            <DescribeProduct
              catalog={catalog}
              onPick={(spec) => {
                useEditor.getState().setSpec(spec);
                goTo("box");
              }}
            />
          </div>
        );
      case "box":
        return (
          <BoxStep
            catalog={catalog}
            configurator={configurator.data ?? null}
            maxSpot={maxSpot}
            openSetup={ctx.openSetup}
            onDone={() => goTo("design")}
          />
        );
      case "check":
        return (
          <CheckStep
            ctx={ctx}
            rules={(rules.data?.rules ?? []) as PrintRule[]}
            serverChecks={mode === "store"}
            onNext={() => goTo("order")}
          />
        );
      case "order":
        // An account design not tied to an order line orders from the studio itself (U4.6).
        if (mode === "store" && !link && configurator.data?.instant)
          return (
            <OrderSheet
              ctx={ctx}
              configurator={configurator.data}
              rules={(rules.data?.rules ?? []) as PrintRule[]}
              quantity={quantity}
              onQuantity={setQuantity}
              productSlug={productSlug}
              companyBuyer={(companies.data?.length ?? 0) > 0}
              styleFamily={styleFamily}
              printMethod={printMethod ?? undefined}
              onChecks={() => goTo("check")}
            />
          );
        return (
          <div className="space-y-4">
            <h2 className="font-semibold">{t("order.title")}</h2>
            {ctx.issues.some((issue) => issue.severity === "block") ? (
              <Callout tone="warning" title={t("order.hasProblems")}>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => goTo("check")}>
                  {t("order.toChecks")}
                </Button>
              </Callout>
            ) : null}
            <p className="text-muted text-sm">{t(mode === "store" ? "order.body" : "order.bodyGuest")}</p>
            <OrderAction link={mode === "store" ? link : null} productSlug={productSlug} />
            {mode === "local" ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/sign-in?returnTo=${encodeURIComponent(`/studio/${id}`)}`}>{t("order.signIn")}</Link>
              </Button>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  if (!libraryReady) return null;

  return (
    <>
      <AlertDialog
        open={insideAsk !== null}
        onOpenChange={(open) => !open && insideAsk?.(false)}
        title={t("inside.title")}
        description={t("inside.body")}
        confirmLabel={t("inside.confirm")}
        cancelLabel={t("inside.cancel")}
        onConfirm={() => insideAsk?.(true)}
      />
      <Editor
        id={id}
        nav={{
          home: locale === "en" ? "/en" : "/",
          push: (href) => router.push(href),
          // `/studio/new` becomes the design's own address in place: a navigation would mount a
          // second studio (a new route param) whose first save races this one's with an older ETag.
          replace: (href) => {
            const studioHref = href.replace(/^\/design\//, "/studio/");
            const query = new URLSearchParams(carried);
            query.set("step", stepRef.current);
            const prefix = locale === "en" ? "/en" : "";
            window.history.replaceState(window.history.state, "", `${prefix}${studioHref}?${query.toString()}`);
          },
        }}
        session={session}
        catalog={catalog}
        seed={seed}
        designHref={(designId) => `/studio/${designId}`}
        chrome={{
          below: (ctx) => (
            <>
              <StepBar step={shown} facts={facts} onStep={goTo} />
              <ChecksCleanWatch issues={ctx.issues} onClean={funnel.checksClean} />
            </>
          ),
          panel,
          autoSetup,
          // Before a box: the start screen fills the canvas (UX audit, studio).
          empty: (ctx) => (
            <StartScreen onChooseBox={ctx.openSetup} productSlug={productSlug} signedIn={mode === "store"} />
          ),
          views: true,
          onSide,
          comments:
            mode === "store"
              ? (ctx) =>
                  ctx.persistence.serverId() ? (
                    <StudioComments
                      designId={ctx.persistence.serverId()!}
                      dieline={ctx.dieline}
                      companyId={companies.data?.[0]?.id ?? null}
                      versionNo={ctx.persistence.versionNo()}
                    />
                  ) : null
              : undefined,
          presentation: true,
          share: (designId, close) => (
            <ShareLinks designId={designId} open onClose={close} canEdit={(companies.data?.length ?? 0) > 0} />
          ),
          rail: (tool) =>
            printMethod === "none"
              ? tool === "box" || tool === "layers"
              : printMethod === "flexo"
                ? tool !== "uploads"
                : true,
          notice: (
            <>
              <StudioGuide signedIn={signedIn} />
              {lock ? (
                <Badge tone="neutral">{t("locked", { versionNo: lock.versionNo, orderCode: lock.orderCode })}</Badge>
              ) : null}
              {shown === "design" && printMethod === "none" ? (
                <Badge tone="info">{t("mode.none")}</Badge>
              ) : shown === "design" && printMethod === "flexo" ? (
                <Badge tone={maxSpot !== null && colours > maxSpot ? "warning" : "info"}>
                  {maxSpot !== null
                    ? t("mode.flexoLimited", { used: colours, max: maxSpot })
                    : t("mode.flexo", { used: colours })}
                </Badge>
              ) : null}
            </>
          ),
          dock: (ctx, layout) =>
            shown === "start" ? null : (
              <PriceDock
                configurator={configurator.data ?? null}
                source={mode === "store" ? "studio" : "guest"}
                persistence={ctx.persistence}
                maxSpot={maxSpot}
                layout={layout}
                quantity={quantity}
                onQuantity={setQuantity}
                onOrder={() => goTo("order")}
                orderDisabled={!hasContent}
              />
            ),
        }}
      />
    </>
  );
}

function StartPanel({
  productName,
  productSlug,
  hasBox,
  onChooseBox,
  onNext,
}: {
  productName: string | null;
  productSlug: string | null;
  hasBox: boolean;
  onChooseBox: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("studio.start");
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{t("title")}</h2>
      {productName ? <p className="text-sm">{t("product", { name: productName })}</p> : null}
      <div className="flex flex-col gap-2">
        <Button onClick={onChooseBox} variant={hasBox ? "secondary" : "primary"} iconStart="box">
          {hasBox ? t("changeBox") : t("chooseBox")}
        </Button>
        <Button asChild variant="secondary" iconStart="layers">
          <Link href="/styles">{t("library")}</Link>
        </Button>
        {hasBox ? <Button onClick={onNext}>{t("next")}</Button> : <SampleDesignLink productSlug={productSlug} />}
      </div>
      {hasBox ? null : <IntentPicker here="studio" productSlug={productSlug} />}
    </div>
  );
}

function ChecksCleanWatch({ issues, onClean }: { issues: EditorChromeContext["issues"]; onClean: () => void }) {
  useChecksClean(issues, onClean);
  return null;
}

/**
 * ④ Check (studio-spec §2): the live findings with their fixes, the warnings accepted for this
 * version (packio-api's run of the saved version for the rules it evaluates too), and the way on.
 */
function CheckStep({
  ctx,
  rules,
  serverChecks,
  onNext,
}: {
  ctx: EditorChromeContext;
  rules: PrintRule[];
  serverChecks: boolean;
  onNext: () => void;
}) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const saveState = ctx.persistence.state;
  const checks = useStudioChecks(
    ctx.persistence.serverId(),
    ctx.persistence.versionNo(),
    rules,
    serverChecks && saveState === "saved",
    ctx.persistence.versionNo,
  );
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">{t("check.title")}</h2>
      <ChecksPanel
        issues={ctx.issues}
        onFix={ctx.fix}
        acknowledged={checks.acknowledged}
        onAcknowledge={checks.acknowledge}
        helpHref={(issue) => {
          const [path, hash] = RULE_HELP[issue.ruleId].split("#");
          return `${getPathname({ href: path!, locale })}${hash ? `#${hash}` : ""}`;
        }}
      />
      <Button className="w-full" onClick={onNext}>
        {t("check.next")}
      </Button>
    </div>
  );
}
