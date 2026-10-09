import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { FACTORY_STATUS, ONBOARDING_STEP_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { awaitsSignOff, FACTORY_STAGES } from "@/features/partner/onboarding/steps";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Meter } from "@/ui/components/Meter";
import { ProgressTracker, type ProgressState } from "@/ui/components/ProgressTracker";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerOnboarding"))("title") };
}

/**
 * The factory's way to activation (D-011, D-041, D-171): where it stands — applied, in review,
 * trial, active — and the thirteen steps, with what Packio entered for it still to sign off.
 */
export default async function OnboardingPage() {
  const t = await getTranslations("partnerOnboarding");
  const tStatus = await getTranslations("status");
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

  return (
    <PartnerPage
      title={t("title")}
      description={factory?.onboardingMode === "assisted" ? t("assistedIntro") : t("selfIntro")}
      meta={factory ? <StatusChip map={FACTORY_STATUS} value={factory.status} size="md" /> : null}
    >
      {factory && ["suspended", "offboarded"].includes(factory.status) ? (
        <Callout tone="warning" title={tStatus(FACTORY_STATUS[factory.status].labelKey)}>
          {t("inactive")}
        </Callout>
      ) : (
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
      )}

      {factory ? (
        <Meter
          label={t("progressLabel")}
          value={factory.onboarding.total ? (factory.onboarding.done / factory.onboarding.total) * 100 : 0}
          valueText={t("progress", { done: factory.onboarding.done, total: factory.onboarding.total })}
          tone={factory.onboarding.done === factory.onboarding.total ? "success" : "primary"}
        />
      ) : null}

      {toSignOff.length ? (
        <Callout tone="warning" icon="stamp" title={t("signOffCallout.title", { count: toSignOff.length })}>
          {t("signOffCallout.body")}
        </Callout>
      ) : null}

      <PartnerSection title={t("stepsTitle")}>
        {steps.data ? (
          <ol className="flex flex-col gap-2">
            {steps.data.map((step, index) => (
              <li key={step.step}>
                <Link
                  href={`/onboarding/${step.step}`}
                  className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 items-center gap-3 rounded-xl border p-3"
                >
                  <span className="text-muted w-6 text-center tabular-nums" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`steps.${step.step}.title`)}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <StatusChip map={ONBOARDING_STEP_STATUS} value={step.status} />
                      {awaitsSignOff(step) ? (
                        <Badge size="sm" tone="warning" icon="stamp">
                          {t("awaitingSignOff")}
                        </Badge>
                      ) : step.enteredByStaff ? (
                        <Badge size="sm">{t("enteredByPackio")}</Badge>
                      ) : null}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={24} className="text-muted" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <PageError error={steps.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
