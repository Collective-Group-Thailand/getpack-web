"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { campaignP3Of } from "@/features/shared/loyalty-p3/read";
import { shortMultiplier } from "@/features/shared/loyalty-p2/multipliers";
import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import type { AdminLoyaltyCampaignRule } from "@/lib/api/requests/admin-loyalty-p3";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable } from "@/ui/components/DataTable";
import { DeskSection } from "@/ui/components/DeskPage";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, useCan, useProductTypes } from "../console";
import {
  blankCampaignDraft,
  campaignDraftOf,
  campaignFieldOfPath,
  campaignInputOf,
  campaignProblems,
  isEditableCampaign,
  type CampaignDraft,
  type CampaignProblem,
} from "./loyalty-campaign";
import { SegmentPicker } from "./SegmentPicker";

type Row = Schemas["AdminLoyaltyCampaignDto"];

/**
 * `/marketing/loyalty/campaigns` (loyalty P2 list, P3 writes; D-492, D-499): every points campaign — the reorder
 * bonuses and win-backs the system opens per customer, and the admin rules Marketing creates by window, product types
 * and audience. Admin rules are created here, edited before they start and cancelled with a reason; the others stay
 * read-only. The multiplier shown is the campaign's; at earning the ×3.00 combined cap still applies (D-495).
 */
export function LoyaltyCampaigns() {
  const t = useTranslations("marketing.loyaltyCampaigns");
  // The moment the list was opened: "เริ่ม …" and the edit button do not flip while it is on screen.
  const [now] = useState(() => Date.now());
  const format = useFormat();
  const canManage = useCan("promotions.manage");
  const productTypes = useProductTypes();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [cancelling, setCancelling] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const listKey = queryKeys.list("admin", "loyalty_campaign", {});
  const rows = useQuery({
    queryKey: listKey,
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/loyalty/campaigns", { params: { query: { perPage: 100 } } }))
        .data!.data,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "loyalty_campaign") });

  const cancel = async () => {
    if (!cancelling) return;
    if (reason.trim().length < 10) {
      setRefused(t("cancel.reasonShort"));
      return;
    }
    setBusy(true);
    try {
      await adminBrowserApis().requests.call("POST /v1/admin/loyalty/campaigns/{campaignId}/actions/cancel", {
        path: { campaignId: cancelling.id },
        body: { reason: reason.trim() },
      });
      toast.success(t("cancel.done"));
      setCancelling(null);
      refresh();
    } catch (error) {
      setRefused(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  if (rows.isError) return <QueryError error={rows.error} onRetry={() => void rows.refetch()} />;

  const typesText = (codes: readonly string[] | null) =>
    codes?.length ? codes.map(productTypes.labelOf).join(", ") : t("allTypes");

  return (
    <DeskSection
      title={t("title")}
      description={t("description")}
      actions={
        canManage ? (
          <Button iconStart="plus" onClick={() => setEditing({ id: null })}>
            {t("new")}
          </Button>
        ) : null
      }
    >
      <DataTable<Row>
        caption={t("title")}
        rows={rows.data ?? []}
        loading={rows.isPending}
        getRowId={(row) => row.id}
        empty={<EmptyState icon="sparkles" title={t("empty")} />}
        columns={[
          {
            id: "name",
            header: t("columns.campaign"),
            cell: (row) => {
              const p3 = campaignP3Of(row);
              return (
                <div className="min-w-0">
                  <p className="font-medium">{p3.name ?? t(`kinds.${p3.kind}`)}</p>
                  <p className="text-muted text-xs">
                    {p3.name ? t(`kinds.${p3.kind}`) : null}
                    {row.customer ? `${p3.name ? " · " : ""}${row.customer.displayName}` : null}
                  </p>
                </div>
              );
            },
          },
          {
            id: "multiplier",
            header: t("columns.multiplier"),
            numeric: true,
            cell: (row) => <span className="font-semibold tabular-nums">×{shortMultiplier(row.multiplier)}</span>,
          },
          {
            id: "window",
            header: t("columns.window"),
            cell: (row) => (
              <span className="text-sm whitespace-nowrap tabular-nums">
                {format.date(row.startsAt)} – {format.date(row.endsAt)}
              </span>
            ),
          },
          {
            id: "types",
            header: t("columns.types"),
            cell: (row) => {
              const p3 = campaignP3Of(row);
              return (
                <span className="text-sm">
                  {typesText(p3.productTypeCodes ?? (row.productTypeCode ? [row.productTypeCode] : null))}
                </span>
              );
            },
          },
          {
            id: "audience",
            header: t("columns.audience"),
            cell: (row) => {
              const audience = campaignP3Of(row).audience;
              const tiers = audience?.tiers ?? [];
              return tiers.length ? (
                <span className="text-sm">{tiers.map((tier) => t(`tiers.${tier}`)).join(", ")}</span>
              ) : audience?.newCustomer ? (
                <span className="text-sm">{t("newCustomers")}</span>
              ) : (
                <span className="text-muted text-sm">{t("everyone")}</span>
              );
            },
          },
          {
            id: "status",
            header: t("columns.status"),
            cell: (row) => {
              const upcoming = row.status === "active" && Date.parse(row.startsAt) > now;
              return (
                <Badge size="sm" tone={row.status === "active" && !upcoming ? "success" : "neutral"}>
                  {upcoming ? t("statuses.scheduled") : t(`statuses.${row.status}`)}
                </Badge>
              );
            },
          },
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.actions")}</span>,
            cell: (row) => {
              const kind = campaignP3Of(row).kind;
              if (!canManage || kind !== "admin_rule" || row.status !== "active") return null;
              return (
                <span className="flex justify-end gap-1.5">
                  {isEditableCampaign(row.startsAt, row.status, now) ? (
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: row.id })}>
                      {t("edit")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReason("");
                      setRefused(null);
                      setCancelling(row);
                    }}
                  >
                    {t("cancel.label")}
                  </Button>
                </span>
              );
            },
          },
        ]}
      />
      {editing ? (
        <CampaignSheet
          campaignId={editing.id}
          productTypes={productTypes.options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
      <Dialog
        open={cancelling !== null}
        onOpenChange={(open) => (open ? null : setCancelling(null))}
        title={t("cancel.title")}
        description={cancelling ? t("cancel.body", { name: campaignP3Of(cancelling).name ?? "" }) : undefined}
        closeLabel={t("close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              {t("cancel.keep")}
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void cancel()}>
              {t("cancel.confirm")}
            </Button>
          </>
        }
      >
        <Field label={t("cancel.reason")} hint={t("cancel.reasonHint")} error={refused ?? undefined} required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Dialog>
    </DeskSection>
  );
}

/** The create / edit sheet: reads the campaign (and its ETag) when editing. */
function CampaignSheet({
  campaignId,
  productTypes,
  onClose,
  onSaved,
}: {
  campaignId: string | null;
  productTypes: { value: string; label: string }[];
  onClose: () => void;
  onSaved: (campaign: AdminLoyaltyCampaignRule) => void;
}) {
  const t = useTranslations("marketing.loyaltyCampaigns");
  const read = useQuery({
    queryKey: queryKeys.detail("admin", "loyalty_campaign", campaignId ?? "new"),
    queryFn: () =>
      adminBrowserApis().requests.read("GET /v1/admin/loyalty/campaigns/{campaignId}", {
        path: { campaignId: campaignId! },
      }),
    enabled: Boolean(campaignId),
  });
  return (
    <Sheet
      open
      onOpenChange={(open) => (open ? null : onClose())}
      title={campaignId ? t("form.editTitle") : t("form.newTitle")}
      description={t("form.note")}
      closeLabel={t("close")}
      className="w-[min(36rem,calc(100vw-2rem))]"
    >
      {campaignId && !read.data ? (
        read.isError ? (
          <QueryError error={read.error} onRetry={() => void read.refetch()} />
        ) : null
      ) : (
        <LoyaltyCampaignForm
          campaign={read.data?.data ?? null}
          etag={read.data?.etag ?? null}
          productTypes={productTypes}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Sheet>
  );
}

export interface LoyaltyCampaignFormProps {
  campaign: AdminLoyaltyCampaignRule | null;
  etag?: string | null;
  productTypes: { value: string; label: string }[];
  onCancel: () => void;
  onSaved: (campaign: AdminLoyaltyCampaignRule) => void;
}

/**
 * An admin points campaign (D-499): name, the multiplier (1.01–5.00), the window (≤ 92 days), the product types it
 * counts (none = every type), who it is for (the promotion editor's audience picker, Platinum included) and a reason
 * code for reporting. Business-type and inactivity criteria may be used but are never shown to customers.
 */
export function LoyaltyCampaignForm({
  campaign,
  etag = null,
  productTypes,
  onCancel,
  onSaved,
}: LoyaltyCampaignFormProps) {
  const t = useTranslations("marketing.loyaltyCampaigns.form");
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    campaign ? campaignDraftOf(campaign) : blankCampaignDraft(),
  );
  const [shown, setShown] = useState<readonly CampaignProblem[]>([]);
  const [apiErrors, setApiErrors] = useState<Partial<Record<CampaignProblem, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CampaignDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const error = (field: CampaignProblem) =>
    apiErrors[field] ?? (shown.includes(field) ? t(`errors.${field}`) : undefined);

  const save = async () => {
    const problems = campaignProblems(draft);
    setShown(problems);
    setApiErrors({});
    if (problems.length) return;
    setSaving(true);
    try {
      const requests = adminBrowserApis().requests;
      const body = campaignInputOf(draft);
      const saved = campaign
        ? await requests.call("PATCH /v1/admin/loyalty/campaigns/{campaignId}", {
            path: { campaignId: campaign.id },
            body,
            etag: etag ?? undefined,
          })
        : await requests.call("POST /v1/admin/loyalty/campaigns", { body });
      toast.success(campaign ? t("saved") : t("created"));
      onSaved(saved);
    } catch (failure) {
      if (isApiError(failure)) {
        const mapped: Partial<Record<CampaignProblem, string>> = {};
        for (const refusal of failure.errors) {
          const field = campaignFieldOfPath(refusal.path);
          if (field) mapped[field] = refusal.message;
        }
        setApiErrors(mapped);
      }
      toast.error(problemMessage(failure, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label={t("name")} hint={t("nameHint")} error={error("name")} required>
        <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label={t("multiplier")} error={error("multiplier")} required>
          <NumberInput
            min={1.01}
            max={5}
            step="0.01"
            unit="×"
            value={draft.multiplier}
            onChange={(event) => set({ multiplier: event.target.value })}
          />
        </Field>
        <p className="text-muted self-end pb-2 text-[0.8125rem]">{t("multiplierHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("startsOn")} error={error("startsOn")} required>
          <Input type="date" value={draft.startsOn} onChange={(event) => set({ startsOn: event.target.value })} />
        </Field>
        <Field label={t("endsOn")} hint={t("windowHint")} error={error("endsOn")} required>
          <Input type="date" value={draft.endsOn} onChange={(event) => set({ endsOn: event.target.value })} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("productTypes")}</legend>
        <p className="text-muted -mt-1 text-[0.8125rem]">{t("productTypesHint")}</p>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {productTypes.map((type) => (
            <Checkbox
              key={type.value}
              label={type.label}
              checked={draft.productTypeCodes.includes(type.value)}
              onCheckedChange={(on) =>
                set({
                  productTypeCodes:
                    on === true
                      ? [...draft.productTypeCodes, type.value]
                      : draft.productTypeCodes.filter((code) => code !== type.value),
                })
              }
            />
          ))}
        </div>
      </fieldset>
      <section aria-labelledby="campaign-audience" className="flex flex-col gap-2">
        <h3 id="campaign-audience" className="text-sm font-medium">
          {t("audience")}
        </h3>
        <p className="text-muted -mt-1 text-[0.8125rem]">{t("audienceHint")}</p>
        <SegmentPicker draft={draft.audience} onChange={(audience) => set({ audience })} productTypes={productTypes} />
      </section>
      <Field label={t("reason")} hint={t("reasonHint")} error={error("reason")} required>
        <Input
          value={draft.reason}
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => set({ reason: event.target.value.trim().toLowerCase() })}
        />
      </Field>
      <div className="border-border flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" iconStart="save" loading={saving}>
          {campaign ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
