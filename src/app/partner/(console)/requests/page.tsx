import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CHANGE_REQUEST_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { factoryReferences } from "@/features/partner/onboarding/StepContent";
import { ChangeRequestForm } from "@/features/partner/requests/ChangeRequestForm";
import { StatusChip } from "@/features/partner/status";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Panel } from "@/ui/components/Panel";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerRequests"))("title") };
}

/**
 * Everything the factory asked the Partner team (`partner.changeRequests.list`, newest first) and the answers, as
 * a list beside the one opened (`?ask=`) — on a phone the list, then the request on its own screen. Asking
 * something new (`?new=1`) takes the reading pane's place.
 */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string; new?: string }>;
}) {
  const [query, t, tForm, tNav, format, context] = await Promise.all([
    searchParams,
    getTranslations("partnerRequests"),
    getTranslations("partnerRequests.form"),
    getTranslations("partner.sidebar.items"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const canAsk = canAt(context, "factory_profile.manage");
  const [asks, references] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/change-requests", {
            params: { path: { factoryId: context.factoryId }, query: { perPage: 50 } },
          })
        ).data!,
    ),
    factoryReferences(context.factoryId),
  ]);
  const list = asks.data?.data ?? [];
  const asking = canAsk && (query.new === "1" || (asks.data !== null && list.length === 0));
  const opened = asking ? null : (list.find((ask) => ask.id === query.ask) ?? list[0] ?? null);
  // On a phone one pane at a time: the reading pane only when the address names a request (or a new one).
  const phoneDetail = Boolean(query.ask || query.new === "1");

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canAsk && !asking ? (
          <Button asChild iconStart="plus">
            <Link href="/requests?new=1">{t("newTitle")}</Link>
          </Button>
        ) : null
      }
    >
      {!asks.data ? (
        <PageError error={asks.error} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
          <section
            aria-labelledby="asks-title"
            className={cn("flex min-w-0 flex-col gap-3", phoneDetail && "max-lg:hidden")}
          >
            <h2 id="asks-title" className="text-muted text-sm font-medium">
              {t("listTitle")}
            </h2>
            {list.length ? (
              <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                {list.map((ask) => {
                  const current = !asking && opened?.id === ask.id;
                  return (
                    <li key={ask.id}>
                      <Link
                        href={`/requests?ask=${ask.id}`}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "focus-visible:ring-focus-ring relative flex flex-col gap-1 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset",
                          current ? "bg-primary-subtle" : "hover:bg-surface-subtle",
                        )}
                      >
                        {current ? <span aria-hidden className="bg-primary absolute inset-y-0 start-0 w-0.5" /> : null}
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={cn(
                              "min-w-0 font-medium [overflow-wrap:anywhere] break-keep",
                              current && "text-primary-subtle-fg",
                            )}
                          >
                            {tForm(`topics.${ask.topic}`)}
                          </span>
                          <StatusChip map={CHANGE_REQUEST_STATUS} value={ask.status} />
                        </span>
                        <span
                          className={cn(
                            "line-clamp-2 text-sm [overflow-wrap:anywhere]",
                            current ? "text-primary-subtle-fg" : "text-muted",
                          )}
                        >
                          {ask.message}
                        </span>
                        <span className={cn("text-xs tabular-nums", current ? "text-primary-subtle-fg" : "text-muted")}>
                          {format.date(ask.createdAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon="inbox"
                title={t("empty")}
                action={
                  canAsk ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href="/requests?new=1">{t("newTitle")}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary">
                      <Link href="/knowledge">{tNav("knowledge")}</Link>
                    </Button>
                  )
                }
              />
            )}
          </section>

          <div className={cn("flex min-w-0 flex-col gap-3 lg:sticky lg:top-20", !phoneDetail && "max-lg:hidden")}>
            <Link
              href="/requests"
              className="text-muted hover:text-fg -ms-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-md px-1.5 text-sm lg:hidden"
            >
              <Icon name="chevron-left" size={16} aria-hidden="true" />
              {t("listTitle")}
            </Link>
            {asking ? (
              <Panel id="ask-new" title={t("newTitle")}>
                <ChangeRequestForm topic="other" chooseTopic primary productTypes={references.productTypes} />
              </Panel>
            ) : opened ? (
              <Panel
                id="ask-open"
                title={tForm(`topics.${opened.topic}`)}
                actions={<StatusChip map={CHANGE_REQUEST_STATUS} value={opened.status} size="md" />}
              >
                <div className="flex flex-col gap-4">
                  <p className="text-muted -mt-2 text-sm">
                    {t("meta", { by: opened.createdBy.displayName, date: format.dateTime(opened.createdAt) })}
                  </p>
                  <p className="max-w-[68ch] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {opened.message}
                  </p>
                  {opened.preferredDates.length ? (
                    <p className="text-sm">
                      {t("dates", { dates: opened.preferredDates.map((day) => format.date(day)).join(", ") })}
                    </p>
                  ) : null}
                  {opened.response ? (
                    <div className="border-border bg-surface-subtle flex flex-col gap-1.5 rounded-lg border p-4">
                      <p className="max-w-[68ch] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {t("response", { response: opened.response })}
                      </p>
                      {opened.respondedBy && opened.respondedAt ? (
                        <p className="text-muted text-sm">
                          {t("answeredBy", {
                            by: opened.respondedBy.displayName,
                            date: format.dateTime(opened.respondedAt),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </PartnerPage>
  );
}
