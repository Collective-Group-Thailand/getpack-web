"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CONSULTATION_STATUS, RFQ_QUOTE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { problemMessage, StatusChip, useCan, useSlaFormat } from "../console";
import { QuoteComposer } from "./QuoteComposer";
import type { Rfq, RfqConsultation, RfqQuote } from "./resources";

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------ request */

export function RequestTab({ rfq }: { rfq: Rfq }) {
  const t = useTranslations("rfq.detail.request");
  const format = useFormat();
  const size = rfq.dimensions;
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("title")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("productType"), description: rfq.productType.name },
            {
              term: t("quantities"),
              description: rfq.quantities.map((quantity) => format.number(quantity)).join(" / "),
            },
            {
              term: t("size"),
              description:
                size && (size.lengthMm || size.widthMm || size.heightMm)
                  ? t("sizeValue", {
                      length: size.lengthMm ?? "–",
                      width: size.widthMm ?? "–",
                      height: size.heightMm ?? "–",
                    })
                  : t("noSize"),
            },
            { term: t("targetDate"), description: rfq.targetDate ? format.date(rfq.targetDate) : t("noTarget") },
            {
              term: t("delivery"),
              description: [rfq.province, rfq.deliveryPostcode].filter(Boolean).join(" "),
            },
            { term: t("channel"), description: t(`channels.${rfq.channel}`) },
            ...(rfq.notes ? [{ term: t("notes"), description: rfq.notes, wide: true }] : []),
          ]}
        />
      </Section>
      <Section title={t("spec")}>
        {rfq.spec.length > 0 ? (
          <DescriptionList
            columns={2}
            items={rfq.spec.map((item) => ({ term: item.label, description: item.value }))}
          />
        ) : (
          <p className="text-muted text-sm">{t("noSpec")}</p>
        )}
        <p className="text-muted mt-3 text-xs">{t("specVersion", { version: rfq.specSchemaVersion })}</p>
      </Section>
      <Section title={t("files")}>
        {rfq.files.length === 0 ? (
          <p className="text-muted text-sm">{t("noFiles")}</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {rfq.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name="paperclip" size={16} />
                  <span className="truncate">{file.originalName}</span>
                  <span className="text-muted text-xs">{format.bytes(file.sizeBytes)}</span>
                </span>
                {file.url ? (
                  <Button variant="link" size="sm" iconStart="download" asChild>
                    <a href={file.url} download={file.originalName}>
                      {t("download")}
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------------------------- factories */

export function FactoriesTab({ rfq, onRequest }: { rfq: Rfq; onRequest?: () => void }) {
  const t = useTranslations("rfq.detail.factories");
  const format = useFormat();
  const sla = useSlaFormat();
  const canManage = useCan("rfqs.manage");

  const remind = useMutation({
    mutationFn: (consultationId: string) =>
      browserRequests().call("POST /v1/admin/rfqs/{rfqId}/consultations/{consultationId}/actions/remind", {
        path: { rfqId: rfq.id, consultationId },
      }),
    onSuccess: () => toast.success(t("reminded")),
    onError: (error) => toast.error(problemMessage(error, t("remindFailed"))),
  });

  const seesCost = rfq.consultations.some((item) => item.response?.tiers.some((tier) => tier.buyUnitPrice));

  const columns: DataTableColumn<RfqConsultation>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => (
        <div className="min-w-48">
          <p className="font-medium">{row.factory.name}</p>
          <p className="text-muted font-mono text-xs">{row.factory.code}</p>
        </div>
      ),
    },
    { id: "tier", header: t("tier"), cell: (row) => (row.tier ? <Badge size="sm">{row.tier}</Badge> : "–") },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={CONSULTATION_STATUS} value={row.status} /> },
    {
      id: "due",
      header: t("due"),
      cell: (row) =>
        row.status === "requested" ? (
          <SlaTimer dueAt={row.dueAt} format={sla} absolute={format.dateTime(row.dueAt)} />
        ) : row.respondedAt ? (
          <span className="text-muted text-xs">
            {t("respondedAt")} <When at={row.respondedAt} />
          </span>
        ) : (
          "–"
        ),
    },
    {
      id: "prices",
      header: seesCost ? t("pricesWithCost") : t("prices"),
      cell: (row) =>
        row.response ? (
          <ul className="space-y-0.5 text-sm tabular-nums">
            {row.response.tiers.map((tier) => (
              <li key={tier.quantity} className="whitespace-nowrap">
                {t("tierPrice", { quantity: format.number(tier.quantity), price: format.thb(tier.suggestedUnitPrice) })}
                {tier.buyUnitPrice ? (
                  <span className="text-muted"> · {t("buy", { price: format.thb(tier.buyUnitPrice) })}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : row.declineNote ? (
          <span className="text-muted text-sm">{row.declineNote}</span>
        ) : (
          <span className="text-muted text-sm">{t("waiting")}</span>
        ),
    },
    {
      id: "leadTime",
      header: t("leadTime"),
      numeric: true,
      cell: (row) => (row.response ? t("days", { days: row.response.leadTimeDays }) : "–"),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) =>
        canManage && row.status === "requested" ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="bell"
            loading={remind.isPending && remind.variables === row.id}
            onClick={() => remind.mutate(row.id)}
          >
            {t("remind")}
          </Button>
        ) : null,
    },
  ];

  return (
    <Section
      title={t("title")}
      actions={
        onRequest ? (
          <Button size="sm" iconStart="send" onClick={onRequest}>
            {t("request")}
          </Button>
        ) : null
      }
    >
      <p className="text-muted mb-3 text-xs">{seesCost ? t("costNote") : t("sellNote")}</p>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rfq.consultations}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="factory" title={t("none")} description={t("noneBody")} />}
      />
      {rfq.consultations.some((item) => item.response?.notes) ? (
        <ul className="mt-3 space-y-1 text-sm">
          {rfq.consultations
            .filter((item) => item.response?.notes)
            .map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.factory.name}:</span> {item.response!.notes}
              </li>
            ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------------------------- quotes */

function QuoteVersion({ quote }: { quote: RfqQuote }) {
  const t = useTranslations("rfq.detail.quotes");
  const format = useFormat();
  type Line = RfqQuote["lines"][number];
  const seesCost = quote.lines.some((line) => line.buyUnitPrice);
  const seesMargin = quote.lines.some((line) => line.marginPct);
  const columns: DataTableColumn<Line>[] = [
    { id: "quantity", header: t("quantity"), numeric: true, cell: (row) => format.number(row.quantity) },
    {
      id: "unitPrice",
      header: t("unitPrice"),
      numeric: true,
      cell: (row) => (
        <div>
          <p>{format.thb(row.unitPrice)}</p>
          {row.suggestedUnitPrice ? (
            <p className="text-muted text-xs">{t("suggested", { price: format.thb(row.suggestedUnitPrice) })}</p>
          ) : null}
        </div>
      ),
    },
    { id: "net", header: t("net"), numeric: true, cell: (row) => format.thb(row.netAmount) },
    { id: "vat", header: t("vat"), numeric: true, cell: (row) => format.thb(row.vatAmount) },
    {
      id: "gross",
      header: t("gross"),
      numeric: true,
      cell: (row) => <span className="font-medium">{format.thb(row.grossAmount)}</span>,
    },
    { id: "leadTime", header: t("leadTime"), numeric: true, cell: (row) => t("days", { days: row.leadTimeDays }) },
    ...(seesCost
      ? [
          {
            id: "cost",
            header: t("cost"),
            numeric: true,
            cell: (row: Line) =>
              row.buyUnitPrice ? (
                <div>
                  <p>{format.thb(row.buyUnitPrice)}</p>
                  {row.factory ? <p className="text-muted text-xs">{row.factory.name}</p> : null}
                </div>
              ) : (
                "–"
              ),
          },
        ]
      : []),
    ...(seesMargin
      ? [
          {
            id: "margin",
            header: t("margin"),
            numeric: true,
            cell: (row: Line) => (row.marginPct ? format.percent(row.marginPct) : "–"),
          },
        ]
      : []),
    ...(quote.lines.some((line) => line.belowMarginFloor)
      ? [
          {
            id: "floor",
            header: t("floor"),
            cell: (row: Line) =>
              row.belowMarginFloor ? (
                <Badge tone="danger" size="sm" icon="warning">
                  {t("belowFloor")}
                </Badge>
              ) : null,
          },
        ]
      : []),
  ];
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {t("version", { version: quote.versionNo })}
          <StatusChip map={RFQ_QUOTE_STATUS} value={quote.status} />
        </CardTitle>
        <p className="text-muted text-xs">
          {t("validUntil", { date: format.date(quote.validUntil) })}
          {quote.sentAt ? (
            <>
              {" · "}
              {t("sentAt")} <When at={quote.sentAt} />
            </>
          ) : null}
          {quote.acceptedAt ? (
            <>
              {" · "}
              {t("acceptedAt")} <When at={quote.acceptedAt} />
            </>
          ) : null}
        </p>
      </CardHeader>
      <DataTable
        caption={t("version", { version: quote.versionNo })}
        columns={columns}
        rows={quote.lines}
        getRowId={(row) => String(row.quantity)}
        density="compact"
        rowTone={(row) => (row.belowMarginFloor ? "danger" : undefined)}
      />
      {quote.customerNote ? <p className="text-muted mt-3 text-sm">{quote.customerNote}</p> : null}
      <p className="text-muted mt-2 text-xs">
        {t("by", { name: quote.createdBy.displayName })} · <When at={quote.createdAt} />
      </p>
    </Card>
  );
}

export function QuotesTab({
  rfq,
  composing,
  onCompose,
  onCloseComposer,
  onSend,
}: {
  rfq: Rfq;
  composing: boolean;
  onCompose?: () => void;
  onCloseComposer: () => void;
  onSend?: () => void;
}) {
  const t = useTranslations("rfq.detail.quotes");
  const draft = rfq.quotes.find((quote) => quote.status === "draft");
  const sendBlocked = rfq.nextActions.find((action) => action.key === "rfq.send_quote")?.disabledReason;
  const others = rfq.quotes.filter((quote) => quote !== draft);
  const showComposer = composing || Boolean(draft && onCompose);

  return (
    <div className="flex flex-col gap-4">
      {showComposer ? (
        <>
          {/* The key remounts the composer when a saved draft comes back, so its fields start from the API's figures. */}
          <QuoteComposer
            key={draft ? `${draft.id}:${JSON.stringify(draft.lines)}` : "new"}
            rfq={rfq}
            draft={draft}
            onClose={onCloseComposer}
          />
          {draft ? (
            <>
              <QuoteVersion quote={draft} />
              {sendBlocked ? <Callout tone="danger" title={sendBlocked} /> : null}
              {onSend ? (
                <div className="flex justify-end">
                  <Button iconStart="send" onClick={onSend}>
                    {t("send", { version: draft.versionNo })}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : draft ? (
        <QuoteVersion quote={draft} />
      ) : onCompose ? (
        <div className="flex justify-end">
          <Button iconStart="plus" onClick={onCompose}>
            {rfq.quotes.length > 0 ? t("newVersion") : t("compose")}
          </Button>
        </div>
      ) : null}
      {others.length === 0 && !showComposer && !draft ? (
        <EmptyState icon="receipt" title={t("none")} description={t("noneBody")} />
      ) : null}
      {others.map((quote) => (
        <QuoteVersion key={quote.id} quote={quote} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------------- messages */

export function MessagesTab({ rfq }: { rfq: Rfq }) {
  const t = useTranslations("rfq.detail.messages");
  const canManage = useCan("rfqs.manage");
  const queryClient = useQueryClient();
  const key = queryKeys.related("admin", "rfq", rfq.id, "messages");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"customer" | "internal">("internal");

  const thread = useQuery({
    queryKey: key,
    queryFn: () => browserRequests().call("GET /v1/admin/rfqs/{rfqId}/messages", { path: { rfqId: rfq.id } }),
    staleTime: STALE_TIME.transactional,
  });

  const send = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/rfqs/{rfqId}/messages", {
        path: { rfqId: rfq.id },
        body: { body: body.trim(), visibility },
      }),
    onSuccess: () => {
      setBody("");
      toast.success(visibility === "customer" ? t("sentToCustomer") : t("noted"));
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "rfq", rfq.id) });
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  return (
    <Section title={t("title")}>
      {thread.isError ? <p className="text-danger text-sm">{problemMessage(thread.error, t("loadFailed"))}</p> : null}
      <ol className="space-y-3">
        {(thread.data?.data ?? []).map((message) => (
          <li
            key={message.id}
            className={cn(
              "rounded-md border p-3 text-sm",
              message.visibility === "internal" ? "border-warning bg-warning-subtle" : "border-border",
              message.authorKind === "staff" ? "sm:ms-12" : "sm:me-12",
            )}
          >
            <p className="text-muted flex flex-wrap items-center gap-2 text-xs">
              <span className="text-fg font-medium">{message.author?.displayName ?? t("customer")}</span>
              <span>{message.authorKind === "customer" ? t("fromCustomer") : t("fromStaff")}</span>
              {message.visibility === "internal" ? <Badge size="sm">{t("internal")}</Badge> : null}
              <When at={message.createdAt} />
            </p>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ol>
      {canManage ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <SegmentedControl
            label={t("visibility")}
            value={visibility}
            onValueChange={setVisibility}
            options={[
              { value: "internal", label: t("toTeam"), icon: "lock" },
              { value: "customer", label: t("toCustomer"), icon: "chat" },
            ]}
          />
          <Field
            label={visibility === "customer" ? t("messageCustomer") : t("messageTeam")}
            hint={visibility === "customer" ? t("customerHint") : t("teamHint")}
          >
            <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" iconStart="send" loading={send.isPending} disabled={!body.trim()}>
              {visibility === "customer" ? t("sendCustomer") : t("sendTeam")}
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}
