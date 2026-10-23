"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { useFormat } from "@/features/shared/format/useFormat";
import { useProblemCopy } from "@/features/shared/actions/useProblemCopy";
import { Link } from "@/i18n/navigation";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Sheet } from "@/ui/components/Sheet";
import { cn } from "@/ui/lib/cn";

import type { AdvisorMethod, AdvisorOption, Recommendation } from "./advisor";

export interface AdvisorPanelProps {
  method: AdvisorMethod;
  /** Every required load answer is in and the box can be priced. */
  ready: boolean;
  recommendation: Recommendation | null;
  recommending: boolean;
  recommendError: unknown;
  onRecommend: () => void;
  /** Opens the goods-and-journey step. */
  onEditLoad: () => void;
  /** The board on the configuration now (the material choice). */
  chosenBoardId: string | null;
  /** Takes a board: recorded with its warnings acknowledged, then the material changes and re-prices. */
  onChoose: (option: AdvisorOption) => Promise<void>;
  choosing: boolean;
  rfqHref: string;
}

/**
 * The Structure Advisor's answer (U2.F1 §3, D-239): the recommended board with the factors that
 * shaped it, its estimated strength as a range — "ค่าประมาณ ไม่ใช่การรับประกัน" (D-189) — and up to
 * three alternatives (cheapest, strongest, fastest) with their price and lead-time difference.
 * Every number is the API's; taking a board changes the material and the whole configuration is
 * priced again by the live quote.
 */
export function AdvisorPanel({
  method,
  ready,
  recommendation,
  recommending,
  recommendError,
  onRecommend,
  onEditLoad,
  chosenBoardId,
  onChoose,
  choosing,
  rfqHref,
}: AdvisorPanelProps) {
  const t = useTranslations("configurator.advisor");
  const format = useFormat();
  const locale = useLocale();
  const problemCopy = useProblemCopy();
  const [why, setWhy] = useState(false);
  const [confirming, setConfirming] = useState<AdvisorOption | null>(null);

  if (!method.available) return null;

  const optionOf = (boardId: string | null) =>
    recommendation?.options.find((option) => option.board.id === boardId) ?? null;
  const recommended = optionOf(recommendation?.recommendedBoardId ?? null);
  const closest = optionOf(recommendation?.closestBoardId ?? null);
  const alternatives = (recommendation?.alternatives ?? []).flatMap((alternative) => {
    const option = optionOf(alternative.boardId);
    return option ? [{ alternative, option }] : [];
  });
  const signed = (value: string | null, render: (abs: string) => string) =>
    value === null ? null : value.startsWith("-") ? `−${render(value.slice(1))}` : `+${render(value)}`;
  const take = (option: AdvisorOption) => (option.warnings.length > 0 ? setConfirming(option) : void onChoose(option));

  const card = (option: AdvisorOption, extra?: React.ReactNode, heading?: string) => {
    const chosen = option.board.id === chosenBoardId;
    return (
      <article
        key={option.board.id}
        className={cn(
          "border-border flex flex-col gap-2 rounded-xl border p-3",
          chosen && "border-primary bg-primary-subtle",
        )}
        aria-label={pick(locale, option.board.nameTh, option.board.nameEn)}
      >
        <div className="flex flex-wrap items-center gap-2">
          {heading ? <span className="text-muted text-xs font-medium">{heading}</span> : null}
          {option.roles
            .filter((role) => role !== "recommended" || !heading)
            .map((role) => (
              <Badge key={role} tone={role === "recommended" ? "success" : "neutral"} size="sm">
                {t(`roles.${role}`)}
              </Badge>
            ))}
        </div>
        <p className="font-semibold">{pick(locale, option.board.nameTh, option.board.nameEn)}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-muted">{t("strength")}</dt>
          <dd className="tabular-nums">
            {t("strengthRange", { low: format.number(option.bct.low), high: format.number(option.bct.high) })}
          </dd>
          <dt className="text-muted">{t("needed")}</dt>
          <dd className="tabular-nums">
            {t("strengthNeeded", { required: format.number(recommendation!.requirement.requiredBctN) })}
          </dd>
          {option.unitPrice ? (
            <>
              <dt className="text-muted">{t("price")}</dt>
              <dd className="tabular-nums">{t("perPiece", { price: format.thb(option.unitPrice) })}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted">{t("price")}</dt>
              <dd>{t("noInstantPrice")}</dd>
            </>
          )}
          {option.leadTimeDays !== null ? (
            <>
              <dt className="text-muted">{t("leadTime")}</dt>
              <dd>{t("days", { days: option.leadTimeDays })}</dd>
            </>
          ) : null}
        </dl>
        {extra}
        {option.warnings.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {option.warnings.map((warning) => (
              <li key={warning} className="text-warning-subtle-fg text-xs font-medium">
                {t(`warnings.${warning}`)}
              </li>
            ))}
          </ul>
        ) : null}
        {chosen ? (
          <p className="text-primary text-sm font-medium">{t("chosen")}</p>
        ) : option.unitPrice ? (
          <Button size="sm" variant="secondary" onClick={() => take(option)} loading={choosing}>
            {t("useBoard")}
          </Button>
        ) : null}
      </article>
    );
  };

  return (
    <section
      aria-labelledby="advisor-title"
      className="bg-surface border-border flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="advisor-title" className="font-semibold">
          {t("title")}
        </h3>
        {recommendation ? (
          <Button size="sm" variant="ghost" iconStart="info" onClick={() => setWhy(true)}>
            {t("why")}
          </Button>
        ) : null}
      </div>

      {!ready ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted text-sm">{t("needLoad")}</p>
          <Button size="sm" variant="secondary" onClick={onEditLoad}>
            {t("editLoad")}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant={recommendation ? "ghost" : "secondary"}
          iconStart="refresh"
          loading={recommending}
          onClick={onRecommend}
          className="self-start"
        >
          {recommendation ? t("refresh") : t("recommend")}
        </Button>
      )}

      {recommendError ? (
        <Callout tone="danger" live>
          {problemCopy(recommendError)?.title ?? t("failed")}
        </Callout>
      ) : null}

      {recommendation ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-muted text-xs">{t(`notices.${recommendation.noticeCode.replaceAll(".", "_")}`)}</p>
          {recommended ? (
            card(
              recommended,
              <ul className="flex flex-wrap gap-1.5" aria-label={t("reasonsLabel")}>
                {recommendation.reasons.map((reason, index) => (
                  <li key={`${reason.code}-${index}`}>
                    <Badge tone="info" size="sm">
                      {reason.factor
                        ? t("reasonFactor", {
                            factor: t(`factors.${reason.factor}`),
                            band: t.has(`bands.${reason.band}`) ? t(`bands.${reason.band}`) : (reason.band ?? ""),
                          })
                        : t.has(`reasons.${reason.code}`)
                          ? t(`reasons.${reason.code}`)
                          : reason.code}
                    </Badge>
                  </li>
                ))}
              </ul>,
              t("recommended"),
            )
          ) : (
            <Callout tone="warning" title={t("noBoardTitle")}>
              <p>{t("noBoardBody")}</p>
              <Button size="sm" variant="secondary" asChild className="mt-2">
                <Link href={rfqHref}>{t("askSales")}</Link>
              </Button>
            </Callout>
          )}
          {!recommended && closest ? card(closest, undefined, t("closest")) : null}
          {alternatives.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">{t("alternatives")}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {alternatives.map(({ alternative, option }) =>
                  card(
                    option,
                    <p className="text-muted text-xs tabular-nums">
                      {[
                        signed(alternative.unitPriceDelta, (abs) => t("priceDelta", { amount: format.thb(abs) })),
                        alternative.leadTimeDeltaDays === null
                          ? null
                          : t("leadDelta", {
                              delta:
                                alternative.leadTimeDeltaDays > 0
                                  ? `+${alternative.leadTimeDeltaDays}`
                                  : alternative.leadTimeDeltaDays < 0
                                    ? `−${-alternative.leadTimeDeltaDays}`
                                    : "±0",
                            }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>,
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {recommendation ? (
        <Sheet
          open={why}
          onOpenChange={setWhy}
          title={t("whyTitle")}
          description={t(`notices.${recommendation.noticeCode.replaceAll(".", "_")}`)}
          closeLabel={t("close")}
        >
          <WhyAdvised recommendation={recommendation} method={method} />
        </Sheet>
      ) : null}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => (open ? undefined : setConfirming(null))}
        title={t("acknowledgeTitle")}
        description={
          <span className="flex flex-col gap-1">
            {confirming?.warnings.map((warning) => (
              <span key={warning}>{t(`warnings.${warning}`)}</span>
            ))}
            <span>{t("acknowledgeBody")}</span>
          </span>
        }
        confirmLabel={t("acknowledge")}
        cancelLabel={t("cancel")}
        loading={choosing}
        onConfirm={() => {
          const option = confirming;
          if (!option) return;
          void onChoose(option).finally(() => setConfirming(null));
        }}
      />
    </section>
  );
}

/** "ทำไมถึงแนะนำแบบนี้": the load, the factors and their effect, and the method — all as the API logged them. */
function WhyAdvised({ recommendation, method }: { recommendation: Recommendation; method: AdvisorMethod }) {
  const t = useTranslations("configurator.advisor");
  const format = useFormat();
  const { requirement } = recommendation;
  const rows: [string, string][] = [
    [t("whyRows.layers"), format.number(requirement.layers)],
    [t("whyRows.boxWeight"), t("kg", { value: format.number(requirement.boxWeightKg) })],
    [t("whyRows.tare"), t("kg", { value: format.number(requirement.tareKg) })],
    [t("whyRows.load"), t("newtons", { value: format.number(requirement.loadN) })],
    [t("whyRows.perimeter"), t("mm", { value: format.number(requirement.perimeterMm) })],
    [t("whyRows.combined"), format.number(requirement.combinedFactor)],
    [t("whyRows.required"), t("newtons", { value: format.number(requirement.requiredBctN) })],
  ];
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>{t("whyIntro")}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-end tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="font-medium">{t("whyFactors")}</h4>
        <ul className="mt-1 flex flex-col gap-1">
          {requirement.factors.map((factor) => (
            <li key={factor.factor} className="flex justify-between gap-3">
              <span>
                {t(`factors.${factor.factor}`)} —{" "}
                {t.has(`bands.${factor.band}`) ? t(`bands.${factor.band}`) : factor.band}
              </span>
              <span className="tabular-nums">× {format.number(factor.value)}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-1 text-xs">{t("whyFactorsNote")}</p>
      </div>
      <p className="text-muted text-xs">
        {t("whyMethod", {
          version: recommendation.ruleSetVersion.versionNo,
          engine: recommendation.engineVersion,
        })}
        {method.ruleSetVersion
          ? ` · ${t("whyEffective", { date: format.date(method.ruleSetVersion.effectiveFrom) })}`
          : ""}
      </p>
    </div>
  );
}
