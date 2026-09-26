"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ARTWORK_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import { problemMessage, QueryError, StatusChip, useActor, useSlaFormat } from "../console";
import { PrepressActionBar, PrepressActionDialogs, usePrepressSettle, type PrepressActionKey } from "./PrepressActions";
import { ArtworkTab, DesignTab, MockupTab, ProofsTab, TemplateTab } from "./PrepressTabs";
import type { PrepressDetail, PrepressTab } from "./resources";

/**
 * One order's prepress workspace (F2 2.4): the customer's files and their preflight, the proof
 * versions and the customer's annotations, the template, the hired-design rounds and the mockup
 * — with the stage, its SLA and the order in the rail. The header restates the order code and
 * the customer on every tab, and leads with the next action the API offers.
 */
export function PrepressWorkspace({
  orderId,
  initial,
  tab,
}: {
  orderId: string;
  initial: PrepressDetail | null;
  tab: PrepressTab;
}) {
  const t = useTranslations("prepress.detail");
  const pathname = usePathname();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<PrepressActionKey | null>(null);
  const [drawing, setDrawing] = useState(false);
  const settle = usePrepressSettle(orderId);

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "prepress", orderId),
    queryFn: () => browserRequests().call("GET /v1/admin/prepress/{orderId}", { path: { orderId } }),
    initialData: initial ?? undefined,
    staleTime: STALE_TIME.transactional,
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const detail = query.data;
  if (!detail) return null;

  const offered = new Set(
    detail.nextActions
      .filter((item) => !item.disabledReason)
      .map((item) => item.key.slice(item.key.lastIndexOf(".") + 1)),
  );

  const go = (next: string) => {
    setCurrent(next);
    // The URL follows without a server round trip; a shared link still opens this tab.
    window.history.replaceState(null, "", next === "artwork" ? pathname : `${pathname}?tab=${next}`);
  };

  const draw = async () => {
    setDrawing(true);
    try {
      await browserRequests().call("POST /v1/admin/prepress/{orderId}/drawing-jobs", {
        path: { orderId },
        body: { format: "pdf" },
      });
      toast.success(t("drawQueued"));
      settle();
    } catch (error) {
      // B4.1 answers 501 drawing.engine_unavailable until the engine ships; its detail says so.
      toast.error(problemMessage(error, t("drawFailed")));
    } finally {
      setDrawing(false);
    }
  };

  const run = (key: PrepressActionKey) => {
    if (key === "draw_dieline") {
      go("template");
      void draw();
      return;
    }
    setAction(key);
  };

  const openThreads = detail.proofs[0]?.annotations.open ?? 0;
  const tabs = [
    { value: "artwork", label: t("tabs.artwork"), content: <ArtworkTab detail={detail} /> },
    {
      value: "proofs",
      label: `${t("tabs.proofs")}${detail.proofs.length ? ` (${detail.proofs.length})` : ""}${openThreads ? " •" : ""}`,
      content: (
        <ProofsTab
          detail={detail}
          onUpload={offered.has("upload_proof") ? () => setAction("upload_proof") : undefined}
        />
      ),
    },
    {
      value: "template",
      label: t("tabs.template"),
      content: (
        <TemplateTab
          detail={detail}
          drawing={drawing}
          onDraw={offered.has("draw_dieline") ? () => void draw() : undefined}
          onSend={offered.has("send_template") ? () => setAction("send_template") : undefined}
        />
      ),
    },
    ...(detail.designService
      ? [{ value: "design", label: t("tabs.design"), content: <DesignTab detail={detail} /> }]
      : []),
    ...(detail.mockup ? [{ value: "mockup", label: t("tabs.mockup"), content: <MockupTab detail={detail} /> }] : []),
  ];
  const shown = tabs.some((item) => item.value === current) ? current : "artwork";

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-bg z-sticky sticky top-16 -mx-4 border-b border-transparent px-4 pt-1 pb-3 md:-mx-6 md:px-6">
        <PageHeader
          breadcrumbs={
            <Breadcrumbs
              label={t("breadcrumb")}
              items={[{ label: t("desk"), href: "/prepress" }, { label: detail.orderCode }]}
            />
          }
          title={<span className="font-mono">{detail.orderCode}</span>}
          meta={
            <>
              <StatusChip map={ARTWORK_STATUS} value={detail.artworkStatus} size="md" />
              {detail.stage ? <Badge>{t(`stages.${detail.stage}`)}</Badge> : null}
              {detail.urgency !== "normal" ? (
                <Badge tone={detail.urgency === "late" ? "danger" : "warning"} icon="warning">
                  {t(`urgency.${detail.urgency}`)}
                </Badge>
              ) : null}
            </>
          }
          description={t("headline", {
            customer: detail.customer.displayName,
            type: detail.productType.name,
            quantity: detail.quantity,
            unit: detail.unit,
          })}
          actions={<PrepressActionBar detail={detail} onAction={run} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs label={t("tabsLabel")} items={tabs} value={shown} onValueChange={go} />
        <PrepressRail detail={detail} onAssign={offered.has("assign") ? () => setAction("assign") : undefined} />
      </div>

      {/* Keyed by the open action, so each opening starts with empty fields. */}
      <PrepressActionDialogs key={action ?? "none"} detail={detail} open={action} onClose={() => setAction(null)} />
    </div>
  );
}

function PrepressRail({ detail, onAssign }: { detail: PrepressDetail; onAssign?: () => void }) {
  const t = useTranslations("prepress.detail.rail");
  const tDetail = useTranslations("prepress.detail");
  const format = useFormat();
  const sla = useSlaFormat();
  const actor = useActor();

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("stage")}</CardTitle>
        </CardHeader>
        <p className="text-sm font-medium">{detail.stage ? tDetail(`stages.${detail.stage}`) : t("noStage")}</p>
        {detail.stage && detail.stage !== "awaiting_customer" ? (
          <SlaTimer
            dueAt={detail.slaDueAt}
            format={sla}
            absolute={detail.slaDueAt ? format.dateTime(detail.slaDueAt) : undefined}
          />
        ) : detail.stage === "awaiting_customer" ? (
          <p className="text-muted text-xs">{t("withCustomer")}</p>
        ) : null}
      </Card>

      <Card padding="md">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("owner")}</CardTitle>
          {onAssign ? (
            <Button size="sm" variant="secondary" iconStart="user-plus" onClick={onAssign}>
              {detail.assignee ? t("reassign") : t("assign")}
            </Button>
          ) : null}
        </CardHeader>
        <p className="text-sm">
          {detail.assignee ? (
            detail.assignee.id === actor.id ? (
              t("you")
            ) : (
              detail.assignee.displayName
            )
          ) : (
            <span className="text-warning-subtle-fg font-medium">{t("unassigned")}</span>
          )}
        </p>
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("order")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={1}
          items={[
            {
              term: t("orderCode"),
              description: (
                <Link href={`/orders/${detail.orderId}`} className="text-primary font-mono hover:underline">
                  {detail.orderCode}
                </Link>
              ),
            },
            { term: t("customer"), description: detail.customer.displayName },
            { term: t("design"), description: t(`designOptions.${detail.designOption}`) },
            { term: t("mockup"), description: t(`mockupOptions.${detail.mockupOption}`) },
            { term: t("promised"), description: format.date(detail.promisedShipDate) },
          ]}
        />
      </Card>

      {detail.specs.length > 0 ? (
        <Card padding="md">
          <CardHeader>
            <CardTitle>{t("specs")}</CardTitle>
          </CardHeader>
          <DescriptionList
            columns={1}
            items={detail.specs.map((spec) => ({ term: spec.label, description: spec.value }))}
          />
        </Card>
      ) : null}
    </div>
  );
}
