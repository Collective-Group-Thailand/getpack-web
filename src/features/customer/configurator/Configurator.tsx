"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import type { LengthUnit } from "@/ui/components/DimensionInput";
import { QuoteDockSpacer } from "@/ui/components/QuoteDock";
import { Skeleton } from "@/ui/components/Skeleton";
import { Stepper, type StepStatus } from "@/ui/components/Stepper";

import { quantityBand } from "../analytics/bands";
import { loadOf, useAdvisor, useAdvisorMethod, type AdvisorOption } from "./advisor";
import { buildCalculateBody, seedFromConfiguration } from "./build";
import { ConfiguratorDock } from "./ConfiguratorDock";
import { boxStyleOf, ConfiguratorPreview } from "./ConfiguratorPreview";
import { useConversion, usePatternBases } from "./conversion";
import { configurationSummary, lineChatUrl } from "./line";
import { basesOf, groupsOf, optionsById, sizeKindOf } from "./model";
import { useLivePrice } from "./pricing";
import { SizeStep } from "./SizeStep";
import {
  axesOf,
  groupsIn,
  initialState,
  isConverted,
  missingAreas,
  missingChoices,
  patternOf,
  POSTCODE,
  readyToPrice,
  sizeProblems,
  stepsOf,
  TARGET,
  type Configurator as ConfiguratorData,
  type ConfiguratorState,
  type StepKey,
} from "./state";
import { useDraft, type Draft } from "./useDraft";
import { useQuoteActions, type SavedQuote } from "./useQuoteActions";
import { studioHref } from "@/features/customer/studio/paths";

/*
 * Only the first step is in the initial load; the others arrive when first opened (they are a
 * click away, and the configurator is an app-type page with a budget, docs/performance-budgets.md).
 */
const stepLoading = () => <Skeleton className="h-24 w-full" />;
const ChoicesStep = dynamic(() => import("./ChoicesStep").then((module) => module.ChoicesStep), {
  loading: stepLoading,
});
const LogisticsStep = dynamic(() => import("./LogisticsStep").then((module) => module.LogisticsStep), {
  loading: stepLoading,
});
const AdvisorPanel = dynamic(() => import("./AdvisorPanel").then((module) => module.AdvisorPanel), {
  loading: stepLoading,
});
const QuantityStep = dynamic(() => import("./QuantityStep").then((module) => module.QuantityStep), {
  loading: stepLoading,
});
const DeliveryStep = dynamic(() => import("./DeliveryStep").then((module) => module.DeliveryStep), {
  loading: stepLoading,
});
const DesignStep = dynamic(() => import("./DesignStep").then((module) => module.DesignStep), {
  loading: stepLoading,
});
const SummaryStep = dynamic(() => import("./SummaryStep").then((module) => module.SummaryStep), {
  loading: stepLoading,
});
const TargetPanel = dynamic(() => import("./TargetPanel").then((module) => module.TargetPanel), {
  loading: stepLoading,
});

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((module) => module.SignInSheet), {
  ssr: false,
});

export interface ConfiguratorProps {
  configurator: ConfiguratorData;
  productName: { th: string; en: string };
  signedIn: boolean;
  lineOaId: string | null;
  /** A draft, a shared or saved quote reopened here: its answers become the starting point. */
  seed?: Partial<ConfiguratorState>;
  /** The draft this visit resumed (D-185), so saving again updates it. */
  draft?: Draft | null;
  /** The RFQ form for this product's category. */
  rfqPath: string;
  /** This page's canonical address, for the link in a LINE message. */
  pageUrl: string;
}

/**
 * The configurator v2 (U2.F1): an adaptive stepper — the steps this product has, and no others —
 * beside a live preview and the instant-quote dock.
 *
 * The size is entered on a chosen basis and shown on every other one by the API's conversion
 * (D-182); corrugated boxes may ask the Structure Advisor which board to use (D-235–D-240); an
 * optional target price brings the API's levers (D-247–D-251); the summary keeps the whole
 * configuration as a draft or a link (D-185). Every change re-prices after a pause; nothing is
 * priced, converted or rated here.
 */
export function Configurator({
  configurator,
  productName,
  signedIn,
  lineOaId,
  seed,
  draft: resumed = null,
  rfqPath,
  pageUrl,
}: ConfiguratorProps) {
  const t = useTranslations("configurator");
  const tUnits = useTranslations("catalog.stock.units");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [entered, setState] = useState(() => initialState(configurator, seed));
  const [session, setSession] = useState(signedIn);
  const [signIn, setSignIn] = useState<{ open: boolean; then: (() => void) | null }>({ open: false, then: null });
  const name = pick(locale, productName.th, productName.en);
  const unit = tUnits(configurator.unit);
  const requestSignIn = (then: () => void) => setSignIn({ open: true, then });

  const method = useAdvisorMethod(configurator);
  const advisorOn = method.data?.available === true;
  const steps = useMemo(() => stepsOf(configurator, { advisor: advisorOn }), [configurator, advisorOn]);
  const [current, setCurrent] = useState<StepKey>(steps[0]!);

  const update = (patch: Partial<ConfiguratorState>) => setState((previous) => ({ ...previous, ...patch }));

  // D-182: the bases this pattern is measured on, as the API's conversion knows its construction.
  // A style the API builds flat is measured on its finished size only, so that is its basis; a
  // basis this pattern is not measured on is not an answer.
  const patternBases = usePatternBases(configurator, patternOf(configurator, entered)?.id ?? null);
  const bases = patternBases ?? basesOf(configurator);
  const flatStyle = patternBases?.length === 1 && patternBases[0] === "product";
  const state: ConfiguratorState = {
    ...entered,
    flatStyle,
    basis: flatStyle ? "product" : entered.basis && bases.includes(entered.basis) ? entered.basis : null,
  };

  const conversion = useConversion(configurator, state);
  const problems = sizeProblems(configurator, state, conversion.internal);
  const missingGroups = missingChoices(configurator, state);
  const missingArea = missingAreas(configurator, state);
  const ready = readyToPrice(configurator, state, conversion.internal) && !conversion.caliperUnknown;
  const body = ready ? buildCalculateBody(configurator, state) : null;
  const price = useLivePrice(body);
  const priced = price.data?.steps.find((step) => step.quantity === state.quantity && step.instant) ?? null;
  const gap = price.data?.target?.steps.find((step) => step.quantity === state.quantity) ?? null;

  const advisor = useAdvisor(configurator);
  const load = loadOf(state.load);
  const sizeOk = Object.keys(problems).length === 0;
  const materialGroup = groupsOf(configurator).find((group) => group.kind === "material");
  // The advisor needs a box it can price; it swaps the board itself, so any offered one starts it.
  const advisorReady = load !== null && sizeOk && state.quantities.length > 0 && materialGroup !== undefined;
  const recommend = () => {
    if (!load || !materialGroup) return;
    const material = state.choices.material?.[0] ?? materialGroup.options[0]!.id;
    advisor.recommend.mutate({ load, state: { ...state, choices: { ...state.choices, material: [material] } } });
  };
  const chooseBoard = async (option: AdvisorOption) => {
    const recommendation = advisor.recommend.data;
    if (!recommendation) return;
    await advisor.choose.mutateAsync({ recommendationId: recommendation.id, option });
    update({
      choices: { ...state.choices, material: [option.board.id] },
      advisory: { recommendationId: recommendation.id, boardId: option.board.id },
    });
  };

  const reseed = (quote: SavedQuote) =>
    setState((previous) => ({
      ...initialState(
        configurator,
        seedFromConfiguration(configurator, (quote.configuration ?? {}) as Record<string, unknown>, {
          quantity: quote.options[0]?.quantity,
          target: quote.targetPricePerUnit,
        }),
      ),
      unit: previous.unit,
      postcode: previous.postcode,
      load: previous.load,
      designOption: previous.designOption,
    }));

  const actions = useQuoteActions({
    configurator,
    state,
    productName: name,
    signedIn: session,
    requestSignIn,
    anonymousId: advisor.anonymousId,
    onLeverApplied: reseed,
  });
  const drafts = useDraft({
    configurator,
    state,
    title: name,
    signedIn: session,
    requestSignIn,
    initial: resumed,
  });

  /**
   * D-183: the display unit is the customer's preference, kept on their profile when signed in. A
   * guest's last choice is remembered in this browser only (U5.1 §1) — a convenience, never data.
   */
  const changeUnit = (next: LengthUnit) => {
    update({ unit: next });
    if (session)
      void browserApi()
        .PATCH("/v1/store/me/preferences", { body: { displayUnit: next } })
        .catch(() => undefined);
    else guestUnit(next);
  };
  const guestUnitRead = useRef(false);
  useEffect(() => {
    if (session || guestUnitRead.current) return;
    guestUnitRead.current = true;
    const remembered = guestUnit();
    if (!remembered) return;
    // Read after hydration: the server cannot see this browser's choice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => (previous.unit === remembered ? previous : { ...previous, unit: remembered }));
  }, [session]);

  // D-102: the funnel's "configure" step, once per visit; "quote shown" when a price arrives.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("configurator_opened", { route: "/configure/[slug]", productType: configurator.productTypeCode });
  }, [configurator.productTypeCode]);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!priced) return;
    const band = quantityBand(priced.quantity);
    if (shownFor.current === band) return;
    shownFor.current = band;
    // Once per band, so typing a quantity does not send a quote per keystroke; packio-api takes the
    // exact quantity and bands it itself.
    track("quote_shown", {
      route: "/configure/[slug]",
      productType: configurator.productTypeCode,
      quantity: priced.quantity,
      quoteMode: "instant",
    });
  }, [priced, configurator.productTypeCode]);

  /* -------------------------------------------------------------------- step summaries */

  const byId = optionsById(configurator);
  const kind = sizeKindOf(configurator);
  const pattern = patternOf(configurator, state);
  const sizeSummary = (() => {
    const dims = axesOf(configurator, state)
      .map((axis) => state.dims[axis])
      .filter((value): value is number => value !== null)
      .map((value) => format.number(value))
      .join(" × ");
    return [
      pattern ? [pattern.name, pattern.styleCode].filter(Boolean).join(" ") : null,
      dims ? `${dims} ${t("size.units.mm")}` : null,
      dims && state.basis && kind === "box" ? t(`size.bases.${state.basis}.label`) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  })();
  const choiceSummary = (step: StepKey) => {
    const chosen = groupsIn(configurator, step)
      .flatMap((group) => state.choices[group.kind] ?? [])
      .map((id) => byId.get(id))
      .filter((option) => option !== undefined)
      .map((option) => pick(locale, option.nameTh, option.nameEn));
    return [...new Set(chosen)].join(", ");
  };
  const loadSummary = load
    ? t("logistics.summary", {
        weight: format.number(load.productWeightG),
        units: format.number(load.unitsPerBox),
        layers: format.number(load.stackLayers),
      })
    : undefined;

  const statusOf = (step: StepKey): StepStatus => {
    const own = ((): StepStatus => {
      if (step === "size") return sizeOk ? "complete" : state.basis === null ? "upcoming" : "error";
      if (step === "logistics") return load ? "complete" : "upcoming";
      if (["material", "printing", "finishing", "assembly"].includes(step)) {
        const groups = groupsIn(configurator, step);
        if (groups.some((group) => missingGroups.includes(group))) return "upcoming";
        if (missingArea.some((option) => groups.some((group) => group.options.includes(option)))) return "error";
        return "complete";
      }
      if (step === "delivery")
        return state.postcode === "" ? "upcoming" : POSTCODE.test(state.postcode) ? "complete" : "error";
      // A product without a default quantity (packio-api's may have none) starts with this step open.
      if (step === "quantity")
        return state.target !== "" && !TARGET.test(state.target)
          ? "error"
          : state.quantities.length === 0
            ? "upcoming"
            : "complete";
      if (step === "summary") return ready ? "complete" : "upcoming";
      return "complete";
    })();
    if (step !== current) return own;
    return own === "error" ? "error" : "current";
  };

  const summaryOf = (step: StepKey): string | undefined => {
    switch (step) {
      case "size":
        return sizeSummary || undefined;
      case "logistics":
        return loadSummary;
      case "quantity":
        if (state.quantities.length === 0) return undefined;
        return [
          t("quantity.summary", { quantity: format.number(state.quantity), unit, tiers: state.quantities.length }),
          TARGET.test(state.target) ? t("quantity.targetSummary", { target: format.thb(state.target), unit }) : null,
        ]
          .filter(Boolean)
          .join(" · ");
      case "delivery":
        return state.postcode || undefined;
      case "design":
        return t(`design.options.${state.designOption}.label`);
      case "summary":
        return undefined;
      default:
        return choiceSummary(step) || undefined;
    }
  };

  const next = (step: StepKey) => steps[steps.indexOf(step) + 1];
  const nextButton = (step: StepKey) => {
    const following = next(step);
    return following ? (
      <button
        type="button"
        onClick={() => setCurrent(following)}
        className="text-primary mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("next", { step: t(`steps.${following}`) })}
      </button>
    ) : null;
  };

  const materialName = (() => {
    const material = state.choices.material?.[0] ? byId.get(state.choices.material[0]) : undefined;
    return material ? pick(locale, material.nameTh, material.nameEn) : null;
  })();

  const contentOf = (step: StepKey): React.ReactNode => {
    switch (step) {
      case "size":
        return (
          <SizeStep
            configurator={configurator}
            state={state}
            onChange={update}
            onUnitChange={changeUnit}
            bases={bases}
            conversion={conversion}
            materialName={materialName}
          />
        );
      case "logistics":
        return <LogisticsStep load={state.load} onChange={update} />;
      case "material":
      case "printing":
      case "finishing":
      case "assembly":
        return (
          <div className="flex flex-col gap-5">
            {step === "material" && advisorOn && method.data ? (
              <AdvisorPanel
                method={method.data}
                ready={advisorReady}
                recommendation={advisor.recommend.data ?? null}
                recommending={advisor.recommend.isPending}
                recommendError={advisor.recommend.error}
                onRecommend={recommend}
                onEditLoad={() => setCurrent("logistics")}
                chosenBoardId={state.advisory?.boardId ?? null}
                onChoose={chooseBoard}
                choosing={advisor.choose.isPending}
                rfqHref={rfqHref}
              />
            ) : null}
            <ChoicesStep
              configurator={configurator}
              groups={groupsIn(configurator, step)}
              state={state}
              onChange={update}
              missing={new Set(missingGroups.map((group) => group.kind))}
            />
          </div>
        );
      case "quantity":
        return <QuantityStep configurator={configurator} state={state} onChange={update} unit={unit} />;
      case "delivery":
        return <DeliveryStep state={state} onChange={update} />;
      case "design":
        return (
          <DesignStep
            configurator={configurator}
            state={state}
            onChange={update}
            designerAvailable={boxStyleOf(configurator, state) !== null}
          />
        );
      case "summary":
        return (
          <SummaryStep
            sections={steps
              .filter((section) => section !== "summary")
              .map((section) => ({
                step: section,
                label: t(`steps.${section}`),
                summary: summaryOf(section),
                status: statusOf(section) === "current" ? "complete" : statusOf(section),
              }))}
            onEdit={setCurrent}
            pattern={pattern}
            priced={priced}
            unit={unit}
            draft={drafts.draft}
            draftBusy={drafts.busy}
            onDraft={drafts.run}
          />
        );
    }
  };

  /* ------------------------------------------------------------------------- the dock */

  const missing = [
    ...(problems.basis ? [t("missing.basis")] : []),
    ...(conversion.caliperUnknown ? [t("missing.caliper")] : []),
    ...(Object.keys(problems).some((key) => key !== "basis") ? [t("missing.size")] : []),
    ...missingGroups.map((group) => t(`choices.groups.${group.kind}`)),
    ...missingArea.map((option) => t("missing.area", { name: pick(locale, option.nameTh, option.nameEn) })),
    ...(state.quantities.length === 0 ? [t("missing.quantity")] : []),
    ...(state.target !== "" && !TARGET.test(state.target) ? [t("missing.target")] : []),
  ];
  const style = boxStyleOf(configurator, state);
  // The designer draws the inside size (F4): as entered, or as the API converted it.
  const inside = isConverted(state.basis) ? conversion.internal : state.basis === "internal" ? state.dims : null;
  const designHref =
    style && configurator.design.options.includes("online_designer") && inside?.l && inside.w && inside.d
      ? studioHref({
          style,
          dims: { l: inside.l, w: inside.w, h: inside.d },
          product: configurator.slug,
          material: state.choices.material?.[0] ?? null,
          step: "design",
        })
      : null;
  const facts = [
    ...(sizeSummary ? [{ label: t("steps.size"), value: sizeSummary }] : []),
    ...(["material", "printing", "finishing", "assembly"] as const).flatMap((step) => {
      const value = choiceSummary(step);
      return value ? [{ label: t(`steps.${step}`), value }] : [];
    }),
    ...(state.quantities.length > 0
      ? [{ label: t("steps.quantity"), value: `${format.number(state.quantity)} ${unit}` }]
      : []),
    ...(priced ? [{ label: t("dock.title"), value: format.thb(priced.grossAmount) }] : []),
  ];
  const lineHref = lineOaId
    ? lineChatUrl(lineOaId, configurationSummary(t("lineMessage", { name }), facts, pageUrl))
    : null;
  // The calculation that routed this configuration to RFQ travels with it (D-102, `routedFrom`).
  const calculationId = price.data?.calculationId;
  const rfqHref = `${rfqPath}?from=${encodeURIComponent(configurator.slug)}${calculationId ? `&calc=${calculationId}` : ""}`;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <ConfiguratorPreview configurator={configurator} state={state} productName={name} />
        <Stepper
          aria-label={t("stepsLabel")}
          headingLevel={2}
          current={current}
          onSelect={(id) => {
            setCurrent(id as StepKey);
            track("configuration_changed", { route: "/configure/[slug]", productType: configurator.productTypeCode });
          }}
          labels={{
            complete: t("stepper.complete"),
            error: t("stepper.error"),
            stepOf: (index, total) => t("stepper.stepOf", { index, total }),
          }}
          steps={steps.map((step) => ({
            id: step,
            label: t(`steps.${step}`),
            summary: summaryOf(step),
            status: statusOf(step),
            content: (
              <>
                {contentOf(step)}
                {nextButton(step)}
              </>
            ),
          }))}
        />
        {gap && TARGET.test(state.target) ? (
          <TargetPanel
            configurator={configurator}
            target={state.target}
            gap={gap}
            unit={unit}
            levers={actions.levers}
            onShowLevers={() => actions.run("levers")}
            onApply={(lever) => void actions.applyLever(lever)}
            onSendToCs={(notes) => actions.run("sendToCs", notes)}
            busy={actions.busy === "levers" || actions.busy === "sendToCs"}
          />
        ) : null}
        <QuoteDockSpacer />
      </div>

      <ConfiguratorDock
        configurator={configurator}
        state={state}
        unit={unit}
        gap={gap}
        onSelectQuantity={(quantity) => update({ quantity })}
        missing={missing}
        steps={price.data?.steps}
        loading={price.isLoading || (ready && !price.data)}
        pending={price.pending}
        failed={price.isError}
        onRetry={() => void price.refetch()}
        onAction={actions.run}
        busy={actions.busy}
        lastQuote={actions.lastQuote}
        rfqHref={rfqHref}
        designHref={designHref}
        lineHref={lineHref}
      />

      {signIn.open || signIn.then ? (
        <SignInSheet
          open={signIn.open}
          onOpenChange={(open) => setSignIn((currentSignIn) => ({ open, then: open ? currentSignIn.then : null }))}
          onSignedIn={() => {
            const then = signIn.then;
            setSignIn({ open: false, then: null });
            setSession(true);
            // Server components read the session cookie (the header's account control).
            router.refresh();
            then?.();
          }}
        />
      ) : null}
    </div>
  );
}

const GUEST_UNIT_KEY = "packio.displayUnit";

/** A guest's display unit in this browser: remembers `next` when given, returns what is kept. */
function guestUnit(next?: LengthUnit): LengthUnit | null {
  try {
    if (next) window.localStorage.setItem(GUEST_UNIT_KEY, next);
    const value = window.localStorage.getItem(GUEST_UNIT_KEY);
    return value === "mm" || value === "cm" || value === "in" ? value : null;
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
    return null;
  }
}
