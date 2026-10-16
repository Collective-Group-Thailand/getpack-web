import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listThreads } from "@/features/customer/messages/api.server";
import { NewSupportMessage } from "@/features/customer/messages/StartThread";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.messages");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const QUICK = ["quick.status", "quick.file", "quick.change"] as const;

/**
 * My conversations with getpack (U5.3, D-300): the support chat and a thread per order, design or RFQ
 * I asked about, latest activity first with what is unread. getpack answers here, or on LINE when I
 * choose it. Never a conversation with a factory (D-050).
 */
export default async function Page() {
  await requireCustomer();
  const [t, threads, format, locale] = await Promise.all([
    getTranslations("account.messages"),
    listThreads(),
    getFormat(),
    getLocale(),
  ]);
  void locale;
  const support = threads.find((thread) => thread.subjectType === "support" && thread.status !== "closed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title leading-tight">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>

      {threads.length > 0 ? (
        <section aria-labelledby="threads">
          <h2 id="threads" className="sr-only">
            {t("threads")}
          </h2>
          <ul className="bg-surface divide-border border-border divide-y rounded-xl border">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/account/messages/${thread.id}`}
                  className="hover:bg-bg-subtle flex items-start gap-3 p-4 transition"
                >
                  <Icon name={thread.subjectType === "support" ? "chat" : "package"} size={20} className="mt-0.5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {thread.subject
                        ? t("about", { label: thread.subject.label, kind: t(`kinds.${thread.subjectType}`) })
                        : t("kinds.support")}
                      {thread.unread > 0 ? (
                        <Badge tone="info" size="sm">
                          {t("unread", { count: thread.unread })}
                        </Badge>
                      ) : null}
                      {thread.status === "closed" ? (
                        <Badge tone="neutral" size="sm">
                          {t("closed")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted truncate text-sm">{thread.lastMessage ?? t("noText")}</span>
                  </span>
                  <span className="text-muted shrink-0 text-xs">{format.dateTime(thread.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="new-message" className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
        <h2 id="new-message" className="font-semibold">
          {support ? t("continueSupport") : t("newSupport")}
        </h2>
        <p className="text-muted text-sm">{threads.length === 0 ? t("empty") : t("newSupportBody")}</p>
        {support ? (
          <Link
            href={`/account/messages/${support.id}`}
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            {t("openSupport")}
          </Link>
        ) : (
          <NewSupportMessage quickReplies={QUICK.map((key) => t(key))} />
        )}
      </section>
    </div>
  );
}
