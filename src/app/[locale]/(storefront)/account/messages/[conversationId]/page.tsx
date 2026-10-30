import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getThread } from "@/features/customer/messages/api.server";
import { ConversationPanel } from "@/features/customer/messages/ConversationPanel";
import { storeCardHref } from "@/features/customer/messages/paths";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

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
    <div className="flex flex-col gap-6">
      <AccountHeader
        back={{ href: "/account/messages", label: t("back") }}
        title={
          thread.subject
            ? t("about", { label: thread.subject.label, kind: t(`kinds.${thread.subjectType}`) })
            : t("kinds.support")
        }
        lede={
          thread.readByGetpackAt
            ? t("readByGetpack", { at: format.dateTime(thread.readByGetpackAt) })
            : t("responseTarget")
        }
        actions={
          subjectHref ? (
            <Button asChild variant="secondary" iconEnd="chevron-right">
              <Link href={subjectHref}>{t("openSubject")}</Link>
            </Button>
          ) : null
        }
      />
      <div className="border-border bg-surface rounded-card border p-4 sm:p-5">
        <ConversationPanel thread={thread} quickReplies={QUICK.map((key) => t(key))} />
      </div>
    </div>
  );
}
