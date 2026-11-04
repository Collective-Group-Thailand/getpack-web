import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsNav, WaitlistList } from "@/features/admin/agents";
import { waitlistList } from "@/features/admin/agents/resources";
import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("agents.waitlist"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The agent programme's waiting list (P7 pilot switch): who asked to hear when sign-up opens. Personal data — Sales
 * Manager, C-Level and Superadmin (`agent_waitlist.read`); the list answers everyone else with the 403 page, and the
 * API refuses their calls (the server prefetch then comes back empty).
 */
export default async function WaitlistPage({ searchParams }: Props) {
  const t = await getTranslations("agents.waitlist");
  const initial = await prefetchList(waitlistList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsNav />
      <WaitlistList initial={initial} />
    </ConsolePage>
  );
}
