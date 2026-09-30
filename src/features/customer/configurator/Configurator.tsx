"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { QuoteDockSpacer } from "@/ui/components/QuoteDock";
import { Skeleton } from "@/ui/components/Skeleton";
import { Stepper, type StepStatus } from "@/ui/components/Stepper";

import { quantityBand } from "../analytics/bands";
import { buildCalculateBody } from "./build";
import { ConfiguratorDock } from "./ConfiguratorDock";
import { boxStyleOf, ConfiguratorPreview } from "./ConfiguratorPreview";
import { configurationSummary, lineChatUrl } from "./line";
import { useLivePrice } from "./pricing";
import { SizeStep } from "./SizeStep";
import {
  groupsIn,
  initialState,
  missingAreas,
  missingChoices,
  patternOf,
  POSTCODE,
  readyToPrice,
  sizeProblems,
  stepsOf,
  type Configurator as ConfiguratorData,
  type ConfiguratorState,
  type StepKey,
} from "./state";
import { useQuoteActions } from "./useQuoteActions";

/*
 * Only the first step is in the initial load; the others arrive when first opened (they are a
 * click away, and the configurator is an app-type page with a 200 KB budget,
 * docs/performance-budgets.md).
 */
const stepLoading = () => <Skeleton className="h-24 w-full" />;
const ChoicesStep = dynamic(() => import("./ChoicesStep").then((module) => module.ChoicesStep), {
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

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((module) => module.SignInSheet), {
  ssr: false,
});

export interface ConfiguratorProps {
  configurator: ConfiguratorData;
  productName: { th: string; en: string };
  signedIn: boolean;
  lineOaId: string | null;
  /** A shared or saved quotation reopened here: its answers become the starting point. */
  seed?: Partial<ConfiguratorState>;
  /** The RFQ form for this product's category. */
  rfqPath: string;
  /** This page's canonical address, for the link in a LINE message. */
  pageUrl: string;
}

/**
 * The configurator (F3 3.2): an adaptive stepper — the steps this product has, and no others —
 * beside a live preview and the instant-quote dock.
 *
 * Every change re-prices after a pause (`useLivePrice`); nothing is computed here. The steps can
 * be opened in any order, and a closed step shows its answer, so the configuration reads as one
 * summary from top to bottom.
 */
export function Configurator({
  configurator,
  productName,
  signedIn,
  lineOaId,
  seed,
  rfqPath,
  pageUrl,
}: ConfiguratorProps) {
  const t = useTranslations("configurator");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [state, setState] = useState(() => initialState(configurator, seed));
  const steps = useMemo(() => stepsOf(configurator), [configurator]);
  const [current, setCurrent] = useState<StepKey>(steps[0]!);
  const [session, setSession] = useState(signedIn);
  const [signIn, setSignIn] = useState<{ open: boolean; then: (() => void) | null }>({ open: false, then: null });
  const name = pick(locale, productName.th, productName.en);

  const update = (patch: Partial<ConfiguratorState>) => setState((previous) => ({ ...previous, ...patch }));

  const problems = sizeProblems(configurator, state);
  const missingGroups = missingChoices(configurator, state);
  const missingArea = missingAreas(configurator, state);
  const ready = readyToPrice(configurator, state);
  const body = ready ? buildCalculateBody(configurator, state) : null;
  const price = useLivePrice(body);

  const actions = useQuoteActions({
    configurator,
    state,
    productName: name,
    signedIn: session,
    requestSignIn: (then) => setSignIn({ open: true, then }),
  });

  // D-102: the funnel's "configure" step, once per visit; "quote shown" when a price arrives.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("configurator_opened", { route: "/configure/[slug]", productType: configurator.productTypeCode });
  }, [configurator.productTypeCode]);
  const shownFor = useRef<string | null>(null);
  const priced = price.data?.steps.find((step) => step.quantity === state.quantity && step.instant);
  useEffect(() => {
    if (!priced) return;
    const band = quantityBand(priced.quantity);
    if (shownFor.current === band) return;
    shownFor.current = band;
    track("quote_shown", {
      route: "/configure/[slug]",
      productType: configurator.productTypeCode,
      quantityBand: band,
      quoteMode: "instant",
    });
  }, [priced, configurator.productTypeCode]);

  /* -------------------------------------------------------------------- step summaries */

  const byId = new Map(configurator.groups.flatMap((group) => group.options.map((option) => [option.id, option])));
  const sizeSummary = (() => {
    const pattern = patternOf(configurator, state);
    const dims = [state.dims.l, state.dims.w, configurator.size.kind === "box" ? state.dims.d : null]
      .filter((value): value is number => value !== null)
      .map((value) => format.number(value))
      .join(" × ");
    return [
      pattern && configurator.size.patterns.length > 1 ? pattern.name : null,
      dims ? `${dims} ${t("size.units.mm")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  })();
  const choiceSummary = (step: StepKey) =>
    groupsIn(configurator, step)
      .flatMap((group) => state.choices[group.kind] ?? [])
      .map((id) => byId.get(id))
      .filter((option) => option !== undefined)
      .map((option) => pick(locale, option.nameTh, option.nameEn))
      .join(", ");

  const statusOf = (step: StepKey): StepStatus => {
    if (step === current) return Object.keys(problems).length > 0 && step === "size" ? "error" : "current";
    if (step === "size") return Object.keys(problems).length > 0 ? "error" : "complete";
    if (["material", "printing", "finishing", "assembly"].includes(step)) {
      const groups = groupsIn(configurator, step);
      if (groups.some((group) => missingGroups.includes(group))) return "upcoming";
      if (missingArea.some((option) => groups.some((group) => group.options.includes(option)))) return "error";
      return "complete";
    }
    if (step === "delivery")
      return state.postcode === "" ? "upcoming" : POSTCODE.test(state.postcode) ? "complete" : "error";
    return "complete";
  };

  const next = (step: StepKey) => {
    const index = steps.indexOf(step);
    return steps[index + 1];
  };
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

  const contentOf = (step: StepKey): React.ReactNode => {
    switch (step) {
      case "size":
        return <SizeStep configurator={configurator} state={state} onChange={update} />;
      case "material":
      case "printing":
      case "finishing":
      case "assembly":
        return (
          <ChoicesStep
            groups={groupsIn(configurator, step)}
            state={state}
            onChange={update}
            missing={new Set(missingGroups.map((group) => group.kind))}
          />
        );
      case "quantity":
        return <QuantityStep configurator={configurator} state={state} onChange={update} />;
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
    }
  };

  const summaryOf = (step: StepKey): string | undefined => {
    switch (step) {
      case "size":
        return sizeSummary || undefined;
      case "quantity":
        return t("quantity.summary", {
          quantity: format.number(state.quantity),
          unit: configurator.unit,
          tiers: state.quantities.length,
        });
      case "delivery":
        return state.postcode || undefined;
      case "design":
        return t(`design.options.${state.designOption}.label`);
      default:
        return choiceSummary(step) || undefined;
    }
  };

  /* ------------------------------------------------------------------------- the dock */

  const missing = [
    ...(Object.keys(problems).length > 0 ? [t("missing.size")] : []),
    ...missingGroups.map((group) => pick(locale, group.nameTh, group.nameEn)),
    ...missingArea.map((option) => t("missing.area", { name: pick(locale, option.nameTh, option.nameEn) })),
  ];
  const style = boxStyleOf(configurator, state);
  const designHref =
    style && configurator.design.options.includes("online_designer") && state.dims.l && state.dims.w && state.dims.d
      ? `/design/new?style=${style}&l=${state.dims.l}&w=${state.dims.w}&h=${state.dims.d}&product=${encodeURIComponent(configurator.slug)}`
      : null;
  const facts = [
    ...(sizeSummary ? [{ label: t("steps.size"), value: sizeSummary }] : []),
    ...(["material", "printing", "finishing", "assembly"] as const).flatMap((step) => {
      const value = choiceSummary(step);
      return value ? [{ label: t(`steps.${step}`), value }] : [];
    }),
    { label: t("steps.quantity"), value: `${format.number(state.quantity)} ${configurator.unit}` },
    ...(priced ? [{ label: t("dock.title"), value: format.thb(priced.grossAmount) }] : []),
  ];
  const lineHref = lineOaId
    ? lineChatUrl(lineOaId, configurationSummary(t("lineMessage", { name }), facts, pageUrl))
    : null;
  const rfqHref = `${rfqPath}?from=${encodeURIComponent(configurator.slug)}`;

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
        <QuoteDockSpacer />
      </div>

      <ConfiguratorDock
        configurator={configurator}
        state={state}
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
