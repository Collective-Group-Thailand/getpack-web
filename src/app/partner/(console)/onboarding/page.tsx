import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FACTORY_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ContinueBar, nextStep, StepRail, stepDone } from "@/features/partner/onboarding/StepRail";
import { awaitsSignOff, FACTORY_STAGES } from "@/features/partner/onboarding/steps";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Meter } from "@/ui/components/Meter";
import { Icon } from "@/ui/icons";
import { ProgressTracker, type ProgressState } from "@/ui/components/ProgressTracker";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOnboarding"))("title") };
}

/**
 * The factory's way to activation (D-011, D-041, D-171): where it stands — applied, in review,
 * trial, active — and the thirteen steps, with what getpack entered for it still to sign off.
 */
export default async function OnboardingPage() {
  const [t, tStatus, tToday] = await Promise.all([
    getTranslations("partnerOnboarding"),
    getTranslations("status"),
    getTranslations("partnerToday"),
  ]);
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const steps = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/onboarding-steps", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data ?? [],
  );
  const factory = context.factory;
  const stage = factory ? (FACTORY_STAGES as readonly string[]).indexOf(factory.status) : -1;
  const stateOf = (index: number): ProgressState =>
    stage < 0 ? "upcoming" : index < stage ? "done" : index === stage ? "current" : "upcoming";
  const toSignOff = (steps.data ?? []).filter(awaitsSignOff);

  const rows = steps.data ?? [];
  const next = nextStep(rows);
  const done = rows.filter((step) => stepDone(step) && !awaitsSignOff(step)).length;

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={factory?.onboardingMode === "assisted" ? t("assistedIntro") : t("selfIntro")}
      status={factory ? <StatusChip map={FACTORY_STATUS} value={factory.status} size="md" /> : null}
    >
      {factory && ["suspended", "offboarded"].includes(factory.status) ? (
        <Callout tone="warning" title={tStatus(FACTORY_STATUS[factory.status].labelKey)}>
          {t("inactive")}
        </Callout>
      ) : (
        // Where the factory stands on its way to its first jobs, and how much of the paperwork is behind it.
        <section
          aria-label={t("stagesLabel")}
          className="border-border bg-surface rounded-card flex flex-col gap-5 border p-4 md:p-6"
        >
          <ProgressTracker
            label={t("stagesLabel")}
            stateLabels={{
              done: t("stageState.done"),
              current: t("stageState.current"),
              upcoming: t("stageState.upcoming"),
              skipped: t("stageState.skipped"),
            }}
            stages={FACTORY_STAGES.map((key, index) => ({
              key,
              title: t(`stages.${key}.title`),
              detail: t(`stages.${key}.body`),
              state: stateOf(index),
            }))}
          />
          {factory ? (
            <div className="border-border flex flex-col gap-2 border-t pt-4">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{t("progressLabel")}</span>
                <span className="text-muted text-sm tabular-nums">
                  {t("progress", { done: factory.onboarding.done, total: factory.onboarding.total })}
                </span>
              </p>
              <Meter
                label={t("progressLabel")}
                value={factory.onboarding.total ? (factory.onboarding.done / factory.onboarding.total) * 100 : 0}
                valueText={t("progress", { done: factory.onboarding.done, total: factory.onboarding.total })}
                tone={factory.onboarding.done === factory.onboarding.total ? "success" : "primary"}
              />
            </div>
          ) : null}
        </section>
      )}

      {toSignOff.length ? (
        <Callout tone="warning" icon="stamp" title={t("signOffCallout.title", { count: toSignOff.length })}>
          {t("signOffCallout.body")}
        </Callout>
      ) : null}

      <PartnerSection
        id="steps"
        title={t("stepsTitle")}
        description={rows.length ? t("progress", { done, total: rows.length }) : undefined}
      >
        {steps.data ? <StepRail steps={rows} /> : <PageError error={steps.error} />}
      </PartnerSection>

      {next ? (
        <ContinueBar>
          <span className="flex min-w-0 items-center gap-2 px-2 font-semibold break-keep">
            <Icon name="arrow-right" size={16} aria-hidden="true" className="text-primary shrink-0" />
            {t(`steps.${next.step}.title`)}
          </span>
          <Button asChild size="lg" iconEnd="arrow-right" className="md:h-10">
            <Link href={`/onboarding/${next.step}`}>{tToday("continue")}</Link>
          </Button>
        </ContinueBar>
      ) : null}
    </PartnerPage>
  );
}
