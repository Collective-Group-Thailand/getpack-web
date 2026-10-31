"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { adminPromotionActions, type AdminLifecycleAction } from "@/domain/next-actions/admin";
import { PROMOTION_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { DateField } from "@/ui/components/DateField";
import { StatsRow } from "@/ui/components/DeskPage";
import { Field, FormSection } from "@/ui/components/Field";
import { EDGE_BAR, FormColumns, FormSummary, SummaryRows } from "@/ui/components/FormLayout";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  ConfirmAction,
  problemMessage,
  QueryError,
  StatusChip,
  useActor,
  useProductTypes,
} from "../console";
import { DetailSkeleton } from "../console/DetailSkeleton";
import { CouponCodes } from "./CouponCodes";
import type { Promotion } from "./resources";
import { bangkokDayOf, bangkokMidnight } from "./time";

type Benefit = Schemas["PromotionBenefitDto"];
type BenefitType = Schemas["PromotionBenefitType"];
type Conditions = Schemas["PromotionConditionsDto"];

const CHANNELS = ["web", "cs", "line", "b2b"] as const satisfies readonly Schemas["SalesChannel"][];
/** `PromotionConditionsDto.segments` is a free string documented as `new | returning | b2b`. */
const SEGMENTS = ["new", "returning", "b2b"] as const;
const BENEFITS = [
  "percent",
  "fixed",
  "tiered",
  "free_shipping",
  "unit_price_override",
  "free_design",
  "free_revision_rounds",
  "free_mockup",
  "points_multiplier",
  "bonus_points",
] as const satisfies readonly BenefitType[];

/**
 * What the form edits: the typed bodies of `admin.promotions.create` / `update`, with numbers still
 * as the text typed. The conditions keep what the form does not show (payment methods, shipping
 * zones, catalogue products, categories), so a save sends them back unchanged.
 */
type Draft = {
  name: string;
  kind: Schemas["PromotionKind"];
  campaignId: string;
  priority: string;
  stacking: Schemas["StackingMode"];
  stackGroup: string;
  startsOn: string;
  endsOn: string;
  conditions: Omit<Conditions, "minOrderValue" | "minQuantity"> & {
    channels: Schemas["SalesChannel"][];
    segments: string[];
    productTypeCodes: string[];
    firstOrderOnly: boolean;
    minOrderValue: string;
    minQuantity: string;
  };
  benefit: {
    type: BenefitType;
    pct: string;
    amount: string;
    maxAmount: string;
    basis: Schemas["BenefitTierBasis"];
    tiers: { min: string; pct: string; amount?: string }[];
    rounds: string;
    multiplier: string;
    points: string;
    unitPrice: string;
  };
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  budgetAmount: string;
};

/** The panel's lifecycle steps in the order they are offered: starting first, ending (final) last. */
const LIFECYCLE_ORDER = ["activate", "resume", "pause", "end"];

const blankTier = () => ({ min: "", pct: "" });

const blank = (campaignId: string | null): Draft => ({
  name: "",
  kind: "coupon",
  campaignId: campaignId ?? "",
  priority: "",
  stacking: "exclusive",
  stackGroup: "",
  startsOn: "",
  endsOn: "",
  conditions: {
    channels: [],
    segments: [],
    productTypeCodes: [],
    minOrderValue: "",
    minQuantity: "",
    firstOrderOnly: false,
  },
  benefit: {
    type: "percent",
    pct: "",
    amount: "",
    maxAmount: "",
    basis: "value",
    tiers: [blankTier()],
    rounds: "",
    multiplier: "",
    points: "",
    unitPrice: "",
  },
  usageLimitTotal: "",
  usageLimitPerCustomer: "",
  budgetAmount: "",
});

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function fromPromotion(item: Promotion): Draft {
  const { minOrderValue, minQuantity, channels, segments, productTypeCodes, firstOrderOnly, ...rest } = item.conditions;
  const benefit: Benefit = item.benefit;
  return {
    name: item.name,
    kind: item.kind,
    campaignId: item.campaignId ?? "",
    priority: text(item.priority),
    stacking: item.stacking,
    stackGroup: item.stackGroup ?? "",
    startsOn: bangkokDayOf(item.startsAt),
    endsOn: bangkokDayOf(item.endsAt),
    conditions: {
      ...rest,
      channels: channels ?? [],
      segments: segments ?? [],
      productTypeCodes: productTypeCodes ?? [],
      firstOrderOnly: firstOrderOnly ?? false,
      minOrderValue: text(minOrderValue),
      minQuantity: text(minQuantity),
    },
    benefit: {
      type: benefit.type,
      pct: text(benefit.pct),
      amount: text(benefit.amount),
      maxAmount: text(benefit.maxAmount),
      basis: benefit.basis ?? "value",
      tiers: benefit.tiers?.length
        ? benefit.tiers.map((tier) => ({ min: tier.min, pct: text(tier.pct), amount: tier.amount }))
        : [blankTier()],
      rounds: text(benefit.rounds),
      multiplier: text(benefit.multiplier),
      points: text(benefit.points),
      unitPrice: text(benefit.unitPrice),
    },
    usageLimitTotal: text(item.usageLimitTotal),
    usageLimitPerCustomer: text(item.usageLimitPerCustomer),
    budgetAmount: text(item.budgetAmount),
  };
}

const filled = (value: string) => value.trim() !== "";
const money = (value: string) => (filled(value) ? Number(value).toFixed(2) : null);
const count = (value: string) => (filled(value) ? Math.trunc(Number(value)) : null);
/** Optional, non-null on the contract: a field left empty is omitted, never sent as `null`. */
const optional = <K extends string, V>(key: K, value: V | null): Partial<Record<K, V>> =>
  value === null ? {} : ({ [key]: value } as Record<K, V>);
const list = <K extends string, V>(key: K, values: readonly V[]): Partial<Record<K, V[]>> =>
  values.length ? ({ [key]: [...values] } as Record<K, V[]>) : {};

/** The conditions as `PromotionConditionsDto`: an empty list means "any", so it is left out. */
function conditionsBody(draft: Draft["conditions"]): Conditions {
  const { minOrderValue, minQuantity, channels, segments, productTypeCodes, firstOrderOnly, ...rest } = draft;
  return {
    ...rest,
    ...list("channels", channels),
    ...list("segments", segments),
    ...list("productTypeCodes", productTypeCodes),
    ...optional("minOrderValue", money(minOrderValue)),
    ...optional("minQuantity", count(minQuantity)),
    ...(firstOrderOnly ? { firstOrderOnly } : {}),
  };
}

/** The benefit as `PromotionBenefitDto`: only the fields its type uses. */
function benefitBody(benefit: Draft["benefit"]): Benefit {
  const { type } = benefit;
  const decimal = (value: string) => (filled(value) ? value.trim() : null);
  switch (type) {
    case "percent":
      return { type, ...optional("pct", decimal(benefit.pct)), ...optional("maxAmount", money(benefit.maxAmount)) };
    case "fixed":
      return { type, ...optional("amount", money(benefit.amount)) };
    case "tiered":
      return {
        type,
        basis: benefit.basis,
        tiers: benefit.tiers
          .filter((tier) => filled(tier.min) && (filled(tier.pct) || filled(tier.amount ?? "")))
          .map((tier) => ({
            min: tier.min.trim(),
            ...optional("pct", decimal(tier.pct)),
            ...optional("amount", tier.amount ? money(tier.amount) : null),
          })),
        ...optional("maxAmount", money(benefit.maxAmount)),
      };
    case "unit_price_override":
      return { type, ...optional("unitPrice", decimal(benefit.unitPrice)) };
    case "free_revision_rounds":
      return { type, ...optional("rounds", count(benefit.rounds)) };
    case "points_multiplier":
      return { type, ...optional("multiplier", decimal(benefit.multiplier)) };
    case "bonus_points":
      return { type, ...optional("points", count(benefit.points)) };
    default:
      return { type };
  }
}

export async function readPromotion(promotionId: string) {
  const { data, response } = await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}", {
    params: { path: { promotionId } },
  });
  return { data: data!, etag: response.headers.get("ETag") };
}

/**
 * One promotion (F2 2.7, D-053): who it is for (conditions), what it gives (benefit), how often
 * (limits), and — for a coupon — its codes. The engine evaluating it is the API's; a benefit
 * already redeemed is not sent again (the API refuses to change it), a new promotion is the way.
 * The header says the benefit in the API's words; usage is the promotion's own (`usage`). Pausing or
 * ending records the reason given. A referral promotion is system-managed (409
 * `promotions.system_managed`), so it is shown read-only.
 * CONTRACT-GAP admin.promotions — no `allowedActions` (`adminPromotionActions` decides), and the
 * campaign is fixed once created.
 */
export function PromotionEditor({ promotionId, campaignId }: { promotionId?: string; campaignId?: string | null }) {
  const t = useTranslations("marketing.promotion");
  const tList = useTranslations("marketing.promotions");
  const tFilters = useTranslations("console.filters");
  const format = useFormat();
  const en = useLocale() === "en";
  const router = useRouter();
  const queryClient = useQueryClient();
  const actor = useActor();
  const can = (permission: string) => actor.permissions.includes(permission);
  const productTypes = useProductTypes();
  const key = queryKeys.detail("admin", "promotion", promotionId ?? "new");
  const [draft, setDraft] = useState<Draft | null>(promotionId ? null : blank(campaignId ?? null));
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<AdminLifecycleAction | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await readPromotion(promotionId!)).data,
    enabled: Boolean(promotionId),
  });
  const campaigns = useQuery({
    queryKey: queryKeys.list("admin", "campaign", { perPage: 100 }),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/campaigns", { params: { query: { perPage: 100 } } })).data!,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const item = query.data;
  if (promotionId && !item) return <DetailSkeleton />;
  const form = draft ?? fromPromotion(item!);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const setConditions = (patch: Partial<Draft["conditions"]>) => set({ conditions: { ...form.conditions, ...patch } });
  const setBenefit = (patch: Partial<Draft["benefit"]>) => set({ benefit: { ...form.benefit, ...patch } });
  const toggle = <T extends string>(values: readonly T[], value: T, on: boolean) =>
    on ? [...values, value] : values.filter((entry) => entry !== value);
  const systemManaged = item?.kind === "referral";
  const editable = can("promotions.manage") && (!item || item.status !== "ended") && !systemManaged;
  const redeemed = (item?.usage.redemptions ?? 0) > 0;
  const actions = item && !systemManaged ? adminPromotionActions(item.status, can) : [];
  const wording = (next: AdminLifecycleAction) => (next.resumes ? "resume" : next.action);

  const save = async () => {
    if (!form.name.trim() || !form.startsOn || !/^-?\d+$/.test(form.priority.trim())) {
      toast.error(t("required"));
      return;
    }
    setSaving(true);
    try {
      const common = {
        name: form.name.trim(),
        priority: Number(form.priority.trim()),
        stacking: form.stacking,
        stackGroup: form.stackGroup.trim() || null,
        startsAt: bangkokMidnight(form.startsOn),
        endsAt: form.endsOn ? bangkokMidnight(form.endsOn, true) : null,
        conditions: conditionsBody(form.conditions),
        usageLimitTotal: count(form.usageLimitTotal),
        usageLimitPerCustomer: count(form.usageLimitPerCustomer),
        budgetAmount: money(form.budgetAmount),
      };
      if (!promotionId) {
        const { data: created } = await adminBrowserApis().contract.POST("/v1/admin/promotions", {
          body: {
            ...common,
            kind: form.kind,
            campaignId: form.campaignId || null,
            benefit: benefitBody(form.benefit),
          },
        });
        toast.success(t("created"));
        void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
        router.replace(`/marketing/promotions/${created!.id}`);
        return;
      }
      const { etag } = await readPromotion(promotionId);
      // Neither the kind nor the campaign can change; a redeemed benefit is not sent again.
      const { data: updated } = await adminBrowserApis().contract.PATCH("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId }, header: { "If-Match": etag ?? "" } },
        body: { ...common, ...(redeemed ? {} : { benefit: benefitBody(form.benefit) }) },
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
  const setTier = (index: number, patch: Partial<Draft["benefit"]["tiers"][number]>) =>
    setBenefit({ tiers: benefit.tiers.map((other, at) => (at === index ? { ...other, ...patch } : other)) });

  const lifecycle = [...actions].sort(
    (x, y) => LIFECYCLE_ORDER.indexOf(wording(x)) - LIFECYCLE_ORDER.indexOf(wording(y)),
  );
  // Bringing a promotion to life is the one filled step while there is nothing to save; with unsaved changes the
  // save is, and the rest are outlined, ending last.
  const lifecycleLeads = lifecycle.some((next) => next.action === "activate") && !draft;
  const saveButton = editable ? (
    <Button
      iconStart="save"
      variant={lifecycleLeads ? "secondary" : "primary"}
      loading={saving}
      disabled={Boolean(item) && !draft}
      onClick={() => void save()}
    >
      {item ? t("save") : t("create")}
    </Button>
  ) : null;
  const figure = (() => {
    switch (benefit.type) {
      case "percent":
        return filled(benefit.pct) ? `${benefit.pct}%` : "";
      case "fixed":
        return filled(benefit.amount) ? format.thb(Number(benefit.amount).toFixed(2)) : "";
      case "unit_price_override":
        return filled(benefit.unitPrice) ? format.thb(Number(benefit.unitPrice).toFixed(2)) : "";
      case "points_multiplier":
        return filled(benefit.multiplier) ? `× ${benefit.multiplier}` : "";
      case "bonus_points":
        return filled(benefit.points) ? format.number(Number(benefit.points)) : "";
      case "free_revision_rounds":
        return filled(benefit.rounds) ? format.number(Number(benefit.rounds)) : "";
      default:
        return "";
    }
  })();
  const what =
    item && !draft
      ? en
        ? item.benefitSummaryEn
        : item.benefitSummaryTh
      : [t(`benefits.${benefit.type}`), figure].filter(Boolean).join(" · ");
  const period = form.startsOn
    ? `${format.date(form.startsOn)} – ${form.endsOn ? format.date(form.endsOn) : tList("noEnd")}`
    : "";
  const picked = (values: readonly string[], label: (value: string) => string) =>
    values.length ? values.map(label).join(", ") : tFilters("any");
  const typeOptions = productTypes.types
    .filter((type) => type.status === "active" || form.conditions.productTypeCodes.includes(type.code))
    .map((type) => ({ value: type.code, label: en ? type.nameEn : type.nameTh }));

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <PageHeader
        back={{ href: "/marketing/promotions", label: t("promotions") }}
        title={item?.name ?? t("newTitle")}
        meta={
          item ? (
            <>
              <StatusChip map={PROMOTION_STATUS} value={item.status} size="md" />
              {item.campaign ? (
                <Link
                  href={`/marketing/campaigns/${item.campaign.id}`}
                  className="text-primary text-sm tabular-nums hover:underline"
                >
                  {item.campaign.code}
                </Link>
              ) : null}
            </>
          ) : undefined
        }
        description={item ? (en ? item.benefitSummaryEn : item.benefitSummaryTh) : undefined}
      />

      {item ? (
        <StatsRow
          label={t("usageLabel")}
          columns={3}
          items={[
            { key: "redemptions", label: t("usage.redemptions"), value: format.number(item.usage.redemptions) },
            { key: "discount", label: t("usage.discount"), value: format.thb(item.usage.discountAmount) },
            { key: "capped", label: t("usage.capped"), value: format.thb(item.usage.cappedAmount) },
          ]}
        />
      ) : null}
      {systemManaged ? <Callout tone="info" title={t("systemManaged")} /> : null}

      <FormColumns
        aside={
          <FormSummary title={t("summary")} barClassName={EDGE_BAR} action={saveButton}>
            <SummaryRows
              rows={[
                { key: "kind", label: t("fields.kind"), value: t(`kinds.${form.kind}`) },
                { key: "benefit", label: t("benefit"), value: what },
                { key: "period", label: t("period"), value: period },
                {
                  key: "channels",
                  label: t("fields.channels"),
                  value: picked(form.conditions.channels, (value) => t(`channels.${value}`)),
                },
                {
                  key: "types",
                  label: t("fields.productTypes"),
                  value: picked(form.conditions.productTypeCodes, productTypes.labelOf),
                },
                {
                  key: "budget",
                  label: t("fields.budgetAmount"),
                  value: filled(form.budgetAmount) ? format.thb(Number(form.budgetAmount).toFixed(2)) : "",
                },
              ]}
            />
            {lifecycle.length ? (
              <div data-fill="row" className="border-border flex flex-col gap-2 border-t pt-4">
                {lifecycle.map((next) => (
                  <Button
                    key={next.action}
                    variant={
                      next.action === "activate" && lifecycleLeads
                        ? "primary"
                        : next.action === "end"
                          ? "ghost"
                          : "secondary"
                    }
                    className={next.action === "end" ? "text-danger" : undefined}
                    onClick={() => setAction(next)}
                  >
                    {t(`actions.${wording(next)}.label`)}
                  </Button>
                ))}
              </div>
            ) : null}
          </FormSummary>
        }
      >
        <FormSection card step={1} title={t("basics")}>
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <Field label={t("fields.name")} required className="md:col-span-2">
              <Input value={form.name} disabled={!editable} onChange={(event) => set({ name: event.target.value })} />
            </Field>
            <Field label={t("fields.kind")} hint={item ? t("hints.kindFixed") : t(`kindHints.${form.kind}`)}>
              <SearchableSelect
                value={form.kind}
                disabled={Boolean(item) || !editable}
                onValueChange={(kind) => set({ kind: kind as Draft["kind"] })}
                options={(["coupon", "automatic", "referral"] as const).map((value) => ({
                  value,
                  label: t(`kinds.${value}`),
                }))}
              />
            </Field>
            <Field label={t("fields.campaign")} hint={item ? t("hints.campaignFixed") : undefined}>
              <SearchableSelect
                value={form.campaignId || "none"}
                disabled={Boolean(item) || !editable}
                onValueChange={(value) => set({ campaignId: value === "none" ? "" : value })}
                options={[
                  { value: "none", label: t("noCampaign") },
                  ...(campaigns.data?.data ?? [])
                    .filter((row) => row.status !== "ended" || row.id === form.campaignId)
                    .map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` })),
                ]}
              />
            </Field>
            <Field label={t("fields.startsOn")} required>
              <DateField
                value={form.startsOn}
                display={form.startsOn ? format.date(form.startsOn) : tFilters("pickDate")}
                disabled={!editable}
                onChange={(event) => set({ startsOn: event.target.value })}
              />
            </Field>
            <Field label={t("fields.endsOn")} hint={t("hints.endsOn")}>
              <DateField
                value={form.endsOn}
                min={form.startsOn || undefined}
                display={form.endsOn ? format.date(form.endsOn) : tFilters("pickDate")}
                disabled={!editable}
                onChange={(event) => set({ endsOn: event.target.value })}
              />
            </Field>
            <Field label={t("fields.priority")} hint={t("hints.priority")} required>
              <NumberInput
                step={1}
                value={form.priority}
                disabled={!editable}
                onChange={(event) => set({ priority: event.target.value })}
              />
            </Field>
            <Field label={t("fields.stacking")} hint={t(`stackingHints.${form.stacking}`)}>
              <SearchableSelect
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
        </FormSection>

        <FormSection card step={2} title={t("conditions")} description={t("conditionsNote")}>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("fields.channels")}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
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
            <div className="flex flex-wrap gap-x-5 gap-y-3">
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
            {productTypes.isPending && productTypes.fetchStatus !== "idle" ? (
              <div aria-busy="true" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((slot) => (
                  <span key={slot} className="bg-surface-subtle h-6 rounded-md" />
                ))}
              </div>
            ) : typeOptions.length ? (
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {typeOptions.map((option) => (
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
            ) : (
              <p className="text-muted text-sm">{t("hints.noProductTypes")}</p>
            )}
          </fieldset>
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            {number(
              t("fields.minOrderValue"),
              form.conditions.minOrderValue,
              (value) => setConditions({ minOrderValue: value }),
              t("hints.minOrderValue"),
            )}
            {number(
              t("fields.minQuantity"),
              form.conditions.minQuantity,
              (value) => setConditions({ minQuantity: value }),
              t("hints.minQuantity"),
            )}
          </div>
          <Switch
            label={t("fields.firstOrderOnly")}
            disabled={!editable}
            checked={form.conditions.firstOrderOnly}
            onCheckedChange={(firstOrderOnly) => setConditions({ firstOrderOnly })}
          />
        </FormSection>

        <FormSection card step={3} title={t("benefit")} description={t("benefitNote")}>
          {redeemed ? <Callout tone="info" title={t("benefitLocked")} /> : null}
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <Field label={t("fields.benefitType")}>
              <SearchableSelect
                value={benefit.type}
                disabled={!editable || redeemed}
                onValueChange={(type) => setBenefit({ type: type as BenefitType })}
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
            {benefit.type === "tiered" ? (
              <Field label={t("fields.basis")}>
                <SearchableSelect
                  value={benefit.basis}
                  disabled={!editable || redeemed}
                  onValueChange={(basis) => setBenefit({ basis: basis as Draft["benefit"]["basis"] })}
                  options={(["value", "quantity"] as const).map((value) => ({ value, label: t(`bases.${value}`) }))}
                />
              </Field>
            ) : null}
            {benefit.type === "percent" || benefit.type === "tiered"
              ? number(
                  t("fields.maxAmount"),
                  benefit.maxAmount,
                  (maxAmount) => setBenefit({ maxAmount }),
                  t("hints.cap"),
                  undefined,
                  redeemed,
                )
              : null}
            {benefit.type === "unit_price_override"
              ? number(
                  t("fields.unitPrice"),
                  benefit.unitPrice,
                  (unitPrice) => setBenefit({ unitPrice }),
                  t("hints.unitPrice"),
                  undefined,
                  redeemed,
                )
              : null}
            {benefit.type === "free_revision_rounds"
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
          {benefit.type === "tiered" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("fields.tiers")}</legend>
              {benefit.tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-2">
                  <Field label={t(`fields.tierFrom.${benefit.basis}`, { no: index + 1 })}>
                    <NumberInput
                      min={0}
                      step="any"
                      value={tier.min}
                      disabled={!editable || redeemed}
                      onChange={(event) => setTier(index, { min: event.target.value })}
                    />
                  </Field>
                  <Field label={t("fields.tierPct", { no: index + 1 })}>
                    <NumberInput
                      min={0}
                      step="any"
                      unit="%"
                      value={tier.pct}
                      disabled={!editable || redeemed}
                      onChange={(event) => setTier(index, { pct: event.target.value })}
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
                  onClick={() => setBenefit({ tiers: [...benefit.tiers, blankTier()] })}
                >
                  {t("addTier")}
                </Button>
              ) : null}
            </fieldset>
          ) : null}
          <p className="text-muted text-xs">{t("marginGuard")}</p>
        </FormSection>

        <FormSection card step={4} title={t("limits")}>
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-3">
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
        </FormSection>

        {item?.kind === "coupon" ? <CouponCodes promotion={item} /> : null}
      </FormColumns>

      {action && item ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${wording(action)}.title`)}
          description={t(`actions.${wording(action)}.body`, { name: item.name })}
          confirmLabel={t(`actions.${wording(action)}.label`)}
          tone={action.action === "end" ? "destructive" : "primary"}
          reason={
            action.action === "activate"
              ? undefined
              : { label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }
          }
          onConfirm={async ({ reason }) => {
            try {
              const { data: updated } = await adminBrowserApis().contract.POST(
                "/v1/admin/promotions/{promotionId}/actions/{action}",
                {
                  params: { path: { promotionId: item.id, action: action.action } },
                  body: reason ? { reason } : {},
                },
              );
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
