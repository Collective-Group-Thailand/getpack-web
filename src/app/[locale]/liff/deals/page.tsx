import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getPoints } from "@/features/customer/account/api.server";
import { listDeals } from "@/features/customer/deals/api.server";
import { readNow } from "@/features/customer/deals/now.server";
import { getProductTypeNames } from "@/features/customer/catalog/api.server";
import { LiffDeals } from "@/features/customer/deals/LiffDeals";
import { getLoyaltySurfaces } from "@/features/customer/loyalty/surfaces.server";
import { FeatureUnavailable } from "@/features/customer/shell/FeatureUnavailable";
import { LiffHeader } from "@/features/customer/liff/LiffHeader";
import { LiffSignIn } from "@/features/customer/liff/LiffSignIn";
import { liffCustomer } from "@/features/customer/liff/liff.server";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { alternateUrls, publicOrigin } from "@/lib/seo";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deals");
  return { title: t("title") };
}

/** Deals in LINE (loyalty P1.5, D-151): the points line, then the deals with the ticket sheet. */
export default async function Page() {
  if (!(await liffCustomer())) return <LiffSignIn />;
  // Loyalty P4 (D-509, D-510): deals closed for this customer, or in LINE (`dealsLiff`, a web-only gate).
  const surfaces = await getLoyaltySurfaces();
  if (!surfaces.deals || !surfaces.dealsLiff)
    return <FeatureUnavailable signedIn liff pointsHref="/liff/points" showPoints={surfaces.pointsLiff} />;
  const [t, locale, format, points, list, origin] = await Promise.all([
    getTranslations("deals"),
    getLocale(),
    getFormat(),
    getPoints().catch(() => null),
    listDeals(),
    publicOrigin(),
  ]);
  const b = (chunks: React.ReactNode) => <b className="text-fg font-semibold tabular-nums">{chunks}</b>;
  return (
    <div className="flex flex-col gap-3.5">
      <LiffHeader title={t("title")} />
      {points ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted m-0">
            {t.rich("liff.points", { points: format.number(points.availablePoints), b })}
            {" · "}
            {t("liff.value", { amount: format.thb(points.availableValue) })}
          </p>
          <Link href="/liff/points" className="text-primary inline-flex min-h-11 items-center gap-0.5 font-medium">
            {t("liff.pointsLink")}
            <Icon name="chevron-right" size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      {list && list.items.length > 0 ? (
        <LiffDeals
          deals={list.items}
          dealsUrl={alternateUrls(origin, "/deals", locale as Locale).canonical}
          now={await readNow()}
          typeNames={await getProductTypeNames(locale).catch(() => ({}) as Record<string, string>)}
        />
      ) : (
        <EmptyState
          icon="ticket"
          title={t("empty.noneTitle")}
          description={t("empty.noneBody")}
          action={
            <Button asChild variant="secondary">
              <Link href="/products">{t("empty.products")}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
