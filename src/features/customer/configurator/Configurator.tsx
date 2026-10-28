"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { specLabelText } from "@/features/shared/spec-label";
import { useRouter } from "@/i18n/navigation";
import { trackConfigurator } from "@/lib/analytics/configurator";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import type { LengthUnit } from "@/ui/components/DimensionInput";
import { Skeleton } from "@/ui/components/Skeleton";
import { StepCard } from "@/ui/components/StepCard";
import { scrollToStep, StepChips, type StepChip } from "@/ui/components/StepChips";
import type { StepStatus } from "@/ui/components/Stepper";

import { quantityBand } from "../analytics/bands";
import { loadOf, useAdvisor, useAdvisorMethod, type AdvisorOption } from "./advisor";
import { buildCalculateBody, seedFromConfiguration } from "./build";
import { isDefaultStep } from "./step-defaults";
import { ConfiguratorDock } from "./ConfiguratorDock";
import { boxStyleOf, ConfiguratorPreview } from "./ConfiguratorPreview";
import { useConversion, usePatternBases } from "./conversion";
import { configurationSummary, lineChatUrl } from "./line";
import { basesOf, groupsOf, isProcessInk, optionsById, sizeKindOf } from "./model";
import { isCorrugate, refusedSide } from "./print-model";
import { isApiError } from "@/lib/api/problem";
import { useOptionPrices } from "./option-prices";
import { useChangeTracker } from "./tracking";
import { queryOf, searchWith } from "./url-state";
import { PRICE_DEBOUNCE_MS, useLivePrice } from "./pricing";
import { rememberedPostcode, usePostcodeArea } from "./postcode";
import { PromoCode } from "./PromoCode";
import { PreviewSide, type PreviewDimensions } from "./PreviewSide";
import { SizeStep } from "./SizeStep";
import {
  axesOf,
  designOptionOf,
  groupsIn,
  initialState,
  isConverted,
  missingAreas,
  missingChoices,
  partsOf,
  patternOf,
  POSTCODE,
  printOfPart,
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
// The sample request (T5) loads only when asked for, so the configurator's script stays in budget.
const RequestSampleDialog = dynamic(() =>
  import("@/features/customer/samples/RequestSample").then((module) => module.RequestSampleDialog),
);
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
  /**
   * Keep the configuration in the address (a refresh, or a link copied from the bar, comes back to it). Off
   * when a draft, a saved or shared quotation is open: that is what a refresh reopens.
   */
  syncUrl?: boolean;
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
  syncUrl = false,
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

  // Steps the customer changed or confirmed; a draft, shared or saved configuration is theirs already.
  const [touched, setTouched] = useState<ReadonlySet<StepKey>>(() =>
    seed?.choices || resumed ? new Set(steps) : new Set(),
  );
  const touch = (step: StepKey) =>
    setTouched((previous) => (previous.has(step) ? previous : new Set(previous).add(step)));
  const update = (patch: Partial<ConfiguratorState>, step?: StepKey) => {
    if (step) touch(step);
    // One customer action, one analytics event (the cards' `delta` is the API's, read from the batch answer).
    report(state, { ...state, ...patch }, optionPrices);
    setState((previous) => ({ ...previous, ...patch }));
  };
  /** A step's own changes mark it as the customer's (it stops reading "ค่าเริ่มต้น"). */
  const updateIn = (step: StepKey) => (patch: Partial<ConfiguratorState>) => update(patch, step);

  // D-182: the bases this pattern is measured on, as the API's conversion knows its construction.
  // A style the API builds flat is measured on its finished size only, so that is its basis; a
  // basis this pattern is not measured on is not an answer.
  const patternBases = usePatternBases(configurator, patternOf(configurator, entered)?.id ?? null);
  const bases = patternBases ?? basesOf(configurator);
  const flatStyle = patternBases?.length === 1 && patternBases[0] === "product";
  // The online designer draws only the patterns `@getpack/dieline` knows (or the design attached).
  const designerAvailable = boxStyleOf(configurator, entered) !== null || !!entered.designDocumentId;
  const state: ConfiguratorState = {
    ...entered,
    flatStyle,
    basis: flatStyle ? "product" : entered.basis && bases.includes(entered.basis) ? entered.basis : null,
    designOption: designOptionOf(configurator, entered.designOption, designerAvailable),
  };

  const conversion = useConversion(configurator, state);
  const problems = sizeProblems(configurator, state, conversion.internal);
  const missingGroups = missingChoices(configurator, state);
  const missingArea = missingAreas(configurator, state);
  const ready = readyToPrice(configurator, state, conversion.internal) && !conversion.caliperUnknown;
  const body = ready ? buildCalculateBody(configurator, state) : null;
  const price = useLivePrice(body);
  // The option cards' prices: one batch request per settled state change (never one per card).
  const optionPrices = useOptionPrices(configurator, state, ready);
  // 422 `pricing.print_combination_invalid`: one readable line per refused side, never a crash.
  const refusal =
    isApiError(price.error) && price.error.code === "pricing.print_combination_invalid" ? price.error : null;
  const refusedLines = refusal
    ? (() => {
        const lines = refusal.errors.flatMap((entry) => {
          const side = refusedSide(entry.path ?? "");
          if (!side) return [];
          const reason = t.has(`printProblem.${entry.code}`)
            ? t(`printProblem.${entry.code}`)
            : t("printProblem.other");
          return [t("printProblem.side", { side: t(`printProblem.${side}`), reason })];
        });
        return lines.length > 0 ? lines : [t("printProblem.other")];
      })()
    : null;
  const priced = price.data?.steps.find((step) => step.quantity === state.quantity && step.instant) ?? null;
  const pricedSpec = specLabelText(price.data?.specLabel, locale);
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
    update(
      {
        choices: { ...state.choices, material: [option.board.id] },
        advisory: { recommendationId: recommendation.id, boardId: option.board.id },
      },
      "material",
    );
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
      designDocumentId: previous.designDocumentId,
    }));

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
  /** One side of a corrugate print as the customer chose it ("CMYK", "ดำ", "ไม่พิมพ์"). */
  const printSide = (ids: string[]) => {
    if (ids.length === 0) return t("choices.print.none");
    return ids
      .map((id) => {
        const option = byId.get(id);
        if (!option) return null;
        return isProcessInk(option) ? t("choices.print.cmyk") : pick(locale, option.nameTh, option.nameEn);
      })
      .filter(Boolean)
      .join(" + ");
  };
  /** A corrugate print as the customer chose it: "ด้านนอก: CMYK · ด้านใน: ไม่พิมพ์" (D-443). */
  const printSummary = (print: { print_front: string[]; print_back: string[] }) =>
    t("choices.print.summary", { outside: printSide(print.print_front), inside: printSide(print.print_back) });
  const choiceSummary = (step: StepKey): string => {
    const parts = partsOf(configurator, state);
    if (step === "printing" && isCorrugate(configurator)) {
      const perPart = parts.length > 1 && parts.some((part) => state.partPrints[part.subPatternId]);
      return perPart
        ? parts.map((part) => `${part.name}: ${printSummary(printOfPart(state, part.subPatternId))}`).join(" · ")
        : printSummary(printOfPart(state, undefined));
    }
    if (step === "printing" && parts.some((part) => state.partPrints[part.subPatternId])) {
      const names = (ids: string[]) =>
        ids.flatMap((id) => {
          const option = byId.get(id);
          return option ? [pick(locale, option.nameTh, option.nameEn)] : [];
        });
      return parts
        .map((part) => {
          const print = printOfPart(state, part.subPatternId);
          const colours = [...new Set([...names(print.print_front), ...names(print.print_back)])];
          return `${part.name}: ${colours.join(", ") || t("choices.perPart.blank")}`;
        })
        .join(" · ");
    }
    const chosen = groupsIn(configurator, step)
      .flatMap((group) => state.choices[group.kind] ?? [])
      .map((id) => byId.get(id))
      .filter((option) => option !== undefined)
      .map((option) => pick(locale, option.nameTh, option.nameEn));
    return [...new Set(chosen)].join(", ");
  };
  const actions = useQuoteActions({
    configurator,
    state,
    productName: name,
    signedIn: session,
    requestSignIn,
    anonymousId: advisor.anonymousId,
    onLeverApplied: reseed,
    guest: {
      slug: configurator.slug,
      unit,
      // The API's own words for the spec it priced (B-API-3); never composed here.
      specs: pricedSpec ? [pricedSpec] : [],
      grossAmount: priced?.grossAmount ?? null,
    },
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

  // The delivery postcode is remembered in this browser (the contract has no account setting for it): read
  // after hydration, never over one a draft or a link brought; kept once it is complete.
  const postcodeRead = useRef(false);
  useEffect(() => {
    if (postcodeRead.current) return;
    postcodeRead.current = true;
    const remembered = rememberedPostcode();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (remembered)
      setState((previous) => (previous.postcode === "" ? { ...previous, postcode: remembered } : previous));
  }, []);
  useEffect(() => {
    if (POSTCODE.test(state.postcode)) rememberedPostcode(state.postcode);
  }, [state.postcode]);
  const { area: postcodeArea } = usePostcodeArea(state.postcode);
  const report = useChangeTracker(configurator, state.postcode, postcodeArea?.province.nameEn ?? null);

  // The configuration in the address, after a pause and without a navigation (`history.replaceState` is how the
  // App Router takes a search change without fetching the page again). Defaults are left out; the first render
  // writes nothing, so a link is only rewritten once the customer has changed something.
  const queryKey = JSON.stringify(queryOf(configurator, state));
  const addressSynced = useRef(false);
  useEffect(() => {
    if (!syncUrl) return;
    if (!addressSynced.current) {
      addressSynced.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const next = searchWith(window.location.search, JSON.parse(queryKey) as Record<string, string>);
        if (next === new URLSearchParams(window.location.search).toString()) return;
        const { pathname, hash } = window.location;
        window.history.replaceState(window.history.state, "", `${pathname}${next ? `?${next}` : ""}${hash}`);
      } catch {
        // An address that cannot be written (a sandboxed frame) is only a link that does not follow.
      }
    }, PRICE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [syncUrl, queryKey]);

  // The sticky chip bar's real height, so a step scrolled to lands just under it (and the header).
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    const bar = container?.querySelector<HTMLElement>("[data-step-chips]");
    if (!container || !bar || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      container.style.setProperty("--step-scroll-mt", `calc(var(--site-sticky-top) + ${bar.offsetHeight}px + 1rem)`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // D-102: the funnel's "configure" step, once per visit; "quote shown" when a price arrives.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("configurator_opened", { route: "/configure/[slug]", productType: configurator.productTypeCode });
  }, [configurator.productTypeCode]);
  // The API has no instant price for this size and quantity: counted once per combination (demand it cannot serve).
  const noPriceQuantity =
    price.data?.steps.find((step) => step.quantity === state.quantity && !step.instant)?.quantity ?? null;
  const quoteOnlyShown = useRef<string | null>(null);
  useEffect(() => {
    if (noPriceQuantity === null) return;
    const size = state.sizeMode === "standard" && state.standardSizeCode ? state.standardSizeCode : "custom";
    const key = `${size}:${noPriceQuantity}`;
    if (quoteOnlyShown.current === key) return;
    quoteOnlyShown.current = key;
    trackConfigurator("cfg_quote_only_shown", { size, qty: noPriceQuantity });
  }, [noPriceQuantity, state.sizeMode, state.standardSizeCode]);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!priced) return;
    const band = quantityBand(priced.quantity);
    if (shownFor.current === band) return;
    shownFor.current = band;
    // Once per band, so typing a quantity does not send a quote per keystroke; getpack-api takes the
    // exact quantity and bands it itself.
    track("quote_shown", {
      route: "/configure/[slug]",
      productType: configurator.productTypeCode,
      quantity: priced.quantity,
      quoteMode: "instant",
    });
  }, [priced, configurator.productTypeCode]);

  /* -------------------------------------------------------------------- step summaries */

  const loadSummary = load
    ? t("logistics.summary", {
        weight: format.number(load.productWeightG),
        units: format.number(load.unitsPerBox),
        layers: format.number(load.stackLayers),
      })
    : undefined;

  const ownStatusOf = (step: StepKey): StepStatus => {
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
      // A product without a default quantity (getpack-api's may have none) starts with this step open.
      if (step === "quantity")
        return state.target !== "" && !TARGET.test(state.target)
          ? "error"
          : state.quantities.length === 0
            ? "upcoming"
            : "complete";
      if (step === "summary") return ready ? "complete" : "upcoming";
      return "complete";
    })();
    return own;
  };
  const summaryOf = (step: StepKey): string | undefined => {
    switch (step) {
      case "size":
        if (state.sizeMode === "standard" && configurator.standardSizes.length > 0 && kind === "box")
          return state.quantity > 0
            ? t("size.hintStandard", {
                count: configurator.standardSizes.length,
                quantity: format.number(state.quantity),
                unit,
              })
            : t("size.hintStandardNoPrice", { count: configurator.standardSizes.length });
        return sizeSummary || t("size.hintCustom");
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
            onChange={updateIn("size")}
            onUnitChange={changeUnit}
            bases={bases}
            conversion={conversion}
            materialName={materialName}
            prices={optionPrices}
            unit={unit}
          />
        );
      case "logistics":
        return <LogisticsStep load={state.load} onChange={updateIn("logistics")} />;
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
                onEditLoad={() => scrollToStep(anchorOf("logistics"))}
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
              onChange={updateIn(step)}
              missing={new Set(missingGroups.map((group) => group.kind))}
              prices={optionPrices}
            />
          </div>
        );
      case "quantity":
        return (
          <QuantityStep
            configurator={configurator}
            state={state}
            onChange={updateIn("quantity")}
            unit={unit}
            steps={price.data?.steps}
            pending={price.pending}
          />
        );
      case "delivery":
        return <DeliveryStep state={state} onChange={updateIn("delivery")} priced={priced} />;
      case "design":
        return (
          <DesignStep
            configurator={configurator}
            state={state}
            onChange={updateIn("design")}
            designerAvailable={designerAvailable}
            studioLink={studioLink}
            sample={{
              checked: actions.sampleFor !== null || actions.busy === "sample",
              // A sample is asked for on a kept quotation, so there must be a price to keep.
              disabled: !priced,
              onChange: (on) => {
                trackConfigurator("cfg_sample_toggle", { on });
                if (on) actions.run("sample");
              },
            }}
          />
        );
      case "summary":
        return (
          <SummaryStep
            priced={priced}
            pattern={pattern}
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
  // The Studio on this product: with the inside size once it is known (the box is drawn at once), else on the
  // product, pattern and board alone. It takes nothing of print or quantity (`StudioEntry`).
  const studioLink =
    designerAvailable && configurator.design.options.includes("online_designer")
      ? (designHref ??
        studioHref({
          product: configurator.slug,
          pattern: state.patternId,
          material: state.choices.material?.[0] ?? null,
          step: "start",
        }))
      : null;
  // Once priced, the spec is the API's own label (B-API-3); before that, the answers given so far.
  const facts = [
    ...(pricedSpec
      ? [{ label: t("summary.pricedSpec"), value: pricedSpec }]
      : [
          ...(sizeSummary ? [{ label: t("steps.size"), value: sizeSummary }] : []),
          ...(["material", "printing", "finishing", "assembly"] as const).flatMap((step) => {
            const value = choiceSummary(step);
            return value ? [{ label: t(`steps.${step}`), value }] : [];
          }),
        ]),
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

  /* ------------------------------------------------------------------ the preview's side panel */

  // The API's sizes on every basis: the calculation's, or — while a new price is on its way, or before
  // the first — the conversion's for what is entered now; never composed here.
  const priceDimensions = price.data?.dimensions ?? null;
  const previewDimensions: PreviewDimensions | null =
    (price.pending ? (conversion.converted ?? priceDimensions) : (priceDimensions ?? conversion.converted)) ?? null;
  const previewParts = partsOf(configurator, state);
  const perPartPrint = previewParts.length > 1 && previewParts.some((part) => state.partPrints[part.subPatternId]);
  const previewRows: { label: string; value: string }[] = [
    ...(materialName ? [{ label: t("preview.material"), value: materialName }] : []),
    // A box printed differently per part has no single "outside" to name here: its steps say so.
    ...(perPartPrint
      ? []
      : isCorrugate(configurator)
        ? (() => {
            const print = printOfPart(state, undefined);
            return [
              { label: t("preview.printOutside"), value: printSide(print.print_front) },
              { label: t("preview.printInside"), value: printSide(print.print_back) },
              ...(state.printArea &&
              configurator.printAreas.length > 0 &&
              (print.print_front.length > 0 || print.print_back.length > 0)
                ? [{ label: t("preview.printArea"), value: t(`choices.printAreas.${state.printArea}`) }]
                : []),
            ];
          })()
        : choiceSummary("printing")
          ? [{ label: t("preview.printing"), value: choiceSummary("printing") }]
          : []),
  ];
  const standardSize =
    state.sizeMode === "standard" && state.standardSizeCode
      ? configurator.standardSizes.find((size) => size.code === state.standardSizeCode)
      : undefined;

  const chips: StepChip[] = steps.map((step) => {
    const own = ownStatusOf(step);
    // The summary only reviews, and the shipping-load questions are the advisor's optional input:
    // neither is a to-do that blocks the order.
    const optional = step === "summary" || step === "logistics";
    const state: StepChip["state"] =
      step === "summary"
        ? "idle"
        : own === "complete"
          ? isDefaultStep(step, touched)
            ? "default"
            : "done"
          : optional
            ? "idle"
            : "todo";
    return {
      id: anchorOf(step),
      label: t(`chips.${step}`),
      state,
      stateLabel: t("stepper.defaulted"),
      srLabel: state === "done" ? t("chips.done") : state === "todo" ? t("chips.todo") : undefined,
    };
  });

  // "ครบ 3/6": the steps that ask for an answer (not the summary, not the optional shipping-load
  // questions) with a confirmed one — the same count the chips show as done.
  const counted = chips.filter((chip) => chip.id !== anchorOf("summary") && chip.id !== anchorOf("logistics"));
  const completeness = { done: counted.filter((chip) => chip.state === "done").length, total: counted.length };

  return (
    // The prototype's two columns: the preview, the progress chips and every step on the left, the
    // sticky price summary on the right; one column under 1100 px (summary last, bar at the bottom).
    <div
      ref={root}
      className="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_25rem]"
      style={{ "--step-scroll-mt": "8rem" } as React.CSSProperties}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <ConfiguratorPreview
          configurator={configurator}
          state={state}
          productName={name}
          side={
            <PreviewSide
              title={standardSize?.name ?? t("preview.customSize")}
              dimensions={previewDimensions}
              rows={previewRows}
            />
          }
        />
        <StepChips aria-label={t("stepsLabel")} chips={chips} className="-mx-5 px-5 md:mx-0 md:px-0" />
        {steps.map((step, index) => (
          <StepCard
            key={step}
            id={anchorOf(step)}
            number={index + 1}
            title={step === "summary" ? t("summary.cardTitle") : t(`steps.${step}`)}
            hint={step === "summary" ? undefined : summaryOf(step)}
          >
            {/* Any press inside a step is the customer's answer, even the option already selected. */}
            <div onClickCapture={() => touch(step)}>{contentOf(step)}</div>
          </StepCard>
        ))}
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
      </div>

      <ConfiguratorDock
        configurator={configurator}
        state={state}
        unit={unit}
        gap={gap}
        missing={missing}
        steps={price.data?.steps}
        specLabel={price.data?.specLabel}
        loading={price.isLoading || (ready && !price.data)}
        pending={price.pending}
        failed={price.isError}
        refusal={refusedLines}
        onRetry={() => void price.refetch()}
        onAction={(action) => {
          // The summary's own buttons; the target panel's levers are not counted as a way out.
          const cta = { cart: "cart", save: "save", share: "share", pdf: "pdf", sample: "sample" } as const;
          if (action in cta) trackConfigurator("cfg_cta", { cta: cta[action as keyof typeof cta] });
          actions.run(action);
        }}
        onLink={(cta) => trackConfigurator("cfg_cta", { cta })}
        busy={actions.busy}
        lastQuote={actions.lastQuote}
        rfqHref={rfqHref}
        designHref={designHref}
        lineHref={lineHref}
        completeness={completeness}
        onGoToShipping={() => scrollToStep(anchorOf("delivery"))}
        shippingArea={postcodeArea ? pick(locale, postcodeArea.province.nameTh, postcodeArea.province.nameEn) : null}
        promo={<PromoCode configurator={configurator} state={state} onChange={updateIn("summary")} />}
      />
      {/* Room for the phone bar, so the last field is never under it. */}
      <div aria-hidden className="h-16 min-[1100px]:hidden" />

      {actions.sampleFor ? (
        <RequestSampleDialog
          quoteId={actions.sampleFor}
          open
          onOpenChange={(open) => {
            if (open) return;
            trackConfigurator("cfg_sample_toggle", { on: false });
            actions.closeSample();
          }}
          defaultPostcode={state.postcode}
        />
      ) : null}

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

/** The anchor of a step's card, for the progress chips and every "go to the step" link. */
const anchorOf = (step: StepKey) => `step-${step}`;

const GUEST_UNIT_KEY = "getpack.displayUnit";

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
