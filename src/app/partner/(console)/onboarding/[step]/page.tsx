import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ONBOARDING_STEP_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { SignOffStep } from "@/features/partner/onboarding/forms";
import { StepContent } from "@/features/partner/onboarding/StepContent";
import { awaitsSignOff, isOnboardingStep } from "@/features/partner/onboarding/steps";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";

type Props = { params: Promise<{ step: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { step } = await params;
  const t = await getTranslations("partnerOnboarding");
  return { title: isOnboardingStep(step) ? t(`steps.${step}.title`) : t("title") };
}

/** One onboarding step: what it is, where it stands, what Packio entered, and what to do. */
export default async function OnboardingStepPage({ params }: Props) {
  const { step } = await params;
  if (!isOnboardingStep(step)) notFound();
  const t = await getTranslations("partnerOnboarding");
  const format = await getFormat();
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
  const row = steps.data?.find((item) => item.step === step);
  const title = t(`steps.${step}.title`);

  return (
    <PartnerPage
      title={title}
      description={t(`steps.${step}.body`)}
      back={{ href: "/onboarding", label: t("back") }}
      meta={
        row ? (
          <>
            <StatusChip map={ONBOARDING_STEP_STATUS} value={row.status} size="md" />
            {row.enteredByStaff ? <Badge>{t("enteredByPackio")}</Badge> : null}
          </>
        ) : null
      }
    >
      {row?.notes ? (
        <Callout tone="info" title={t("packioNote")}>
          {row.notes}
        </Callout>
      ) : null}
      {row && awaitsSignOff(row) ? (
        <Callout tone="warning" icon="stamp" title={t("signOff.calloutTitle")}>
          <p>{t("signOff.calloutBody")}</p>
          <div className="mt-3">
            <SignOffStep step={step} stepLabel={title} />
          </div>
        </Callout>
      ) : row?.factorySignedOffAt ? (
        <Callout tone="success" icon="check">
          {t("signOff.signedAt", { date: format.dateTime(row.factorySignedOffAt) })}
        </Callout>
      ) : null}
      <StepContent step={step} context={context} />
    </PartnerPage>
  );
}
