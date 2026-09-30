"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PROMOTION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { promotionBody } from "@/lib/api/requests/admin-marketing";
import { browserRequests } from "@/lib/api/requests/browser";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, QueryError, Section, StatusChip, useCan, useProductTypes } from "../console";
import { CouponCodes } from "./CouponCodes";
import type { Promotion } from "./resources";
import { bangkokDayOf, bangkokMidnight } from "./time";

type Body = import("zod").input<typeof promotionBody>;
type Benefit = Body["benefit"];
type Conditions = Body["conditions"];
type Action = Promotion["allowedActions"][number];

const CHANNELS = ["web", "cs", "line", "b2b"] as const;
const SEGMENTS = ["new", "returning", "b2b_company"] as const;
const BENEFITS = [
  "percent",
  "fixed",
  "tiered_percent",
  "free_shipping",
  "free_design_rounds",
  "free_mockup",
  "points_multiplier",
  "bonus_points",
] as const;

/** What the form edits: the request body, with numbers still as the text typed. */
type Draft = {
  name: string;
  kind: Body["kind"];
  campaignId: string;
  stacking: Body["stacking"];
  stackGroup: string;
  startsOn: string;
  endsOn: string;
  conditions: Omit<Conditions, "minOrderValue" | "minQuantity"> & { minOrderValue: string; minQuantity: string };
  benefit: {
    type: Benefit["type"];
    pct: string;
    amount: string;
    maxAmount: string;
    tiers: { minOrderValue: string; pct: string }[];
    rounds: string;
    multiplier: string;
    points: string;
  };
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  budgetAmount: string;
};

const blank = (campaignId: string | null): Draft => ({
  name: "",
  kind: "coupon",
  campaignId: campaignId ?? "",
  stacking: "exclusive",
  stackGroup: "",
  startsOn: "",
  endsOn: "",
  conditions: {
    schemaVersion: 1,
    channels: [],
    segments: [],
    productTypeCodes: [],
    minOrderValue: "",
    minQuantity: "",
    firstOrderOnly: false,
    paymentMethods: [],
    provinceIds: [],
  },
  benefit: {
    type: "percent",
    pct: "",
    amount: "",
    maxAmount: "",
    tiers: [{ minOrderValue: "", pct: "" }],
    rounds: "",
    multiplier: "",
    points: "",
  },
  usageLimitTotal: "",
  usageLimitPerCustomer: "",
  budgetAmount: "",
});

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function fromPromotion(item: Promotion): Draft {
  return {
    name: item.name,
    kind: item.kind,
    campaignId: item.campaign?.id ?? "",
    stacking: item.stacking,
    stackGroup: item.stackGroup ?? "",
    startsOn: bangkokDayOf(item.startsAt),
    endsOn: bangkokDayOf(item.endsAt),
    conditions: {
      ...item.conditions,
      minOrderValue: text(item.conditions.minOrderValue),
      minQuantity: text(item.conditions.minQuantity),
    },
    benefit: {
      type: item.benefit.type,
      pct: text(item.benefit.pct),
      amount: text(item.benefit.amount),
      maxAmount: text(item.benefit.maxAmount),
      tiers: item.benefit.tiers.length ? item.benefit.tiers : [{ minOrderValue: "", pct: "" }],
      rounds: text(item.benefit.rounds),
      multiplier: text(item.benefit.multiplier),
      points: text(item.benefit.points),
    },
    usageLimitTotal: text(item.usageLimitTotal),
    usageLimitPerCustomer: text(item.usageLimitPerCustomer),
    budgetAmount: text(item.budgetAmount),
  };
}

const money = (value: string) => (value.trim() ? Number(value).toFixed(2) : null);
const count = (value: string) => (value.trim() ? Math.trunc(Number(value)) : null);

/** The form as the request body: only the benefit fields its type uses are sent. */
function toBody(draft: Draft): Body {
  const { benefit } = draft;
  const uses = (field: "pct" | "amount" | "maxAmount" | "rounds" | "multiplier" | "points") =>
    ({
      pct: benefit.type === "percent",
      amount: benefit.type === "fixed",
      maxAmount: benefit.type === "percent" || benefit.type === "tiered_percent",
      rounds: benefit.type === "free_design_rounds",
      multiplier: benefit.type === "points_multiplier",
      points: benefit.type === "bonus_points",
    })[field];
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    campaignId: draft.campaignId || null,
    stacking: draft.stacking,
    stackGroup: draft.stackGroup.trim() || null,
    startsAt: bangkokMidnight(draft.startsOn),
    endsAt: draft.endsOn ? bangkokMidnight(draft.endsOn, true) : null,
    conditions: {
      ...draft.conditions,
      minOrderValue: money(draft.conditions.minOrderValue),
      minQuantity: count(draft.conditions.minQuantity),
    },
    benefit: {
      schemaVersion: 1,
      type: benefit.type,
      pct: uses("pct") && benefit.pct.trim() ? benefit.pct.trim() : null,
      amount: uses("amount") ? money(benefit.amount) : null,
      maxAmount: uses("maxAmount") ? money(benefit.maxAmount) : null,
      tiers:
        benefit.type === "tiered_percent"
          ? benefit.tiers
              .filter((tier) => tier.minOrderValue.trim() && tier.pct.trim())
              .map((tier) => ({ minOrderValue: Number(tier.minOrderValue).toFixed(2), pct: tier.pct.trim() }))
          : [],
      rounds: uses("rounds") ? count(benefit.rounds) : null,
      multiplier: uses("multiplier") && benefit.multiplier.trim() ? benefit.multiplier.trim() : null,
      points: uses("points") ? count(benefit.points) : null,
    },
    usageLimitTotal: count(draft.usageLimitTotal),
    usageLimitPerCustomer: count(draft.usageLimitPerCustomer),
    budgetAmount: money(draft.budgetAmount),
  };
}

export async function readPromotion(promotionId: string) {
  return browserRequests().read("GET /v1/admin/promotions/{promotionId}", { path: { promotionId } });
}

/**
 * One promotion (F2 2.7, D-053): who it is for (conditions), what it gives (benefit), how often
 * (limits), and — for a coupon — its codes. The engine evaluating it is the API's; a benefit
 * already redeemed cannot change (the API refuses, and says so), a new promotion is the way.
 */
export function PromotionEditor({ promotionId, campaignId }: { promotionId?: string; campaignId?: string | null }) {
  const t = useTranslations("marketing.promotion");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan("promotions.manage");
  const productTypes = useProductTypes();
  const key = queryKeys.detail("admin", "promotion", promotionId ?? "new");
  const [draft, setDraft] = useState<Draft | null>(promotionId ? null : blank(campaignId ?? null));
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await readPromotion(promotionId!)).data,
    enabled: Boolean(promotionId),
  });
  const campaigns = useQuery({
    queryKey: queryKeys.list("admin", "campaign", { perPage: 100 }),
    queryFn: () => browserRequests().call("GET /v1/admin/campaigns", { query: { perPage: 100 } }),
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const item = query.data;
  if (promotionId && !item) return null;
  const form = draft ?? fromPromotion(item!);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const setConditions = (patch: Partial<Draft["conditions"]>) => set({ conditions: { ...form.conditions, ...patch } });
  const setBenefit = (patch: Partial<Draft["benefit"]>) => set({ benefit: { ...form.benefit, ...patch } });
  const toggle = <T extends string>(list: readonly T[], value: T, on: boolean) =>
    on ? [...list, value] : list.filter((entry) => entry !== value);
  const editable = canManage && (!item || item.status !== "ended");
  const redeemed = (item?.usage.redemptionsCount ?? 0) > 0;

  const save = async () => {
    if (!form.name.trim() || !form.startsOn) {
      toast.error(t("required"));
      return;
    }
    setSaving(true);
    try {
      const body = toBody(form);
      if (!promotionId) {
        const created = await browserRequests().call("POST /v1/admin/promotions", { body });
        toast.success(t("created"));
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
        router.replace(`/marketing/promotions/${created.id}`);
        return;
      }
      const { etag } = await readPromotion(promotionId);
      const { kind, ...changes } = body;
      void kind;
      const updated = await browserRequests().call("PATCH /v1/admin/promotions/{promotionId}", {
        path: { promotionId },
        body: changes,
        etag: etag ?? undefined,
      });
      queryClient.setQueryData(key, updated);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  const benefit = form.benefit;
  const number = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    hint?: string,
    unit?: string,
    locked = false,
  ) => (
    <Field label={label} hint={hint}>
      <NumberInput
        min={0}
        step="any"
        value={value}
        disabled={!editable || locked}
        unit={unit}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("promotions"), href: "/marketing/promotions" }, { label: item?.name ?? t("new") }]}
          />
        }
        title={item?.name ?? t("newTitle")}
        meta={
          item ? (
            <>
              <StatusChip map={PROMOTION_STATUS} value={item.status} size="md" />
              <span className="text-muted text-sm">{item.benefitSummary}</span>
            </>
          ) : undefined
        }
        actions={
          <>
            {item?.allowedActions.map((next) => (
              <Button
                key={next}
                variant={next === "end" ? "ghost" : next === "pause" ? "secondary" : "primary"}
                onClick={() => setAction(next)}
              >
                {t(`actions.${next}.label`)}
              </Button>
            ))}
            {editable ? (
              <Button iconStart="save" loading={saving} disabled={Boolean(item) && !draft} onClick={() => void save()}>
                {item ? t("save") : t("create")}
              </Button>
            ) : null}
          </>
        }
      />

      {item ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["redemptions", format.number(item.usage.redemptionsCount)],
              ["discount", format.thb(item.usage.discountAmount)],
              ["capped", format.thb(item.usage.cappedAmount)],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className="bg-surface rounded-md border p-3">
              <dt className="text-muted text-xs">{t(`usage.${name}`)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <Section title={t("basics")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("fields.name")} required className="md:col-span-2">
            <Input value={form.name} disabled={!editable} onChange={(event) => set({ name: event.target.value })} />
          </Field>
          <Field label={t("fields.kind")} hint={item ? t("hints.kindFixed") : t(`kindHints.${form.kind}`)}>
            <Select
              value={form.kind}
              disabled={Boolean(item) || !editable}
              onValueChange={(kind) => set({ kind: kind as Draft["kind"] })}
              options={(["coupon", "automatic", "referral"] as const).map((value) => ({
                value,
                label: t(`kinds.${value}`),
              }))}
            />
          </Field>
          <Field label={t("fields.campaign")}>
            <Select
              value={form.campaignId || "none"}
              disabled={!editable}
              onValueChange={(value) => set({ campaignId: value === "none" ? "" : value })}
              options={[
                { value: "none", label: t("noCampaign") },
                ...(campaigns.data?.data ?? [])
                  .filter((row) => row.status !== "ended")
                  .map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` })),
              ]}
            />
          </Field>
          <Field label={t("fields.startsOn")} required>
            <Input
              type="date"
              value={form.startsOn}
              disabled={!editable}
              onChange={(event) => set({ startsOn: event.target.value })}
            />
          </Field>
          <Field label={t("fields.endsOn")} hint={t("hints.endsOn")}>
            <Input
              type="date"
              value={form.endsOn}
              disabled={!editable}
              onChange={(event) => set({ endsOn: event.target.value })}
            />
          </Field>
          <Field label={t("fields.stacking")} hint={t(`stackingHints.${form.stacking}`)}>
            <Select
              value={form.stacking}
              disabled={!editable}
              onValueChange={(stacking) => set({ stacking: stacking as Draft["stacking"] })}
              options={(["exclusive", "stackable", "best_of"] as const).map((value) => ({
                value,
                label: t(`stacking.${value}`),
              }))}
            />
          </Field>
          <Field label={t("fields.stackGroup")} hint={t("hints.stackGroup")}>
            <Input
              value={form.stackGroup}
              disabled={!editable}
              onChange={(event) => set({ stackGroup: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("conditions")} description={t("conditionsNote")}>
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("fields.channels")}</legend>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((channel) => (
                <Checkbox
                  key={channel}
                  label={t(`channels.${channel}`)}
                  disabled={!editable}
                  checked={form.conditions.channels.includes(channel)}
                  onCheckedChange={(on) =>
                    setConditions({ channels: toggle(form.conditions.channels, channel, on === true) })
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("fields.segments")}</legend>
            <div className="flex flex-wrap gap-4">
              {SEGMENTS.map((segment) => (
                <Checkbox
                  key={segment}
                  label={t(`segments.${segment}`)}
                  disabled={!editable}
                  checked={form.conditions.segments.includes(segment)}
                  onCheckedChange={(on) =>
                    setConditions({ segments: toggle(form.conditions.segments, segment, on === true) })
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("fields.productTypes")}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {productTypes.options.map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  disabled={!editable}
                  checked={form.conditions.productTypeCodes.includes(option.value)}
                  onCheckedChange={(on) =>
                    setConditions({
                      productTypeCodes: toggle(form.conditions.productTypeCodes, option.value, on === true),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 md:grid-cols-3">
            {number(
              t("fields.minOrderValue"),
              form.conditions.minOrderValue,
              (value) => setConditions({ minOrderValue: value }),
              t("hints.baht"),
            )}
            {number(t("fields.minQuantity"), form.conditions.minQuantity, (value) =>
              setConditions({ minQuantity: value }),
            )}
            <div className="flex items-end pb-2">
              <Switch
                label={t("fields.firstOrderOnly")}
                disabled={!editable}
                checked={form.conditions.firstOrderOnly}
                onCheckedChange={(firstOrderOnly) => setConditions({ firstOrderOnly })}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title={t("benefit")} description={t("benefitNote")}>
        {redeemed ? <Callout tone="info" className="mb-3" title={t("benefitLocked")} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("fields.benefitType")}>
            <Select
              value={benefit.type}
              disabled={!editable || redeemed}
              onValueChange={(type) => setBenefit({ type: type as Draft["benefit"]["type"] })}
              options={BENEFITS.map((value) => ({ value, label: t(`benefits.${value}`) }))}
            />
          </Field>
          {benefit.type === "percent"
            ? number(t("fields.pct"), benefit.pct, (pct) => setBenefit({ pct }), undefined, "%", redeemed)
            : null}
          {benefit.type === "fixed"
            ? number(
                t("fields.amount"),
                benefit.amount,
                (amount) => setBenefit({ amount }),
                t("hints.baht"),
                undefined,
                redeemed,
              )
            : null}
          {benefit.type === "percent" || benefit.type === "tiered_percent"
            ? number(
                t("fields.maxAmount"),
                benefit.maxAmount,
                (maxAmount) => setBenefit({ maxAmount }),
                t("hints.cap"),
                undefined,
                redeemed,
              )
            : null}
          {benefit.type === "free_design_rounds"
            ? number(
                t("fields.rounds"),
                benefit.rounds,
                (rounds) => setBenefit({ rounds }),
                undefined,
                undefined,
                redeemed,
              )
            : null}
          {benefit.type === "points_multiplier"
            ? number(
                t("fields.multiplier"),
                benefit.multiplier,
                (multiplier) => setBenefit({ multiplier }),
                undefined,
                "×",
                redeemed,
              )
            : null}
          {benefit.type === "bonus_points"
            ? number(
                t("fields.points"),
                benefit.points,
                (points) => setBenefit({ points }),
                undefined,
                undefined,
                redeemed,
              )
            : null}
        </div>
        {benefit.type === "tiered_percent" ? (
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("fields.tiers")}</legend>
            {benefit.tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                <Field label={t("fields.tierFrom", { no: index + 1 })}>
                  <NumberInput
                    min={0}
                    step="any"
                    value={tier.minOrderValue}
                    disabled={!editable || redeemed}
                    onChange={(event) =>
                      setBenefit({
                        tiers: benefit.tiers.map((other, at) =>
                          at === index ? { ...other, minOrderValue: event.target.value } : other,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={t("fields.tierPct", { no: index + 1 })}>
                  <NumberInput
                    min={0}
                    step="any"
                    unit="%"
                    value={tier.pct}
                    disabled={!editable || redeemed}
                    onChange={(event) =>
                      setBenefit({
                        tiers: benefit.tiers.map((other, at) =>
                          at === index ? { ...other, pct: event.target.value } : other,
                        ),
                      })
                    }
                  />
                </Field>
                <IconButton
                  name="trash"
                  variant="ghost"
                  label={t("removeTier", { no: index + 1 })}
                  disabled={!editable || redeemed || benefit.tiers.length === 1}
                  onClick={() => setBenefit({ tiers: benefit.tiers.filter((_, at) => at !== index) })}
                />
              </div>
            ))}
            {editable && !redeemed ? (
              <Button
                size="sm"
                variant="ghost"
                iconStart="plus"
                className="self-start"
                onClick={() => setBenefit({ tiers: [...benefit.tiers, { minOrderValue: "", pct: "" }] })}
              >
                {t("addTier")}
              </Button>
            ) : null}
          </fieldset>
        ) : null}
        <p className="text-muted mt-3 text-xs">{t("marginGuard")}</p>
      </Section>

      <Section title={t("limits")}>
        <div className="grid gap-3 md:grid-cols-3">
          {number(
            t("fields.usageLimitTotal"),
            form.usageLimitTotal,
            (usageLimitTotal) => set({ usageLimitTotal }),
            t("hints.unlimited"),
          )}
          {number(
            t("fields.usageLimitPerCustomer"),
            form.usageLimitPerCustomer,
            (usageLimitPerCustomer) => set({ usageLimitPerCustomer }),
            t("hints.unlimited"),
          )}
          {number(
            t("fields.budgetAmount"),
            form.budgetAmount,
            (budgetAmount) => set({ budgetAmount }),
            t("hints.budget"),
          )}
        </div>
      </Section>

      {item?.kind === "coupon" ? <CouponCodes promotion={item} /> : null}

      {action && item ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, { name: item.name })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={action === "end" ? "destructive" : "primary"}
          reason={{ label: t("reason"), required: true, minLength: 3 }}
          onConfirm={async ({ reason }) => {
            try {
              const { etag } = await readPromotion(item.id);
              const updated = await browserRequests().call("POST /v1/admin/promotions/{promotionId}/actions/{action}", {
                path: { promotionId: item.id, action },
                body: { reason },
                etag: etag ?? undefined,
              });
              queryClient.setQueryData(key, updated);
              void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
              toast.success(t("changed"));
            } catch (error) {
              toast.error(problemMessage(error, t("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
