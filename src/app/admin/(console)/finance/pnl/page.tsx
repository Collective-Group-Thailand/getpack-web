import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { PnlPlanner } from "@/features/admin/finance/pnl/Planner";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("finance.pnl"))("title") };
}

/**
 * The management P&L planner (D-472). Confidential: readers are C-Level, VP, Director and the Finance Manager — the
 * planner answers everyone else with the 403 page, and the API refuses their calls.
 */
export default function PnlPage() {
  return (
    <ConsolePage width="full" className="max-w-[120rem]">
      <Suspense>
        <PnlPlanner />
      </Suspense>
    </ConsolePage>
  );
}
