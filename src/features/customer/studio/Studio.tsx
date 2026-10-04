"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OrderAction, type OrderLink } from "@/features/customer/designer/OrderAction";
import { BoxPanel } from "@/features/designer/components/panels/BoxPanel";
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
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { PriceDock } from "./PriceDock";
import { studioFieldsOf } from "./spec";
import { StepBar } from "./StepBar";
import { initialStep, lockedReason, type StepFacts, type StudioStep } from "./steps";
import { useChecksClean, useStudioFunnel } from "./funnel";

const STUDIO_ROUTE = "/studio/[designId]";

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

  const hasBox = useEditor((s) => s.spec !== null);
  const hasContent = useEditor((s) => s.content.elements.length > 0 || s.content.pattern.kind !== "none");
  const facts: StepFacts = { hasBox, hasContent };
  const [step, setStepState] = useState<StudioStep>(() =>
    initialStep(askedStep, { hasBox: !!design?.document.spec || !!seed, hasContent: true }),
  );
  const [quantity, setQuantity] = useState<number | null>(null);
  const styleFamily = configurator.data?.productTypeCode;
  const funnel = useStudioFunnel({ route: STUDIO_ROUTE, styleFamily });

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
              return c ? studioFieldsOf(c, spec, content) : null;
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
          <StartPanel
            productName={catalog?.product ? (locale === "en" ? catalog.product.nameEn : catalog.product.nameTh) : null}
            hasBox={hasBox}
            onChooseBox={ctx.openSetup}
            onNext={() => goTo(hasBox ? "box" : "start")}
          />
        );
      case "box":
        return (
          <div className="space-y-5">
            <BoxPanel onOpenSetup={ctx.openSetup} onOpenRules={ctx.openRules} />
            <Button className="w-full" onClick={() => goTo("design")} disabled={!hasBox}>
              {t("box.confirm")}
            </Button>
          </div>
        );
      case "check":
        return (
          <div className="space-y-5">
            <h2 className="font-semibold">{t("check.title")}</h2>
            <ChecksPanel issues={ctx.issues} />
            <Button className="w-full" onClick={() => goTo("order")}>
              {t("check.next")}
            </Button>
          </div>
        );
      case "order":
        return (
          <div className="space-y-4">
            <h2 className="font-semibold">{t("order.title")}</h2>
            {ctx.issues.some((issue) => issue.severity === "error") ? (
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

  return (
    <Editor
      id={id}
      nav={{
        home: locale === "en" ? "/en" : "/",
        push: (href) => router.push(href),
        replace: (href) => {
          const studioHref = href.replace(/^\/design\//, "/studio/");
          const query = new URLSearchParams(carried);
          query.set("step", shown);
          router.replace(`${studioHref}?${query.toString()}`);
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
        dock: (ctx, layout) =>
          shown === "start" ? null : (
            <PriceDock
              configurator={configurator.data ?? null}
              source={mode === "store" ? "studio" : "guest"}
              persistence={ctx.persistence}
              layout={layout}
              quantity={quantity}
              onQuantity={setQuantity}
              onOrder={() => goTo("order")}
              orderDisabled={!hasContent}
            />
          ),
      }}
    />
  );
}

function StartPanel({
  productName,
  hasBox,
  onChooseBox,
  onNext,
}: {
  productName: string | null;
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
        {hasBox ? <Button onClick={onNext}>{t("next")}</Button> : null}
      </div>
    </div>
  );
}

function ChecksCleanWatch({ issues, onClean }: { issues: EditorChromeContext["issues"]; onClean: () => void }) {
  useChecksClean(issues, onClean);
  return null;
}
