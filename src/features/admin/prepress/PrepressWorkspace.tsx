"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { adminPrepressActions } from "@/domain/next-actions/admin";
import { ARTWORK_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { PageHeader } from "@/ui/components/PageHeader";
import { Skeleton } from "@/ui/components/Skeleton";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, StatusChip, useActor, useProductTypes } from "../console";
import { useOrder } from "../orders/data";
import type { Order } from "../orders/resources";
import { useDrawings, useOrderDesignService, usePrepressSettle, useProofs, useSubmissions, useTemplates } from "./data";
import {
  PrepressActionBar,
  PrepressActionDialogs,
  type PrepressActionKey,
  type PrepressOwner,
} from "./PrepressActions";
import { ArtworkTab, DesignTab, ProofsTab, TemplateTab } from "./PrepressTabs";
import type { PrepressTab } from "./resources";

/**
 * One order's prepress workspace (F2 2.4): the customer's files and their preflight, the proof
 * versions and the customer's annotations, the template, and the hired-design rounds — with the
 * order in the rail. The header restates the order code on every tab and leads with what
 * `adminPrepressActions` offers.
 *
 * Composed from the lean order (`admin.orders.get`) and its artwork resources (`admin.artwork.list`,
 * `.listProofs`, `.listTemplates`, `admin.designs.listOrderDrawings`, `admin.designServices.list`);
 * no workspace aggregate is published, by getpack-api's decision. CONTRACT-GAP admin.prepress — no
 * stage or its SLA here (they are on the desk's queue rows, with the owner), no dieline size of the
 * order's own, no owner on the order (the owner shown is the one assigned on this page,
 * `admin.artwork.assignPrepress` answers 204), and no design document. The mockup job is not here:
 * D-192 replaces it with the sample, which comes to this page with U2.F.
 */
export function PrepressWorkspace({
  orderId,
  initial,
  tab,
}: {
  orderId: string;
  initial: Order | null;
  tab: PrepressTab;
}) {
  const t = useTranslations("prepress.detail");
  const pathname = usePathname();
  const actor = useActor();
  const productTypes = useProductTypes();
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<PrepressActionKey | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [owner, setOwner] = useState<PrepressOwner | undefined>(undefined);
  const settle = usePrepressSettle(orderId);

  const query = useOrder(orderId, initial);
  const submissions = useSubmissions(orderId);
  const proofs = useProofs(orderId);
  const templates = useTemplates(orderId);
  const drawings = useDrawings(orderId);
  const design = useOrderDesignService(query.data);

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const order = query.data;
  if (!order) return null;
  const failed = [submissions, proofs, templates].find((item) => item.isError);
  if (failed) return <QueryError error={failed.error} onRetry={() => void failed.refetch()} />;
  if (!submissions.data || !proofs.data) return <Skeleton className="h-64" />;

  const service = design.data ?? null;
  const actions = adminPrepressActions(
    {
      artworkStatus: order.artworkStatus,
      latestSubmission: submissions.data[0]?.status ?? null,
      latestProof: proofs.data[0]?.status ?? null,
      designService: service?.status ?? null,
    },
    (permission) => actor.permissions.includes(permission),
  );
  const offered = new Set(actions.map((item) => item.key.slice("prepress.".length)));

  const go = (next: string) => {
    setCurrent(next);
    // The URL follows without a server round trip; a shared link still opens this tab.
    window.history.replaceState(null, "", next === "artwork" ? pathname : `${pathname}?tab=${next}`);
  };

  const draw = async () => {
    setDrawing(true);
    try {
      await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/drawings", {
        params: { path: { orderId } },
        body: { format: "pdf" },
      });
      toast.success(t("drawQueued"));
      settle();
    } catch (error) {
      // getpack-api answers 501 drawing.engine_unavailable until the engine ships; its detail says so.
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

  const openThreads = proofs.data[0]?.annotations.filter((item) => !item.parentId && !item.resolvedAt).length ?? 0;
  const tabs = [
    {
      value: "artwork",
      label: t("tabs.artwork"),
      content: <ArtworkTab order={order} submissions={submissions.data} />,
    },
    {
      value: "proofs",
      label: `${t("tabs.proofs")}${proofs.data.length ? ` (${proofs.data.length})` : ""}${openThreads ? " •" : ""}`,
      content: (
        <ProofsTab
          proofs={proofs.data}
          submissions={submissions.data}
          onUpload={offered.has("upload_proof") ? () => setAction("upload_proof") : undefined}
        />
      ),
    },
    {
      value: "template",
      label: t("tabs.template"),
      content: (
        <TemplateTab
          deliveries={templates.data ?? []}
          drawings={drawings.data ?? []}
          drawing={drawing}
          onDraw={offered.has("draw_dieline") ? () => void draw() : undefined}
          onSend={offered.has("send_template") ? () => setAction("send_template") : undefined}
        />
      ),
    },
    ...(order.designOption === "hired_design"
      ? [
          {
            value: "design",
            label: t("tabs.design"),
            content: design.isPending ? <Skeleton className="h-40" /> : <DesignTab service={service} />,
          },
        ]
      : []),
  ];
  const shown = tabs.some((item) => item.value === current) ? current : "artwork";

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-bg z-sticky sticky top-16 -mx-4 border-b border-transparent px-4 pt-1 pb-3 md:-mx-6 md:px-6">
        <PageHeader
          breadcrumbs={
            <Breadcrumbs
              label={t("breadcrumb")}
              items={[{ label: t("desk"), href: "/prepress" }, { label: order.orderCode }]}
            />
          }
          title={<span className="tabular-nums">{order.orderCode}</span>}
          meta={<StatusChip map={ARTWORK_STATUS} value={order.artworkStatus} size="md" />}
          description={t("headline", {
            type: productTypes.labelOf(order.productTypeCode),
            quantity: order.quantityOrdered,
          })}
          actions={<PrepressActionBar actions={actions} onAction={run} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs label={t("tabsLabel")} items={tabs} value={shown} onValueChange={go} />
        <PrepressRail
          order={order}
          owner={owner}
          onAssign={offered.has("assign") ? () => setAction("assign") : undefined}
        />
      </div>

      {/* Keyed by the open action, so each opening starts with empty fields. */}
      <PrepressActionDialogs
        key={action ?? "none"}
        order={order}
        submissions={submissions.data}
        proofs={proofs.data}
        designService={service}
        owner={owner}
        onAssigned={setOwner}
        open={action}
        onClose={() => setAction(null)}
      />
    </div>
  );
}

function PrepressRail({
  order,
  owner,
  onAssign,
}: {
  order: Order;
  owner: PrepressOwner | undefined;
  onAssign?: () => void;
}) {
  const t = useTranslations("prepress.detail.rail");
  const format = useFormat();
  const actor = useActor();
  const en = useLocale() === "en";
  const specs = order.summary.specs;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>{t("owner")}</CardTitle>
          {onAssign ? (
            <Button size="sm" variant="secondary" iconStart="user-plus" onClick={onAssign}>
              {owner ? t("reassign") : t("assign")}
            </Button>
          ) : null}
        </CardHeader>
        {/* CONTRACT-GAP admin.prepress — the owner is not published; only an assignment made here is known. */}
        <p className="text-sm">
          {owner === undefined ? (
            <span className="text-muted">{t("ownerUnknown")}</span>
          ) : owner === null ? (
            <span className="text-warning-subtle-fg font-medium">{t("unassigned")}</span>
          ) : owner.id === actor.id ? (
            t("you")
          ) : (
            owner.displayName
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
                <Link href={`/orders/${order.id}`} className="text-primary tabular-nums hover:underline">
                  {order.orderCode}
                </Link>
              ),
            },
            { term: t("design"), description: t(`designOptions.${order.designOption}`) },
            { term: t("mockup"), description: t(`mockupOptions.${order.mockupOption}`) },
            { term: t("promised"), description: format.date(order.promisedShipDate) },
          ]}
        />
      </Card>

      <Card padding="md">
        <CardHeader>
          <CardTitle>{t("specs")}</CardTitle>
        </CardHeader>
        {specs.length > 0 ? (
          <DescriptionList
            columns={1}
            items={specs.map((line) => ({
              term: en ? line.labelEn : line.labelTh,
              description: en ? line.valueEn : line.valueTh,
            }))}
          />
        ) : (
          <p className="text-muted text-sm">{t("noSpecs")}</p>
        )}
      </Card>
    </div>
  );
}
