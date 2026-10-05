import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { InboxList } from "@/features/admin/inbox/InboxList";
import { inboxList } from "@/features/admin/inbox/resources";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.inbox"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The CS inbox (U5.3). packio-api's menu has no entry for it yet (CONTRACT-REQUEST admin.menu-inbox):
 * reached from the CS page, notifications' deep links (`/inbox/{id}`) and the command palette.
 */
export default async function InboxPage({ searchParams }: Props) {
  const t = await getTranslations("cs.inbox");
  const initial = await prefetchList(inboxList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader title={t("title")} description={t("description")} />
      <InboxList initial={initial} />
    </ConsolePage>
  );
}
