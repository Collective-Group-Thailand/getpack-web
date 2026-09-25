"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { RFQ_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Tabs } from "@/ui/components/Tabs";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";
import type { IconName } from "@/ui/icons";

import { problemMessage, QueryError, StatusChip, useActor, useSlaFormat } from "../console";
import { RfqActionBar, RfqActionDialogs, type RfqActionKey } from "./RfqActions";
import { FactoriesTab, MessagesTab, QuotesTab, RequestTab } from "./RfqTabs";
import type { Rfq, RfqTab } from "./resources";

const EVENT_ICONS: Record<string, IconName> = {
  "rfq.submitted": "inbox",
  "rfq.assigned": "user",
  "rfq.review_started": "eye",
  "rfq.info_requested": "help",
  "rfq.consultation_requested": "factory",
  "rfq.consultation_responded": "factory",
  "rfq.quote_sent": "send",
  "rfq.accepted": "check",
  "rfq.declined": "ban",
};

/**
 * One RFQ (F2 2.3): what the customer asked for, what the factories answered, the quote versions
 * and the conversation — with the SLA, the customer and the owner in the rail. The header
 * restates code, customer and category on every tab, and leads with the next action the API
 * offers.
 */
export function RfqDetail({ rfqId, initial, tab }: { rfqId: string; initial: Rfq | null; tab: RfqTab }) {
  const t = useTranslations("rfq.detail");
  const format = useFormat();
  const pathname = usePathname();
  const router = useRouter();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<RfqActionKey | null>(null);
  const [composing, setComposing] = useState(false);
  const [starting, setStarting] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "rfq", rfqId),
    queryFn: () => browserRequests().call("GET /v1/admin/rfqs/{rfqId}", { path: { rfqId } }),
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.transactional,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const rfq = query.data;
  if (!rfq) return null;

  const offered = new Set(
    rfq.nextActions.filter((item) => !item.disabledReason).map((item) => item.key.slice(item.key.lastIndexOf(".") + 1)),
  );

  const go = (next: string) => {
    setCurrent(next);
    // The URL follows without a server round trip; a shared link still opens this tab.
    window.history.replaceState(null, "", next === "request" ? pathname : `${pathname}?tab=${next}`);
  };

  const run = async (key: RfqActionKey) => {
    switch (key) {
      case "compose_quote":
      case "edit_quote":
        setComposing(true);
        go("quotes");
        return;
      case "create_order":
        if (rfq.acceptedQuotation) {
          router.push(`/orders/new?quote=${rfq.acceptedQuotation.id}&quantity=${rfq.acceptedQuotation.quantity}`);
        }
        return;
      case "start_review":
        // Reversible and routine: no confirmation, just the call.
        setStarting(true);
        try {
          await browserRequests().call("POST /v1/admin/rfqs/{rfqId}/actions/start-review", { path: { rfqId } });
          toast.success(t("reviewStarted"));
          void query.refetch();
        } catch (error) {
          toast.error(problemMessage(error, t("actionFailed")));
        } finally {
          setStarting(false);
        }
        return;
      default:
        setAction(key);
    }
  };

  const draft = rfq.quotes.find((quote) => quote.status === "draft");
  const tabs = [
    { value: "request", label: t("tabs.request"), content: <RequestTab rfq={rfq} /> },
    {
      value: "factories",
      label: `${t("tabs.factories")}${rfq.consultations.length ? ` (${rfq.consultations.length})` : ""}`,
      content: (
        <FactoriesTab
          rfq={rfq}
          onRequest={offered.has("request_factory_cost") ? () => setAction("request_factory_cost") : undefined}
        />
      ),
    },
    {
      value: "quotes",
      label: `${t("tabs.quotes")}${rfq.quotes.length ? ` (${rfq.quotes.length})` : ""}${draft ? " •" : ""}`,
      content: (
        <QuotesTab
          rfq={rfq}
          composing={composing}
          onCompose={offered.has("compose_quote") || offered.has("edit_quote") ? () => setComposing(true) : undefined}
          onCloseComposer={() => setComposing(false)}
          onSend={offered.has("send_quote") ? () => setAction("send_quote") : undefined}
        />
      ),
    },
    { value: "messages", label: t("tabs.messages"), content: <MessagesTab rfq={rfq} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-bg z-sticky sticky top-16 -mx-4 border-b border-transparent px-4 pt-1 pb-3 md:-mx-6 md:px-6">
        <PageHeader
          breadcrumbs={
            <Breadcrumbs label={t("breadcrumb")} items={[{ label: t("rfqs"), href: "/rfq" }, { label: rfq.rfqCode }]} />
          }
          title={<span className="font-mono">{rfq.rfqCode}</span>}
          meta={
            <>
              <StatusChip map={RFQ_STATUS} value={rfq.status} size="md" />
              {rfq.urgency !== "normal" ? (
                <Badge tone={rfq.urgency === "late" ? "danger" : "warning"} icon="warning">
                  {t(`urgency.${rfq.urgency}`)}
                </Badge>
              ) : null}
              {rfq.routedFromCalculator ? <Badge icon="calculator">{t("routed")}</Badge> : null}
            </>
          }
          description={t("headline", {
            customer: rfq.customer.displayName,
            type: rfq.productType.name,
            quantities: rfq.quantities.map((quantity) => format.number(quantity)).join(" / "),
          })}
          actions={
            <RfqActionBar
              rfq={rfq}
              onAction={(key) => {
                if (!starting) void run(key);
              }}
            />
          }
        />
      </div>

      {rfq.routedFrom ? (
        <Callout tone="info" title={t("routedTitle")}>
          {rfq.routedFrom.reason}
        </Callout>
      ) : null}
      {rfq.status === "declined" && rfq.declineReason ? (
        <Callout tone="neutral" title={t("declinedTitle", { reason: rfq.declineReason.name })}>
          {rfq.declineNote ?? t("declinedBody")}
        </Callout>
      ) : null}
      {rfq.acceptedQuotation ? (
        <Callout tone="success" title={t("acceptedTitle", { version: rfq.acceptedQuotation.versionNo })}>
          <span className="flex flex-wrap items-center gap-3">
            <Link href={`/quotations/${rfq.acceptedQuotation.id}`} className="text-primary font-mono hover:underline">
              {rfq.acceptedQuotation.quoteCode}
            </Link>
            {offered.has("create_order") ? (
              <Button size="sm" iconStart="cart" onClick={() => void run("create_order")}>
                {t("createOrder")}
              </Button>
            ) : null}
          </span>
        </Callout>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs label={t("tabsLabel")} items={tabs} value={current} onValueChange={go} />
        <RfqRail rfq={rfq} onAssign={offered.has("assign") ? () => setAction("assign") : undefined} />
      </div>

      <RfqActionDialogs rfq={rfq} open={action} onClose={() => setAction(null)} />
    </div>
  );
}

function RfqRail({ rfq, onAssign }: { rfq: Rfq; onAssign?: () => void }) {
  const t = useTranslations("rfq.detail.rail");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();
  const late = rfq.firstResponseAt && rfq.slaDueAt && Date.parse(rfq.firstResponseAt) > Date.parse(rfq.slaDueAt);

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("sla")}</CardTitle>
        </CardHeader>
        {rfq.firstResponseAt ? (
          <p className={late ? "text-danger text-sm font-medium" : "text-success-subtle-fg text-sm font-medium"}>
            {t(late ? "respondedLate" : "respondedInTime")}
            {" · "}
            <When at={rfq.firstResponseAt} />
          </p>
        ) : (
          <SlaTimer
            dueAt={rfq.slaDueAt}
            format={sla}
            absolute={rfq.slaDueAt ? format.dateTime(rfq.slaDueAt) : undefined}
          />
        )}
        <p className="text-muted mt-1 text-xs">
          {t("target", { hours: rfq.slaTargetHours, type: rfq.productType.name })}
        </p>
        <p className="text-muted mt-1 text-xs">
          {t("submitted")} <When at={rfq.submittedAt} />
        </p>
      </Card>

      <Card padding="md">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("owner")}</CardTitle>
          {onAssign ? (
            <Button size="sm" variant="secondary" iconStart="user-plus" onClick={onAssign}>
              {rfq.assignee ? t("reassign") : t("assign")}
            </Button>
          ) : null}
        </CardHeader>
        <p className="text-sm">
          {rfq.assignee ? (
            rfq.assignee.id === actor.id ? (
              t("you")
            ) : (
              rfq.assignee.displayName
            )
          ) : (
            <span className="text-warning-subtle-fg font-medium">{t("unassigned")}</span>
          )}
        </p>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("customer")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={1}
          items={[
            {
              term: t("name"),
              description: (
                <Link href={`/customers/${rfq.customer.id}`} className="text-primary hover:underline">
                  {rfq.customer.displayName}
                </Link>
              ),
            },
            ...(rfq.customer.companyName ? [{ term: t("company"), description: rfq.customer.companyName }] : []),
            { term: t("code"), description: <span className="font-mono">{rfq.customer.customerCode}</span> },
            ...(rfq.contact.phone ? [{ term: t("phone"), description: rfq.contact.phone }] : []),
            ...(rfq.contact.email ? [{ term: t("email"), description: rfq.contact.email }] : []),
          ]}
        />
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("activity")}</CardTitle>
        </CardHeader>
        <Timeline
          label={t("activity")}
          items={[...rfq.events].reverse().map((event) => ({
            id: event.id,
            title: event.title,
            time: <When at={event.at} />,
            actor: event.actor?.displayName,
            icon: EVENT_ICONS[event.kind] ?? "circle",
            tone: event.kind === "rfq.declined" ? "danger" : event.kind === "rfq.accepted" ? "success" : undefined,
          }))}
        />
      </Card>
    </div>
  );
}
