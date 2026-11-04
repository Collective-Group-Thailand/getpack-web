import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getSurvey } from "@/features/customer/surveys/api.server";
import { isOpen } from "@/features/customer/surveys/survey-model";
import { SurveyClosed, SurveyForm } from "@/features/customer/surveys/SurveyForm";
import { getFormat } from "@/features/shared/format/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.surveys");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

/**
 * A survey by its link (loyalty P2, D-491): the e-mail and LINE messages open it here, and it stays reachable after
 * "ไว้ทีหลัง" until it expires. A completed, dismissed-and-expired or unknown one shows the neutral closed state.
 */
export default async function Page({ params }: { params: Promise<{ surveyId: string }> }) {
  await requireCustomer();
  const { surveyId } = await params;
  const [t, format, survey] = await Promise.all([getTranslations("account.surveys"), getFormat(), getSurvey(surveyId)]);
  const open = survey && isOpen(survey);

  return (
    <div className="max-w-2xl">
      <AccountHeader
        title={open ? survey.title : t("pageTitle")}
        lede={
          open
            ? [
                survey.orderCode ? t("eyebrow", { code: survey.orderCode }) : null,
                survey.rewardPoints > 0
                  ? t("rewardPlain", { count: survey.questions.length, points: format.number(survey.rewardPoints) })
                  : null,
                t("until", { date: format.date(survey.expiresAt) }),
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />
      <div className="border-border bg-surface rounded-panel mt-6 border p-5 md:p-6">
        {open ? <SurveyForm survey={survey} /> : <SurveyClosed />}
      </div>
    </div>
  );
}
