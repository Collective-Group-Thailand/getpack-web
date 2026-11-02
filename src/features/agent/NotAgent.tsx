import { getTranslations } from "next-intl/server";

import { zoneOrigin } from "@/lib/zones/origin.server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

import type { AgentProgramme } from "./api.server";

/**
 * Someone signed in to getpack Agent who is not an agent (D-467): one short screen — what this app is, where they
 * stand if they applied, and the way to the programme on getpack.co (applying stays on the storefront, D-466).
 */
export async function NotAgent({ programme }: { programme: AgentProgramme }) {
  const [t, storefront] = await Promise.all([getTranslations("agentZone.notAgent"), zoneOrigin("customer")]);
  const applied = programme.state === "applied";
  return (
    <div className="mx-auto max-w-xl py-6 sm:py-12">
      <EmptyState
        icon="handshake"
        titleAs="h1"
        title={applied ? t("appliedTitle") : t("title")}
        description={applied ? t("appliedBody") : t("body")}
        action={
          <Button asChild iconEnd="external">
            <a href={`${storefront}${applied ? "/account/agent" : "/agent"}`}>{applied ? t("appliedAction") : t("action")}</a>
          </Button>
        }
      />
    </div>
  );
}
