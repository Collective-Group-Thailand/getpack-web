import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { prefetchList } from "@/features/admin/console/prefetch.server";
import { InboxList } from "@/features/admin/inbox/InboxList";
import { inboxList } from "@/features/admin/inbox/resources";
import Link from "next/link";

import { PageHeader } from "@/ui/components/PageHeader";
import { Button } from "@/ui/components/Button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.inbox"))("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The CS inbox (U5.3): in the admin menu since D-411, and reached from the CS page and
 * notifications' deep links (`/inbox/{id}`). Canned responses are managed beside it (D-412).
 */
export default async function InboxPage({ searchParams }: Props) {
  const t = await getTranslations("cs.inbox");
  const tContent = await getTranslations("content.pages.canned");
  const initial = await prefetchList(inboxList, await searchParams);
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="secondary" size="sm" iconStart="chat" asChild>
            <Link href="/inbox/canned">{tContent("manage")}</Link>
          </Button>
        }
      />
      <InboxList initial={initial} />
    </ConsolePage>
  );
}
