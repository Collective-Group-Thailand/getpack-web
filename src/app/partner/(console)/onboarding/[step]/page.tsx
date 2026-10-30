import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ONBOARDING_STEP_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PartnerPage } from "@/features/partner/frame";
import { SignOffStep } from "@/features/partner/onboarding/forms";
import { StepContent } from "@/features/partner/onboarding/StepContent";
import { ContinueBar, StepRail } from "@/features/partner/onboarding/StepRail";
import { awaitsSignOff, isOnboardingStep } from "@/features/partner/onboarding/steps";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

type Props = { params: Promise<{ step: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { step } = await params;
  const t = await getTranslations("partnerOnboarding");
  return { title: isOnboardingStep(step) ? t(`steps.${step}.title`) : t("title") };
}

/** One onboarding step: what it is, where it stands, what getpack entered, and what to do. */
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

  const rows = steps.data ?? [];
  const index = rows.findIndex((item) => item.step === step);
  const prev = index > 0 ? rows[index - 1] : undefined;
  const following = index >= 0 ? rows[index + 1] : undefined;
  const position = index >= 0 ? `${index + 1}/${rows.length}` : null;

  return (
    <PartnerPage
      wide
      title={title}
      description={t(`steps.${step}.body`)}
      back={{ href: "/onboarding", label: t("back") }}
      status={row ? <StatusChip map={ONBOARDING_STEP_STATUS} value={row.status} size="md" /> : null}
      meta={
        position || row?.enteredByStaff ? (
          <>
            {position ? (
              <span className="bg-surface-subtle text-muted rounded-md px-2 py-0.5 text-sm font-medium tabular-nums">
                {position}
              </span>
            ) : null}
            {row?.enteredByStaff ? <Badge>{t("enteredByGetpack")}</Badge> : null}
          </>
        ) : null
      }
    >
      {/* The thirteen steps beside the one being filled on a desk; a phone moves on with the bar below. */}
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {rows.length ? (
          <nav aria-label={t("stepsTitle")} className="hidden lg:sticky lg:top-20 lg:block">
            <StepRail steps={rows} current={step} variant="rail" />
          </nav>
        ) : null}
        <div className="flex min-w-0 flex-col gap-6 md:gap-7 lg:col-start-2">
          {row?.notes ? (
            <Callout tone="info" title={t("getpackNote")}>
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
          {prev || following ? (
            <ContinueBar>
              {prev ? (
                <Button asChild variant="ghost" size="lg" iconStart="arrow-left" className="md:h-10">
                  <Link href={`/onboarding/${prev.step}`}>
                    <span className="sr-only md:not-sr-only">{t(`steps.${prev.step}.title`)}</span>
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {following ? (
                <Button asChild size="lg" iconEnd="arrow-right" className="md:h-10">
                  <Link href={`/onboarding/${following.step}`}>{t(`steps.${following.step}.title`)}</Link>
                </Button>
              ) : (
                <Button asChild size="lg" iconEnd="arrow-right" className="md:h-10">
                  <Link href="/onboarding">{t("back")}</Link>
                </Button>
              )}
            </ContinueBar>
          ) : null}
        </div>
      </div>
    </PartnerPage>
  );
}
