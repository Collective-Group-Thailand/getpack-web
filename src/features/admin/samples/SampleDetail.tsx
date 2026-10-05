"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { SAMPLE_KIND, SAMPLE_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { EvidenceForm } from "@/features/shared/samples/EvidenceForm";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, problemMessage, QueryError, Section, StatusChip } from "../console";
import { useCan } from "../console/actor";
import type { AdminSample } from "./resources";

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** An evidence photo through the admin file download. */
function Photo({ id, alt }: { id: string; alt: string }) {
  const url = useQuery({
    queryKey: queryKeys.related("admin", "files", id, "download"),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/files/{fileId}/download", { params: { path: { fileId: id } } }))
        .data!.url,
    staleTime: 60_000,
  }).data;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the API's file host
    <img src={url} alt={alt} className="border-border h-32 w-44 rounded-md border object-cover" />
  ) : (
    <span className="bg-bg-subtle block h-32 w-44 rounded-md" aria-hidden="true" />
  );
}

/**
 * One sample for CS (U2.F3, D-253–D-257): what the customer asked for, the quote to make
 * (`admin.samples.quote`: an amount through the service sell table, freight for the parcel weight,
 * lead time), the evidence before it ships, the customer's decision with its record (time, IP, user
 * agent, the photos seen), cancelling with a reason, and a new sample after changes were asked for.
 */
export function SampleDetail({ sampleId }: { sampleId: string }) {
  const t = useTranslations("orders.samples");
  const tEvidence = useTranslations("common.sampleEvidence");
  const locale = useLocale() as "th" | "en";
  const format = useFormat();
  const queryClient = useQueryClient();
  const router = useRouter();
  const canManage = useCan("samples.manage");
  const key = queryKeys.detail("admin", "sample", sampleId);
  const [dialog, setDialog] = useState<"quote" | "cancel" | "resample" | null>(null);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [lead, setLead] = useState("");
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState("");
  const [postcode, setPostcode] = useState<string | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/samples/{sampleId}", { params: { path: { sampleId } } })).data!,
  });
  const items = useQuery({
    queryKey: queryKeys.list("admin", "cs-service-items"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/cs/service/input-data")).data!.items,
    enabled: canManage && dialog !== null,
    staleTime: 10 * 60_000,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const sample = query.data;
  if (!sample) return null;

  const settle = (updated: AdminSample) => {
    queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "sample") });
  };
  const path = { params: { path: { sampleId } } };
  const config = sample.configuration as Record<string, unknown>;
  const ev = sample.evidence;
  const itemOptions = (items.data ?? []).map((i) => ({ value: i.id, label: locale === "en" ? i.nameEn : i.nameTh }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("title"), href: "/samples" }, { label: t(`mockup.${sample.mockupOption}`) }]}
          />
        }
        title={t("detailTitle", { kind: t(`mockup.${sample.mockupOption}`) })}
        meta={
          <>
            <StatusChip map={SAMPLE_STATUS} value={sample.status} size="md" />
            <StatusChip map={SAMPLE_KIND} value={sample.kind} />
          </>
        }
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              {sample.status === "requested" ? <Button onClick={() => setDialog("quote")}>{t("quote")}</Button> : null}
              {sample.status === "changes_requested" && sample.kind === "attached" && sample.orderId ? (
                <Button variant="secondary" onClick={() => setDialog("resample")}>
                  {t("resample")}
                </Button>
              ) : null}
              {!["approved", "rejected", "cancelled", "expired"].includes(sample.status) ? (
                <Button variant="ghost" className="text-danger" onClick={() => setDialog("cancel")}>
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      <Section title={t("request")}>
        <DescriptionList
          columns={2}
          items={[
            { term: t("customer"), description: sample.customerName ?? "—" },
            {
              term: t("order"),
              description: sample.orderId ? (
                <Link href={`/orders/${sample.orderId}`} className="text-primary hover:underline">
                  {sample.orderCode}
                </Link>
              ) : (
                t("noOrder")
              ),
            },
            { term: t("quantity"), description: format.number(sample.quantity) },
            {
              term: t("size"),
              description:
                [config.l, config.w, config.d]
                  .filter((n) => typeof n === "number")
                  .map((n) => format.number(n as number))
                  .join(" × ") || "—",
            },
            { term: t("customerNote"), description: sample.customerNote ?? "—" },
            { term: t("asked"), description: <When at={sample.createdAt} /> },
            ...(sample.sellGrossAmount ? [{ term: t("sell"), description: format.thb(sample.sellGrossAmount) }] : []),
            ...(sample.buyNetAmount ? [{ term: t("buy"), description: format.thb(sample.buyNetAmount) }] : []),
            ...(sample.previousSampleId
              ? [
                  {
                    term: t("previous"),
                    description: (
                      <Link href={`/samples/${sample.previousSampleId}`} className="text-primary hover:underline">
                        {t("openPrevious")}
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <Section title={t("evidence")} description={ev.recordedAt ? undefined : t("evidenceHint")}>
        {ev.recordedAt ? (
          <div className="flex flex-col gap-3">
            <DescriptionList
              columns={2}
              items={[
                {
                  term: t("measured"),
                  description: `${[ev.lengthMm, ev.widthMm, ev.depthMm].filter(Boolean).join(" × ")} · ${ev.basis ? tEvidence(`bases.${ev.basis}` as never) : ""}`,
                },
                { term: t("materialUsed"), description: ev.materialUsed ?? "—" },
                { term: t("recordedAt"), description: <When at={ev.recordedAt} /> },
              ]}
            />
            <ul className="flex flex-wrap gap-3">
              {ev.photos.map((p, i) => (
                <li key={p.id}>
                  <Photo id={p.id} alt={t("photo", { n: i + 1 })} />
                </li>
              ))}
            </ul>
          </div>
        ) : canManage && ["paid", "in_production"].includes(sample.status) ? (
          <EvidenceForm
            zone="admin"
            onSubmit={async (body) => {
              try {
                const { data } = await adminBrowserApis().contract.POST("/v1/admin/samples/{sampleId}/evidence", {
                  ...path,
                  body,
                });
                settle(data as unknown as AdminSample);
                toast.success(tEvidence("recorded"));
              } catch (error) {
                toast.error(problemMessage(error, t("failed")));
              }
            }}
          />
        ) : (
          <p className="text-muted text-sm">{t("noEvidence")}</p>
        )}
      </Section>

      {sample.decision ? (
        <Section title={t("decision")}>
          <DescriptionList
            columns={2}
            items={[
              { term: t("decidedAt"), description: <When at={sample.decision.decidedAt} /> },
              {
                term: t("note"),
                description: <span className="whitespace-pre-line">{sample.decision.note ?? "—"}</span>,
              },
              { term: t("photosSeen"), description: format.number(sample.decision.evidencePhotoSha256.length) },
              { term: t("ip"), description: sample.decisionIp ?? "—" },
              {
                term: t("userAgent"),
                description: <span className="break-all">{sample.decisionUserAgent ?? "—"}</span>,
              },
            ]}
          />
        </Section>
      ) : null}

      {dialog === "quote" ? (
        <FormDialog
          title={t("quoteTitle")}
          description={t("quoteBody")}
          submitLabel={t("quote")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!item || !AMOUNT.test(amount) || !/^\d{1,3}$/.test(lead) || !/^\d{1,6}$/.test(weight))
              throw new Error(t("quoteIncomplete"));
            const body: Schemas["QuoteSampleDto"] = {
              serviceItemId: item,
              basis: "sell_gross",
              unitAmount: amount,
              leadTimeDays: Number(lead),
              parcelWeightG: Number(weight),
              // Freight is priced to this postcode; the request's own unless CS changes it.
              ...(/^\d{5}$/.test(postcode ?? sample.deliveryPostcode ?? "")
                ? { deliveryPostcode: postcode ?? sample.deliveryPostcode! }
                : {}),
            };
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/samples/{sampleId}/actions/quote", {
              ...path,
              body,
            });
            settle(data as unknown as AdminSample);
            toast.success(t("quoted"));
          }}
        >
          <Field label={t("serviceItem")}>
            <Select value={item} onValueChange={setItem} options={itemOptions} placeholder={t("chooseItem")} />
          </Field>
          <Field label={t("amount")} hint={t("amountHint")}>
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.trim())} />
          </Field>
          <Field label={t("postcode")} hint={t("postcodeHint")}>
            <Input
              inputMode="numeric"
              maxLength={5}
              value={postcode ?? sample.deliveryPostcode ?? ""}
              onChange={(event) => setPostcode(event.target.value.trim())}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("leadTime")}>
              <Input inputMode="numeric" value={lead} onChange={(event) => setLead(event.target.value.trim())} />
            </Field>
            <Field label={t("weight")}>
              <Input inputMode="numeric" value={weight} onChange={(event) => setWeight(event.target.value.trim())} />
            </Field>
          </div>
        </FormDialog>
      ) : null}

      {dialog === "resample" && sample.orderId ? (
        <FormDialog
          title={t("resampleTitle")}
          description={t("resampleBody")}
          submitLabel={t("resample")}
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!item || !AMOUNT.test(amount) || !reason.trim()) throw new Error(t("quoteIncomplete"));
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/samples", {
              params: { path: { orderId: sample.orderId! } },
              body: {
                serviceItemId: item,
                basis: "sell_gross",
                unitAmount: amount,
                mockupOption: sample.mockupOption,
                previousSampleId: sample.id,
                reason: reason.trim(),
              },
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "sample") });
            toast.success(t("resampled"));
            const created = data as unknown as { id?: string };
            if (created?.id) router.push(`/samples/${created.id}`);
          }}
        >
          <Field label={t("serviceItem")}>
            <Select value={item} onValueChange={setItem} options={itemOptions} placeholder={t("chooseItem")} />
          </Field>
          <Field label={t("amount")} hint={t("amountHint")}>
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.trim())} />
          </Field>
          <Field label={t("reason")}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
        </FormDialog>
      ) : null}

      {dialog === "cancel" ? (
        <FormDialog
          title={t("cancelTitle")}
          description={t("cancelBody")}
          submitLabel={t("cancel")}
          destructive
          onClose={() => setDialog(null)}
          onSubmit={async () => {
            if (!reason.trim()) throw new Error(t("reasonRequired"));
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/samples/{sampleId}/actions/cancel", {
              ...path,
              body: { reason: reason.trim() },
            });
            settle(data as unknown as AdminSample);
          }}
        >
          <Field label={t("reason")}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
