import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { listThreads } from "@/features/customer/messages/api.server";
import { NewSupportMessage } from "@/features/customer/messages/StartThread";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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

  const compose = (
    <section
      aria-labelledby="new-message"
      className="bg-surface border-border rounded-card flex flex-col gap-3 border p-4 sm:p-5 lg:sticky lg:top-[calc(var(--site-sticky-top,0px)+1rem)]"
    >
      <h2 id="new-message" className="font-semibold">
        {support ? t("continueSupport") : t("newSupport")}
      </h2>
      <p className="text-muted text-sm">{threads.length === 0 ? t("empty") : t("newSupportBody")}</p>
      {support ? (
        <Button asChild iconStart="chat" className="self-start">
          <Link href={`/account/messages/${support.id}`}>{t("openSupport")}</Link>
        </Button>
      ) : (
        <NewSupportMessage quickReplies={QUICK.map((key) => t(key))} />
      )}
    </section>
  );

  return (
    <div>
      <AccountHeader title={t("title")} lede={t("intro")} />
      {/* Project B3: the conversations as an inbox, unread ones marked with a bar and bold, and writing to the
          team in a card beside it. */}
      {threads.length > 0 ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="threads" className="min-w-0">
            <h2 id="threads" className="sr-only">
              {t("threads")}
            </h2>
            <ul className="bg-surface divide-border border-border rounded-card divide-y overflow-hidden border">
              {threads.map((thread) => {
                const unread = thread.unread > 0;
                return (
                  <li key={thread.id}>
                    <Link
                      href={`/account/messages/${thread.id}`}
                      className={cn(
                        "hover:bg-surface-subtle focus-visible:ring-focus-ring flex items-start gap-3 border-s-4 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset",
                        unread ? "border-primary" : "border-transparent",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="border-border bg-surface-subtle text-muted grid size-10 shrink-0 place-items-center rounded-lg border"
                      >
                        <Icon name={thread.subjectType === "support" ? "chat" : "package"} size={18} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn("min-w-0", unread ? "font-semibold" : "font-medium")}>
                            {thread.subject
                              ? t("about", { label: thread.subject.label, kind: t(`kinds.${thread.subjectType}`) })
                              : t("kinds.support")}
                          </span>
                          {unread ? (
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
                        <span className={cn("truncate text-sm", unread ? "text-fg" : "text-muted")}>
                          {thread.lastMessage ?? t("noText")}
                        </span>
                      </span>
                      <span className="text-muted shrink-0 text-xs whitespace-nowrap">
                        {format.dateTime(thread.lastMessageAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          {compose}
        </div>
      ) : (
        <div className="mt-6 max-w-2xl">{compose}</div>
      )}
    </div>
  );
}
