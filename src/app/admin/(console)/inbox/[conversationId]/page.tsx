import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ConsolePage } from "@/features/admin/console/ConsolePage";
import { InboxThread } from "@/features/admin/inbox/InboxThread";
import { isApiError } from "@/lib/api/problem";
import { serverApi } from "@/lib/api/server";
import { PageHeader } from "@/ui/components/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("cs.inbox"))("title") };
}

/** One conversation in the CS inbox (U5.3) — the path packio-api's notifications link to (`/inbox/{id}`). */
export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const t = await getTranslations("cs.inbox");
  const conversation = await (
    await serverApi("admin")
  )
    .GET("/v1/admin/conversations/{conversationId}", { params: { path: { conversationId } } })
    .then((response) => response.data!)
    .catch((error: unknown) => {
      if (isApiError(error) && error.status === 404) notFound();
      throw error;
    });
  return (
    <ConsolePage width="full" className="max-w-[96rem]">
      <Link href="/inbox" className="text-primary text-sm hover:underline">
        {t("back")}
      </Link>
      <PageHeader
        title={conversation.customer?.displayName ?? conversation.lineDisplayName ?? t("unknownCustomer")}
        description={
          conversation.subject
            ? `${t(`subjects.${conversation.subjectType}`)} ${conversation.subject.label}`
            : t("subjects.support")
        }
      />
      <InboxThread initial={conversation} />
    </ConsolePage>
  );
}
