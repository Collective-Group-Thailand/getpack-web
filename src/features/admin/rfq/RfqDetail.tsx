"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { adminRfqActions } from "@/domain/next-actions/admin";
import { RFQ_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
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
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, StatusChip, useActor, useCan, useSlaFormat } from "../console";
import { useRfq, useSettleRfq, useUnmetDemandReasons } from "./data";
import { RfqActionBar, RfqActionDialogs, type RfqActionKey } from "./RfqActions";
import { FactoriesTab, MessagesTab, QuotesTab, RequestTab } from "./RfqTabs";
import { draftOf, sentOf, type Rfq, type RfqTab } from "./resources";

/**
 * One RFQ (F2 2.3): what the customer asked for, what the factories answered, the quote versions
 * and the conversation — with the SLA, the customer and the owner in the rail. The header
 * restates code, customer and category on every tab, and leads with the next action on offer.
 *
 * The published RFQ (`admin.rfqs.get`) carries no files, customer contact, events, routing
 * reason, SLA target or `nextActions` (CONTRACT-GAP admin.rfqs); what to offer comes from
 * `adminRfqActions`.
 */
export function RfqDetail({ rfqId, initial, tab }: { rfqId: string; initial: Rfq | null; tab: RfqTab }) {
  const t = useTranslations("rfq.detail");
  const format = useFormat();
  const pathname = usePathname();
  const router = useRouter();
  const actor = useActor();
  const settle = useSettleRfq(rfqId);
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<RfqActionKey | null>(null);
  const [composing, setComposing] = useState(false);
  const [starting, setStarting] = useState(false);

  const query = useRfq(rfqId, initial);
  const rfq = query.data;
  const reasons = useUnmetDemandReasons(rfq?.status === "declined" && Boolean(rfq.declineReasonCode));

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!rfq) return null;

  const draft = draftOf(rfq);
  const actions = adminRfqActions(
    {
      status: rfq.status,
      hasDraft: Boolean(draft),
      draftBelowMarginFloor: Boolean(draft?.lines.some((line) => line.belowMarginFloor)),
      hasSent: Boolean(sentOf(rfq)),
      hasAcceptedQuotation: Boolean(rfq.acceptedQuoteId),
    },
    (permission) => actor.permissions.includes(permission),
  );
  const offered = new Set(actions.filter((item) => !item.blockedBy).map((item) => item.key.slice("rfq.".length)));
  const sendBlocked = actions.find((item) => item.key === "rfq.send_quote")?.blockedBy;
  const declineReason = rfq.declineReasonCode
    ? (reasons.data?.data.find((reason) => reason.code === rfq.declineReasonCode)?.name ?? rfq.declineReasonCode)
    : null;
  const accepted = rfq.quotations.find((quote) => quote.status === "accepted");

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
        // The saved quotation names its quantity; CS create-order picks the option from it.
        if (rfq.acceptedQuoteId) router.push(`/orders/new?quote=${rfq.acceptedQuoteId}`);
        return;
      case "start_review":
        // Reversible and routine: no confirmation, just the call. Still a contract request
        // (admin.rfq-actions), so the RFQ is read again after it.
        setStarting(true);
        try {
          await adminBrowserApis().requests.call("POST /v1/admin/rfqs/{rfqId}/actions/start-review", {
            path: { rfqId },
          });
          toast.success(t("reviewStarted"));
          settle();
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
      label: `${t("tabs.quotes")}${rfq.quotations.length ? ` (${rfq.quotations.length})` : ""}${draft ? " •" : ""}`,
      content: (
        <QuotesTab
          rfq={rfq}
          composing={composing}
          onCompose={offered.has("compose_quote") || offered.has("edit_quote") ? () => setComposing(true) : undefined}
          onCloseComposer={() => setComposing(false)}
          onSend={offered.has("send_quote") ? () => setAction("send_quote") : undefined}
          sendBlocked={sendBlocked}
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
              {rfq.overdue ? (
                <Badge tone="danger" icon="warning">
                  {t("overdue")}
                </Badge>
              ) : null}
            </>
          }
          description={t("headline", {
            customer: rfq.customer.displayName,
            type: rfq.productTypeName,
            quantities: rfq.quantities.map((quantity) => format.number(quantity)).join(" / "),
          })}
          actions={
            <RfqActionBar
              actions={actions}
              onAction={(key) => {
                if (!starting) void run(key);
              }}
            />
          }
        />
      </div>

      {rfq.status === "declined" && declineReason ? (
        // CONTRACT-GAP admin.rfq-actions — the published RFQ keeps the reason code, not the note.
        <Callout tone="neutral" title={t("declinedTitle", { reason: declineReason })}>
          {t("declinedBody")}
        </Callout>
      ) : null}
      {rfq.acceptedQuoteId ? (
        <AcceptedCallout
          quoteId={rfq.acceptedQuoteId}
          versionNo={accepted?.versionNo ?? null}
          onCreateOrder={offered.has("create_order") ? () => void run("create_order") : undefined}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs label={t("tabsLabel")} items={tabs} value={current} onValueChange={go} />
        <RfqRail rfq={rfq} onAssign={offered.has("assign") ? () => setAction("assign") : undefined} />
      </div>

      <RfqActionDialogs rfq={rfq} open={action} onClose={() => setAction(null)} />
    </div>
  );
}

/**
 * The customer's acceptance made a saved quotation. The RFQ names only its id, so its code is
 * read from `admin.quotes.get` when the actor may read quotations.
 */
function AcceptedCallout({
  quoteId,
  versionNo,
  onCreateOrder,
}: {
  quoteId: string;
  versionNo: number | null;
  onCreateOrder?: () => void;
}) {
  const t = useTranslations("rfq.detail");
  const canRead = useCan("quotes.read");
  const quote = useQuery({
    queryKey: queryKeys.detail("admin", "quote", quoteId),
    enabled: canRead,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/quotes/{quoteId}", { params: { path: { quoteId } } })).data!,
    staleTime: STALE_TIME.reference,
  });
  return (
    <Callout
      tone="success"
      title={versionNo === null ? t("acceptedTitleNoVersion") : t("acceptedTitle", { version: versionNo })}
    >
      <span className="flex flex-wrap items-center gap-3">
        {canRead ? (
          <Link href={`/quotations/${quoteId}`} className="text-primary font-mono hover:underline">
            {quote.data?.quoteCode ?? t("openQuotation")}
          </Link>
        ) : null}
        {onCreateOrder ? (
          <Button size="sm" iconStart="cart" onClick={onCreateOrder}>
            {t("createOrder")}
          </Button>
        ) : null}
      </span>
    </Callout>
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
        {/* CONTRACT-GAP admin.rfqs — the category's SLA target (business hours) is not published. */}
        <p className="text-muted mt-1 text-xs">
          {t("submitted")} <When at={rfq.submittedAt} />
        </p>
      </Card>

      <Card padding="md">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("owner")}</CardTitle>
          {onAssign ? (
            <Button size="sm" variant="secondary" iconStart="user-plus" onClick={onAssign}>
              {rfq.assignedTo ? t("reassign") : t("assign")}
            </Button>
          ) : null}
        </CardHeader>
        <p className="text-sm">
          {rfq.assignedTo ? (
            rfq.assignedTo.id === actor.id ? (
              t("you")
            ) : (
              rfq.assignedTo.displayName
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
        {/* CONTRACT-GAP admin.rfqs — no customer code, company or contact on the published RFQ. */}
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
          ]}
        />
      </Card>
    </div>
  );
}
