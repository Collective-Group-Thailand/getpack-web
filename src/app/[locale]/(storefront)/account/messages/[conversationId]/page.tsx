import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getThread } from "@/features/customer/messages/api.server";
import { ConversationPanel } from "@/features/customer/messages/ConversationPanel";
import { storeCardHref } from "@/features/customer/messages/hooks";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.messages");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const QUICK = ["quick.status", "quick.file", "quick.change"] as const;

/** One conversation (U5.3): the thread a notification's deep link opens (`/account/messages/{id}`, D-299). */
export default async function Page({ params }: { params: Promise<{ conversationId: string }> }) {
  await requireCustomer();
  const { conversationId } = await params;
  const [t, thread, format] = await Promise.all([
    getTranslations("account.messages"),
    getThread(conversationId),
    getFormat(),
  ]);
  if (!thread) notFound();
  const subjectHref = thread.subject ? storeCardHref(thread.subject) : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/account/messages" className="text-primary text-sm underline-offset-4 hover:underline">
        {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">
          {thread.subject
            ? t("about", { label: thread.subject.label, kind: t(`kinds.${thread.subjectType}`) })
            : t("kinds.support")}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {thread.readByPackioAt ? t("readByPackio", { at: format.dateTime(thread.readByPackioAt) }) : t("responseTarget")}
          {subjectHref ? (
            <>
              {" · "}
              <Link href={subjectHref} className="text-primary underline-offset-4 hover:underline">
                {t("openSubject")}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <ConversationPanel thread={thread} quickReplies={QUICK.map((key) => t(key))} />
    </div>
  );
}
