import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentFrame } from "@/features/customer/agent/AgentPieces";
import { getAgent, getMyPayoutProfile } from "@/features/customer/agent/api.server";
import { PayoutProfileForm } from "@/features/customer/agent/PayoutProfileForm";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent.payout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const TONE = { none: "info", draft: "info", submitted: "info", verified: "success", rejected: "warning" } as const;

/** D-466 step 2 — the agent's payout profile and where it stands with Finance. */
export default async function Page() {
  await requireCustomer();
  await getAgent(); // a non-agent is sent to the programme page
  const [t, { data: mine, etag }] = await Promise.all([getTranslations("agent.payout"), getMyPayoutProfile()]);
  const status = mine.profile?.status ?? "none";
  return (
    <AgentFrame title={t("title")} intro={t("intro")}>
      {!mine.applicable ? (
        <Callout tone="info">{t("notApplicable")}</Callout>
      ) : (
        <>
          <Callout tone={TONE[status]} title={t(`status.${status}`)}>
            {t(`statusBody.${status}`, { reason: mine.profile?.rejectReason ?? "" })}
          </Callout>
          <div className="max-w-3xl">
            <PayoutProfileForm mine={mine} etag={etag} />
          </div>
        </>
      )}
    </AgentFrame>
  );
}
