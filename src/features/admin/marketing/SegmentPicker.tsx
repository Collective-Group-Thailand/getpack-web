"use client";

import { useTranslations } from "next-intl";

import { BUSINESS_TYPES, LOYALTY_TIERS } from "@/lib/api/requests/admin-loyalty-p2";
import { Checkbox } from "@/ui/components/Checkbox";
import { NumberInput } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { audienceOf, CRITERIA, incompleteCriteria, type AudienceDraft, type Criterion } from "./audience";

/**
 * Who a promotion is for (loyalty P2, D-494; prototype `p2-promotion-audience.html`): five criteria, each a checkbox
 * that reveals its control — ลูกค้าใหม่ · ระดับสมาชิก · ประเภทธุรกิจ · ไม่ได้สั่งซื้อมาแล้ว n วัน · เคยสั่งประเภท
 * สินค้า. Every criterion that is on must hold (AND); inside one, any value matches (OR). The rule reads back as one
 * sentence above the list. Controlled: the parent keeps the draft, the estimate and the save.
 */
export function SegmentPicker({
  draft,
  onChange,
  productTypes,
  disabled = false,
}: {
  draft: AudienceDraft;
  onChange: (draft: AudienceDraft) => void;
  productTypes: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const t = useTranslations("marketing.promotion.audience");
  const incomplete = new Set(incompleteCriteria(draft));
  const set = (patch: Partial<AudienceDraft>) => onChange({ ...draft, ...patch });
  const turn = (criterion: Criterion, on: boolean) => set({ on: { ...draft.on, [criterion]: on } });
  const toggle = (values: readonly string[], value: string) =>
    values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const typeLabel = (code: string) => productTypes.find((type) => type.value === code)?.label ?? code;

  const sentence = (() => {
    const audience = audienceOf(draft);
    if (!audience) return null;
    const parts: string[] = [];
    if (audience.newCustomer) parts.push(t("say.newCustomer"));
    if (audience.tiers)
      parts.push(t("say.tiers", { tiers: audience.tiers.map((tier) => t(`tiers.${tier}`)).join(t("or")) }));
    if (audience.businessTypes)
      parts.push(
        t("say.businessTypes", {
          types: audience.businessTypes.map((type) => t(`businessTypes.${type}`)).join(t("or")),
        }),
      );
    if (audience.inactiveDaysGte) parts.push(t("say.inactive", { days: audience.inactiveDaysGte }));
    if (audience.orderedProductTypeCodes)
      parts.push(t("say.ordered", { types: audience.orderedProductTypeCodes.map(typeLabel).join(t("or")) }));
    return parts;
  })();

  const chips = (
    values: readonly string[],
    options: { value: string; label: string }[],
    onPick: (v: string) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onPick(option.value)}
            className={cn(
              "rounded-control focus-visible:ring-focus-ring inline-flex h-8 items-center gap-1.5 border px-3 text-[0.84375rem] outline-none focus-visible:ring-2 disabled:opacity-60",
              on
                ? "border-primary bg-primary-subtle text-primary-subtle-fg font-medium"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            {on ? <Icon name="check" size={14} aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const control = (criterion: Criterion) => {
    switch (criterion) {
      case "newCustomer":
        return null;
      case "tiers":
        return chips(
          draft.tiers,
          LOYALTY_TIERS.map((tier) => ({ value: tier, label: t(`tiers.${tier}`) })),
          (value) => set({ tiers: toggle(draft.tiers, value) }),
        );
      case "businessTypes":
        return chips(
          draft.businessTypes,
          BUSINESS_TYPES.map((type) => ({ value: type, label: t(`businessTypes.${type}`) })),
          (value) => set({ businessTypes: toggle(draft.businessTypes, value) }),
        );
      case "inactiveDays":
        return (
          <label className="flex items-center gap-2.5 text-sm">
            <span className="w-28">
              <NumberInput
                min={1}
                step={1}
                value={draft.inactiveDays}
                disabled={disabled}
                aria-label={t("criteria.inactiveDays.label")}
                onChange={(event) => set({ inactiveDays: event.target.value })}
              />
            </span>
            {t("daysOrMore")}
          </label>
        );
      case "orderedTypes":
        return productTypes.length ? (
          chips(draft.orderedTypes, productTypes, (value) => set({ orderedTypes: toggle(draft.orderedTypes, value) }))
        ) : (
          <p className="text-muted text-sm">{t("noProductTypes")}</p>
        );
    }
  };

  return (
    <div className="flex flex-col">
      <p className="bg-bg-subtle rounded-card text-muted mb-1 flex min-h-11 flex-wrap items-center gap-x-1.5 gap-y-1 px-3.5 py-2.5 text-[0.84375rem]">
        {sentence ? (
          sentence.map((part, at) => (
            <span key={part} className="inline-flex items-center gap-1.5">
              {at > 0 ? <span className="text-subtle text-xs">{t("and")}</span> : null}
              <b className="text-fg font-semibold">{part}</b>
            </span>
          ))
        ) : (
          <span>{t("everyone")}</span>
        )}
      </p>
      <ul className="m-0 list-none p-0">
        {CRITERIA.map((criterion) => (
          <li key={criterion} className="border-border py-4 not-first:border-t">
            <Checkbox
              label={<span className="font-semibold">{t(`criteria.${criterion}.label`)}</span>}
              description={t(`criteria.${criterion}.hint`)}
              checked={draft.on[criterion]}
              disabled={disabled}
              onCheckedChange={(on) => turn(criterion, on === true)}
            />
            {draft.on[criterion] && criterion !== "newCustomer" ? (
              <div className="ms-7 mt-3">
                {control(criterion)}
                {incomplete.has(criterion) ? <p className="text-muted mt-2 text-[0.8125rem]">{t("pickOne")}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
