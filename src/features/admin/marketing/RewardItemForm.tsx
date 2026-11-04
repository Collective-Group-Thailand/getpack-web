"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { isApiError } from "@/lib/api/problem";
import type { RewardCatalogItem } from "@/lib/api/requests/admin-loyalty-p3";
import type { LoyaltyTierP3, RewardKind } from "@/lib/api/requests/store-loyalty-p3";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field, FormSection } from "@/ui/components/Field";
import { EDGE_BAR, FormColumns, FormSummary, SummaryRows } from "@/ui/components/FormLayout";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Ticket } from "@/ui/components/Ticket";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage } from "../console";
import {
  blankRewardDraft,
  draftFieldOfPath,
  REWARD_KINDS_ORDER,
  REWARD_TIERS,
  rewardActionsOf,
  rewardDraftOf,
  rewardDraftProblems,
  rewardInputOf,
  type RewardDraft,
  type RewardDraftProblem,
} from "./reward-item";

export interface RewardItemFormProps {
  /** Null: a new item. */
  item: RewardCatalogItem | null;
  etag?: string | null;
  editable: boolean;
  /** Product types for the condition, `{ value: code, label }` (`useProductTypes().options`). */
  productTypes: readonly { value: string; label: string }[];
  /** After a create, an edit or a lifecycle action, with the item the API answered. */
  onSaved: (item: RewardCatalogItem, etag: string | null) => void;
}

/**
 * One reward of the catalogue (loyalty P3, D-498; `admin.rewardCatalog.*`): what it is (kind, Thai and English names),
 * what it gives (only the fields of its kind — benefit v2), who and when it applies to (minimum order, product types,
 * once every N months, tier), and its cost, validity, window and order. The aside previews the ticket as customers see
 * it — the stub is the cost — and carries the save and the lifecycle (activate, pause, archive). Code and kind lock
 * once the item has been active (409 `rewards.item_active`). The cash-off floor (minimum order ≥ 5 × the discount,
 * D-133) is the API's rule: the hint states it, the API's `cap_floor` lands on the field.
 */
export function RewardItemForm({ item, etag = null, editable, productTypes, onSaved }: RewardItemFormProps) {
  const t = useTranslations("marketing.rewards.form");
  const tKind = useTranslations("marketing.rewards.kinds");
  const tTier = useTranslations("marketing.rewards.tiers");
  const tStatus = useTranslations("marketing.rewards.statuses");
  const format = useFormat();
  const [draft, setDraft] = useState<RewardDraft>(() => (item ? rewardDraftOf(item) : blankRewardDraft()));
  const [shown, setShown] = useState<readonly RewardDraftProblem[]>([]);
  const [apiErrors, setApiErrors] = useState<Partial<Record<RewardDraftProblem, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const set = (patch: Partial<RewardDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const locked = item !== null && item.status !== "draft";
  const error = (field: RewardDraftProblem) =>
    apiErrors[field] ?? (shown.includes(field) ? t(`errors.${field}`) : undefined);

  const save = async () => {
    const problems = rewardDraftProblems(draft);
    setShown(problems);
    setApiErrors({});
    if (problems.length) {
      toast.error(t("fix"));
      return;
    }
    setSaving("save");
    try {
      const requests = adminBrowserApis().requests;
      const body = rewardInputOf(draft);
      if (!item) {
        const created = await requests.call("POST /v1/admin/loyalty/rewards", { body });
        toast.success(t("created"));
        onSaved(created, null);
      } else {
        const { code, kind, ...rest } = body;
        const { data, etag: next } = await requests.read("PATCH /v1/admin/loyalty/rewards/{itemId}", {
          path: { itemId: item.id },
          body: locked ? rest : { code, kind, ...rest },
          etag: etag ?? undefined,
        });
        toast.success(t("saved"));
        onSaved(data, next);
      }
    } catch (failure) {
      if (isApiError(failure)) {
        const mapped: Partial<Record<RewardDraftProblem, string>> = {};
        for (const refusal of failure.errors) {
          const field = draftFieldOfPath(refusal.path);
          if (field)
            mapped[field] = t.has(`refusals.${refusal.code}`) ? t(`refusals.${refusal.code}`) : refusal.message;
        }
        if (failure.code === "rewards.code_taken") mapped.code = t("refusals.code_taken");
        setApiErrors(mapped);
      }
      toast.error(problemMessage(failure, t("failed")));
    } finally {
      setSaving(null);
    }
  };

  const act = async (action: "activate" | "pause" | "archive") => {
    if (!item) return;
    setSaving(action);
    try {
      const updated = await adminBrowserApis().requests.call(
        "POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}",
        { path: { itemId: item.id, action } },
      );
      toast.success(t(`actions.${action}.done`));
      onSaved(updated, null);
    } catch (failure) {
      toast.error(problemMessage(failure, t("failed")));
    } finally {
      setSaving(null);
    }
  };

  const number = (field: keyof RewardDraft & RewardDraftProblem, label: string, hint?: string, unit?: string) => (
    <Field label={label} hint={hint} error={error(field)}>
      <NumberInput
        min={0}
        step="any"
        value={draft[field] as string}
        unit={unit}
        disabled={!editable}
        onChange={(event) => set({ [field]: event.target.value } as Partial<RewardDraft>)}
      />
    </Field>
  );

  const costText = /^\d+$/.test(draft.costPoints) ? format.number(Number(draft.costPoints)) : "–";
  const conditionLine = [
    draft.minOrderValue.trim() ? t("preview.min", { amount: draft.minOrderValue.trim() }) : null,
    draft.perUserEveryMonths.trim() ? t("preview.every", { months: draft.perUserEveryMonths.trim() }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const saveButton = editable ? (
    <Button iconStart="save" loading={saving === "save"} onClick={() => void save()}>
      {item ? t("save") : t("create")}
    </Button>
  ) : null;

  return (
    <FormColumns
      aside={
        <FormSummary title={t("preview.title")} barClassName={EDGE_BAR} action={saveButton}>
          {/* What customers see on the redeem page: the stub is the cost. */}
          <Ticket
            stubSize={64}
            stubClassName="flex items-center px-4"
            bodyClassName="gap-0.5 px-4 pt-3 pb-3.5"
            stub={
              <span className="flex items-baseline gap-1.5 leading-none tabular-nums">
                <span className="text-[2rem] font-semibold tracking-[-0.03em]">{costText}</span>
                <span className="text-[0.8125rem] font-medium">{t("preview.unit")}</span>
              </span>
            }
          >
            <p className="text-[0.9375rem] leading-snug font-semibold">{draft.nameTh.trim() || t("preview.noName")}</p>
            {conditionLine ? <p className="text-muted text-[0.8125rem]">{conditionLine}</p> : null}
          </Ticket>
          <SummaryRows
            rows={[
              { key: "kind", label: t("kind"), value: tKind(draft.kind) },
              {
                key: "tier",
                label: t("tier"),
                value: draft.tierRequired ? tTier(draft.tierRequired) : t("everyone"),
              },
              { key: "validity", label: t("validityDays"), value: t("days", { days: draft.validityDays || "–" }) },
              ...(item
                ? [
                    {
                      key: "status",
                      label: t("status"),
                      value: (
                        <Badge size="sm" tone={item.status === "active" ? "success" : "neutral"}>
                          {tStatus(item.status)}
                        </Badge>
                      ),
                    },
                    {
                      key: "redemptions",
                      label: t("redemptions30d"),
                      value: format.number(item.redemptions30d),
                    },
                  ]
                : []),
            ]}
          />
          {item && editable && rewardActionsOf(item.status).length ? (
            <div data-fill="row" className="border-border flex flex-col gap-2 border-t pt-4">
              {rewardActionsOf(item.status).map((action) => (
                <Button
                  key={action}
                  variant={action === "archive" ? "ghost" : "secondary"}
                  loading={saving === action}
                  onClick={() => void act(action)}
                >
                  {t(`actions.${action}.label`)}
                </Button>
              ))}
            </div>
          ) : null}
        </FormSummary>
      }
    >
      {locked ? <Callout tone="info" title={t("lockedNote")} /> : null}
      <FormSection card step={1} title={t("sections.what")} description={t("sections.whatNote")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("kind")}>
            <NativeSelect<RewardKind>
              value={draft.kind}
              disabled={!editable || locked}
              onValueChange={(kind) => set({ kind })}
              options={REWARD_KINDS_ORDER.map((value) => ({ value, label: tKind(value) }))}
            />
          </Field>
          <Field label={t("code")} hint={t("codeHint")} error={error("code")} required>
            <Input
              value={draft.code}
              disabled={!editable || locked}
              className="font-mono"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => set({ code: event.target.value.trim().toLowerCase() })}
            />
          </Field>
          <Field label={t("nameTh")} error={error("nameTh")} required>
            <Input
              value={draft.nameTh}
              disabled={!editable}
              onChange={(event) => set({ nameTh: event.target.value })}
            />
          </Field>
          <Field label={t("nameEn")} error={error("nameEn")} required>
            <Input
              lang="en"
              value={draft.nameEn}
              disabled={!editable}
              onChange={(event) => set({ nameEn: event.target.value })}
            />
          </Field>
          <Field label={t("descriptionTh")}>
            <Textarea
              rows={2}
              value={draft.descriptionTh}
              disabled={!editable}
              onChange={(event) => set({ descriptionTh: event.target.value })}
            />
          </Field>
          <Field label={t("descriptionEn")}>
            <Textarea
              rows={2}
              lang="en"
              value={draft.descriptionEn}
              disabled={!editable}
              onChange={(event) => set({ descriptionEn: event.target.value })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection card step={2} title={t("sections.value")} description={t(`valueNotes.${draft.kind}`)}>
        <div className="grid gap-4 md:grid-cols-2">
          {draft.kind === "cash_off" ? number("amount", t("amount"), t("amountHint")) : null}
          {draft.kind === "free_addon" ? (
            <Field label={t("addonCode")} hint={t("addonCodeHint")} error={error("addonCode")} required>
              <Input
                value={draft.addonCode}
                disabled={!editable}
                className="font-mono"
                spellCheck={false}
                onChange={(event) => set({ addonCode: event.target.value.trim().toLowerCase() })}
              />
            </Field>
          ) : null}
          {draft.kind === "free_shipping" || draft.kind === "free_sample" || draft.kind === "free_addon"
            ? number(
                "maxAmount",
                t("maxAmount"),
                t(draft.kind === "free_shipping" ? "maxAmountOptional" : "maxAmountHint"),
              )
            : null}
          {draft.kind === "free_rush" ? number("daysSaved", t("daysSaved"), t("daysSavedHint")) : null}
          {draft.kind === "revision_round" ? number("rounds", t("rounds"), t("roundsHint")) : null}
        </div>
      </FormSection>

      <FormSection card step={3} title={t("sections.conditions")} description={t("sections.conditionsNote")}>
        <div className="grid gap-4 md:grid-cols-2">
          {number(
            "minOrderValue",
            t("minOrderValue"),
            draft.kind === "cash_off" ? t("minOrderCashHint") : t("minOrderHint"),
          )}
          {number("perUserEveryMonths", t("perUserEveryMonths"), t("perUserEveryMonthsHint"))}
          <Field label={t("tier")} hint={t("tierHint")}>
            <NativeSelect<LoyaltyTierP3 | "">
              value={draft.tierRequired}
              disabled={!editable}
              onValueChange={(tierRequired) => set({ tierRequired })}
              options={[
                { value: "", label: t("everyone") },
                ...REWARD_TIERS.map((value) => ({ value, label: t("tierAndUp", { tier: tTier(value) }) })),
              ]}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("productTypes")}</legend>
          <p className="text-muted -mt-1 mb-1 text-[0.8125rem]">{t("productTypesHint")}</p>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {productTypes.map((type) => (
              <Checkbox
                key={type.value}
                label={type.label}
                disabled={!editable}
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
      </FormSection>

      <FormSection card step={4} title={t("sections.cost")} description={t("sections.costNote")}>
        <div className="grid gap-4 md:grid-cols-2">
          {number("costPoints", t("costPoints"), t("costPointsHint"), t("preview.unit"))}
          {number("validityDays", t("validityDays"), t("validityDaysHint"), t("daysUnit"))}
          <Field label={t("activeFrom")} hint={t("activeFromHint")}>
            <Input
              type="date"
              value={draft.activeFrom}
              disabled={!editable}
              onChange={(event) => set({ activeFrom: event.target.value })}
            />
          </Field>
          <Field label={t("activeTo")} hint={t("activeToHint")} error={error("window")}>
            <Input
              type="date"
              value={draft.activeTo}
              disabled={!editable}
              onChange={(event) => set({ activeTo: event.target.value })}
            />
          </Field>
          {number("sortOrder", t("sortOrder"), t("sortOrderHint"))}
        </div>
      </FormSection>
    </FormColumns>
  );
}
