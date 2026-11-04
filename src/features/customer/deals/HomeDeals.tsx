import { getTranslations } from "next-intl/server";

import { HOME_WRAP, UNDERLINE } from "@/features/customer/home/parts";
import { Link } from "@/i18n/navigation";
import type { Deal } from "@/features/shared/deals/types";
import { cn } from "@/ui/lib/cn";

import { DealsView } from "./DealsView";

/** How many tickets the home page shows (PLAN §3.5.3: a 3-card strip). */
export const HOME_DEALS = 3;

/** The deals the home strip shows, in the API's order; none means the strip is not rendered. */
export function homeDeals(deals: readonly Deal[] | null | undefined): Deal[] {
  return (deals ?? []).slice(0, HOME_DEALS);
}

/**
 * The home page's deal strip (loyalty P1.5): three vertical tickets and "ดูดีลทั้งหมด". Hidden when there is no public
 * deal — never an empty frame (PLAN §3.5.3, "hidden when < 1 public deal").
 */
export async function HomeDeals({
  deals,
  signedIn,
  now,
  typeNames,
}: {
  deals: readonly Deal[];
  signedIn: boolean;
  now: number;
  typeNames: Record<string, string>;
}) {
  if (deals.length === 0) return null;
  const t = await getTranslations("deals.home");
  return (
    <section aria-labelledby="home-deals" className={cn(HOME_WRAP, "pt-20 min-[1055px]:pt-26")}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="home-deals" className="text-[1.875rem] leading-[1.1] md:text-[2.5rem]">
            {t("title")}
          </h2>
          <p className="text-muted mt-3 text-[1.0625rem] leading-relaxed">{t("body")}</p>
        </div>
        <Link href="/deals" className={cn("text-[0.90625rem]", UNDERLINE)}>
          {t("all")}
        </Link>
      </div>
      <DealsView deals={deals} signedIn={signedIn} now={now} typeNames={typeNames} layout="strip" />
    </section>
  );
}
