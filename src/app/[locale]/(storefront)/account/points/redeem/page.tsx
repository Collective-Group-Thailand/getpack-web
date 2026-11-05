import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { getPoints } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { readNow } from "@/features/customer/deals/now.server";
import { getMyRewardCoupons, getRewards } from "@/features/customer/rewards/api.server";
import { MineLink, RedeemView } from "@/features/customer/rewards/RedeemView";
import { getLoyaltySurfaces } from "@/features/customer/loyalty/surfaces.server";
import { FeatureUnavailable } from "@/features/customer/shell/FeatureUnavailable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.rewards");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Redeem points for coupons (loyalty P3, D-479 / D-498; prototype `p3-redeem.html`): the balance, the catalogue as
 * tickets in two groups, the confirm sheet, and "คูปองของฉัน". Costs, verdicts and dates are the API's; points are
 * never cash and never leave the account (no cash-out, no transfer).
 */
export default async function Page() {
  await requireCustomer();
  // Loyalty P4 (D-509, D-510): redeeming closed for this customer; issued coupons stay in the wallet.
  if (!(await getLoyaltySurfaces()).redeem) return <FeatureUnavailable signedIn />;
  const [t, tPoints, list, redemptions, points, now] = await Promise.all([
    getTranslations("account.rewards"),
    getTranslations("account.points"),
    getRewards(),
    getMyRewardCoupons(),
    getPoints().catch(() => null),
    readNow(),
  ]);
  const expiring = points?.expiringSoon.length
    ? [...points.expiringSoon].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0]!
    : null;

  return (
    <div>
      <AccountHeader
        back={{ href: "/account/points", label: tPoints("title") }}
        title={t("title")}
        lede={t("intro")}
        actions={<MineLink />}
      />
      <RedeemView list={list} redemptions={redemptions} expiring={expiring} now={now} />
    </div>
  );
}
