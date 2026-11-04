import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { getLoyaltyTasks, getPackagingProfile } from "@/features/customer/account/api.server";
import { PackagingProfileForm } from "@/features/customer/account/PackagingProfileForm";
import { requireCustomer } from "@/features/customer/auth/guard.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.packagingProfile");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * How the customer uses packaging (loyalty P1, `store.loyalty.packagingProfile`): internal data under a PDPA purpose
 * shown on the form. The reward line uses the checklist's own figure for the task, so nothing here is hard-coded.
 */
export default async function Page() {
  await requireCustomer();
  const [t, profile, tasks] = await Promise.all([
    getTranslations("account.packagingProfile"),
    getPackagingProfile(),
    getLoyaltyTasks(),
  ]);
  const task = tasks?.tasks.find((entry) => entry.code === "packaging_profile");
  const rewardPoints = task?.status === "todo" && (tasks?.capRemainingPoints ?? 0) > 0 ? task.points : null;
  return (
    <div>
      <AccountHeader className="mb-6" title={t("title")} lede={t("intro")} />
      <PackagingProfileForm profile={profile} rewardPoints={rewardPoints} />
    </div>
  );
}
