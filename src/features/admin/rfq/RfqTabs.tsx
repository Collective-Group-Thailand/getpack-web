"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CONSULTATION_STATUS, RFQ_QUOTE_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat, When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, problemMessage, StatusChip, useCan, useSlaFormat } from "../console";
import { FileItem } from "../prepress/FileItem";
import { useCandidateFactories, useSettleRfq } from "./data";
import { QuoteComposer } from "./QuoteComposer";
import { byVersionDesc, draftOf, type Rfq, type RfqConsultation, type RfqQuote, type RfqQuoteLine } from "./resources";

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

/** A raw spec answer as text, for a request whose category form rendered no lines. */
function specValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (Array.isArray(value)) return value.map(specValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ------------------------------------------------------------------------------------ request */

export function RequestTab({ rfq }: { rfq: Rfq }) {
  const t = useTranslations("rfq.detail.request");
  const format = useFormat();
  const locale = useLocale();
  const en = locale === "en";
  const sized = rfq.lengthMm !== null || rfq.widthMm !== null || rfq.heightMm !== null;
  // The spec as the category form renders it (`specLines`); the raw answers only when it rendered none.
  const spec =
    rfq.specLines.length > 0
      ? rfq.specLines.map((line) => ({
          term: en ? line.labelEn : line.labelTh,
          description: en ? line.valueEn : line.valueTh,
        }))
      : Object.entries(rfq.spec).map(([key, value]) => ({ term: key, description: specValue(value) }));
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("title")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("productType"), description: rfq.productTypeName },
            {
              term: t("quantities"),
              description: rfq.quantities.map((quantity) => format.number(quantity)).join(" / "),
            },
            {
              term: t("size"),
              description: sized
                ? t("sizeValue", {
                    length: rfq.lengthMm ?? "–",
                    width: rfq.widthMm ?? "–",
                    height: rfq.heightMm ?? "–",
                  })
                : t("noSize"),
            },
            { term: t("targetDate"), description: rfq.targetDate ? format.date(rfq.targetDate) : t("noTarget") },
            // CONTRACT-GAP admin.rfqs — the delivery province is not published; the postcode is.
            { term: t("delivery"), description: rfq.deliveryPostcode },
            { term: t("channel"), description: t(`channels.${rfq.channel}`) },
            ...(rfq.notes ? [{ term: t("notes"), description: rfq.notes, wide: true }] : []),
          ]}
        />
      </Section>
      <Section title={t("spec")}>
        {spec.length > 0 ? (
          <DescriptionList columns={2} items={spec} />
        ) : (
          <p className="text-muted text-sm">{t("noSpec")}</p>
        )}
      </Section>
      <Section title={t("files")}>
        {rfq.files.length === 0 ? (
          <p className="text-muted text-sm">{t("noFiles")}</p>
        ) : (
          <ul className="space-y-2">
            {rfq.files.map((file) => (
              <li key={file.id}>
                <FileItem fileId={file.id} name={file.originalName} sizeBytes={file.sizeBytes} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------------------------- factories */

/**
 * The factories asked and what they answered, and who asked. A consultation names its factory by
 * code; the name comes from the RFQ's candidate factories (`admin.rfqs.listCandidateFactories`).
 * A factory's buy prices are published only to `factory_buy_prices.read` (D-141). CONTRACT-GAP
 * admin.rfq-consultations — nobody sees a suggested sell price derived from the answer.
 */
export function FactoriesTab({ rfq, onRequest }: { rfq: Rfq; onRequest?: () => void }) {
  const t = useTranslations("rfq.detail.factories");
  const format = useFormat();
  const sla = useSlaFormat();
  const canManage = useCan("rfqs.manage");
  const candidates = useCandidateFactories(rfq.id, rfq.consultations.length > 0);
  const nameOf = (factoryId: string) => candidates.data?.find((item) => item.factoryId === factoryId)?.name;

  const remind = useMutation({
    // One reminder an hour at most; the API says so (`rfq.reminder_recent`).
    mutationFn: async (consultationId: string) => {
      await adminBrowserApis().contract.POST("/v1/admin/rfq-consultations/{consultationId}/actions/remind", {
        params: { path: { consultationId }, header: { "Idempotency-Key": newIdempotencyKey() } },
      });
    },
    onSuccess: () => toast.success(t("reminded")),
    onError: (error) => toast.error(problemMessage(error, t("remindFailed"))),
  });

  const seesCost = rfq.consultations.some((item) => item.lines !== null);

  const columns: DataTableColumn<RfqConsultation>[] = [
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{nameOf(row.factoryId) ?? row.factoryCode}</p>
          <p className="text-muted text-xs tabular-nums">{row.factoryCode}</p>
          <p className="text-muted text-xs">{t("requestedBy", { name: row.requestedBy.displayName })}</p>
        </div>
      ),
    },
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
      header: seesCost ? t("prices") : t("reply"),
      cell: (row) =>
        row.lines && row.lines.length > 0 ? (
          <ul className="space-y-0.5 text-sm tabular-nums">
            {row.lines.map((line) => (
              <li key={line.quantity} className="whitespace-nowrap">
                {t("tierPrice", { quantity: format.number(line.quantity), price: format.thb(line.buyUnitPrice) })}
                <span className="text-muted"> · {t("days", { days: line.leadTimeDays })}</span>
              </li>
            ))}
          </ul>
        ) : row.status === "requested" ? (
          <span className="text-muted text-sm">{t("waiting")}</span>
        ) : row.status === "responded" ? (
          <span className="text-muted text-sm">{t("answered")}</span>
        ) : (
          "–"
        ),
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

  const notes = rfq.consultations.filter((item) => item.responseNote);

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
      <p className="text-muted mb-3 text-xs">{seesCost ? t("costNote") : t("noCostNote")}</p>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={rfq.consultations}
        getRowId={(row) => row.id}
        density="compact"
        empty={<EmptyState icon="factory" title={t("none")} description={t("noneBody")} />}
      />
      {notes.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {notes.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{nameOf(item.factoryId) ?? item.factoryCode}:</span> {item.responseNote}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------------------------- quotes */

/**
 * One quotation version as the API priced it. The buy price shows to `factory_buy_prices.read`, the
 * margin to `margin.read` (D-141); a line below the margin floor is flagged (D-012), and the API
 * still lets it be sent. CONTRACT-GAP admin.rfq-quotes — no suggested price per line, no author or
 * creation time, no acceptance time.
 */
function QuoteVersion({ quote }: { quote: RfqQuote }) {
  const t = useTranslations("rfq.detail.quotes");
  const format = useFormat();
  const seesCost = quote.lines.some((line) => line.buyUnitPrice !== null);
  const seesMargin = quote.lines.some((line) => line.marginPct !== null);
  const columns: DataTableColumn<RfqQuoteLine>[] = [
    { id: "quantity", header: t("quantity"), numeric: true, cell: (row) => format.number(row.quantity) },
    { id: "unitPrice", header: t("unitPrice"), numeric: true, cell: (row) => format.thb(row.unitPrice) },
    { id: "shipping", header: t("shipping"), numeric: true, cell: (row) => format.thb(row.shippingNetAmount) },
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
            cell: (row: RfqQuoteLine) => (row.buyUnitPrice ? format.thb(row.buyUnitPrice) : "–"),
          },
        ]
      : []),
    ...(seesMargin
      ? [
          {
            id: "margin",
            header: t("margin"),
            numeric: true,
            cell: (row: RfqQuoteLine) => (row.marginPct ? format.percent(row.marginPct) : "–"),
          },
        ]
      : []),
    ...(quote.lines.some((line) => line.belowMarginFloor)
      ? [
          {
            id: "floor",
            header: t("floor"),
            cell: (row: RfqQuoteLine) =>
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
          {quote.validUntil ? t("validUntil", { date: format.date(quote.validUntil) }) : t("validityAtSend")}
          {quote.sentAt ? (
            <>
              {" · "}
              {t("sentAt")} <When at={quote.sentAt} />
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
      {quote.note ? <p className="text-muted mt-3 text-sm">{quote.note}</p> : null}
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
  const draft = draftOf(rfq);
  const others = byVersionDesc(rfq.quotations.filter((quote) => quote !== draft));
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
            {rfq.quotations.length > 0 ? t("newVersion") : t("compose")}
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

/** Files staff may attach to one message (`StaffRfqMessageInputDto.fileIds`, ≤ 10, purpose `artwork`). */
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * The thread, inline on the RFQ (`admin.rfqs.get`), with each message's files; posting answers
 * the whole RFQ, which replaces the cached one. Staff attach files uploaded first through the
 * file flow (presign → upload → complete).
 */
export function MessagesTab({ rfq }: { rfq: Rfq }) {
  const t = useTranslations("rfq.detail.messages");
  const canManage = useCan("rfqs.manage");
  const settle = useSettleRfq(rfq.id);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"customer" | "internal">("internal");
  const [files, setFiles] = useState<File[]>([]);

  const send = useMutation({
    mutationFn: async () => {
      const uploaded = await Promise.all(files.map((file) => uploadFile("admin", file, "artwork")));
      return (
        await adminBrowserApis().contract.POST("/v1/admin/rfqs/{rfqId}/messages", {
          params: { path: { rfqId: rfq.id } },
          body: {
            body: body.trim(),
            visibility,
            ...(uploaded.length > 0 ? { fileIds: uploaded.map((file) => file.id) } : {}),
          },
        })
      ).data!;
    },
    onSuccess: (updated) => {
      setBody("");
      setFiles([]);
      toast.success(visibility === "customer" ? t("sentToCustomer") : t("noted"));
      settle(updated);
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  return (
    <Section title={t("title")}>
      <ol className="space-y-3">
        {rfq.messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              "rounded-md border p-3 text-sm",
              message.visibility === "internal" ? "border-warning bg-warning-subtle" : "border-border",
              message.author === "getpack" ? "sm:ms-12" : "sm:me-12",
            )}
          >
            <p className="text-muted flex flex-wrap items-center gap-2 text-xs">
              <span className="text-fg font-medium">{message.authorUser.displayName}</span>
              <span>{message.author === "customer" ? t("fromCustomer") : t("fromStaff")}</span>
              {message.visibility === "internal" ? <Badge size="sm">{t("internal")}</Badge> : null}
              <When at={message.createdAt} />
            </p>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            {message.files.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {message.files.map((file) => (
                  <li key={file.id}>
                    <FileItem fileId={file.id} name={file.originalName} sizeBytes={file.sizeBytes} />
                  </li>
                ))}
              </ul>
            ) : null}
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
          <Field label={t("attach")} hint={t("attachHint", { count: MAX_FILES })}>
            <FileDropzone
              multiple
              maxBytes={MAX_BYTES}
              onFiles={(picked) => setFiles((current) => [...current, ...picked].slice(0, MAX_FILES))}
              labels={{
                prompt: files.length ? t("chosen", { names: files.map((file) => file.name).join(", ") }) : t("drop"),
                browse: t("browse"),
                tooLarge: (name) => t("tooLarge", { name }),
                wrongType: (name) => t("wrongType", { name }),
              }}
            />
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
