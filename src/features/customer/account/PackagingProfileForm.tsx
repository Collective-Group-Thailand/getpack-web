"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { PackagingProfile } from "@/lib/api/requests/store-loyalty";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { CheckboxTiles } from "@/ui/components/CheckboxTiles";
import { Field } from "@/ui/components/Field";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import {
  draftFrom,
  MONTHLY_BOX_VOLUMES,
  PRODUCT_CATEGORIES,
  SHIP_TO_REGIONS,
  toInput,
  validateDraft,
  type DraftErrors,
  type PackagingDraft,
  type Volume,
} from "./packaging-profile";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type MonthKey = `${(typeof MONTHS)[number]}`;

/**
 * "ข้อมูลการใช้บรรจุภัณฑ์" (loyalty P1, `store.loyalty.packagingProfile.put`): monthly box volume, product types,
 * ship-to regions and busy months, under a PDPA purpose the customer acknowledges on every save. The first complete
 * save earns the packaging-profile reward once (the API decides); the toast names it, and the checklist's cache is
 * dropped so `/account/points` reads the new state rather than announcing it a second time.
 */
export function PackagingProfileForm({
  profile,
  rewardPoints,
}: {
  profile: PackagingProfile;
  /** The task's points while it is still todo; null once earned or when the checklist is unavailable. */
  rewardPoints: number | null;
}) {
  const t = useTranslations("account.packagingProfile");
  const tPoints = useTranslations("account.points");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PackagingDraft>(() => draftFrom(profile));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(profile.updatedAt);
  const formRef = useRef<HTMLFormElement>(null);
  const [submits, setSubmits] = useState(0);

  // After a failed save, focus the first control of the first invalid group (its error is announced with it).
  useEffect(() => {
    if (submits === 0 || Object.keys(errors).length === 0) return;
    const group = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const control = group?.matches("input, button") ? group : group?.querySelector<HTMLElement>("input, button");
    control?.focus();
  }, [errors, submits]);

  const set = <K extends keyof PackagingDraft>(key: K, value: PackagingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key in errors)
      setErrors((current) => {
        const next = { ...current };
        delete next[key as keyof DraftErrors];
        return next;
      });
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDraft(draft);
    const messages = Object.fromEntries(Object.entries(found).map(([field, key]) => [field, t(key)])) as DraftErrors;
    setErrors(messages);
    setSubmits((n) => n + 1);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    const firstCompletion = profile.completedAt === null && savedAt === profile.updatedAt;
    try {
      const saved = await browserRequests().call("PUT /v1/store/loyalty/packaging-profile", { body: toInput(draft) });
      setSavedAt(saved.updatedAt);
      setDraft(draftFrom(saved));
      if (firstCompletion && rewardPoints) {
        toast(
          tPoints("earn.awarded", {
            points: format.number(rewardPoints),
            task: tPoints("tasks.packaging_profile.title"),
          }),
        );
      } else {
        toast(t("saved"));
      }
      queryClient.removeQueries({ queryKey: queryKeys.resource("customer", "loyalty") });
      router.refresh();
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  const section = "border-border border-t px-4 py-5 first:border-t-0 sm:px-6";
  const required = t("requiredMark");

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => void save(event)}
      className="border-border bg-surface rounded-panel max-w-3xl border"
    >
      {failure ? (
        <div className="px-4 pt-4 sm:px-6">
          <Callout tone="danger" live>
            {failure}
          </Callout>
        </div>
      ) : null}

      <div className={section}>
        <Field
          label={t("volume")}
          hint={t("volumeHint")}
          error={errors.monthlyBoxVolume}
          required
          requiredLabel={required}
        >
          <RadioCards<Volume>
            columns={4}
            value={draft.monthlyBoxVolume ?? undefined}
            onValueChange={(value) => set("monthlyBoxVolume", value)}
            options={MONTHLY_BOX_VOLUMES.map((value) => ({ value, label: t(`volumes.${value}`) }))}
          />
        </Field>
      </div>

      <div className={section}>
        <Field
          label={t("categories")}
          hint={t("multiHint")}
          error={errors.productCategories}
          required
          requiredLabel={required}
        >
          <CheckboxTiles
            columns={3}
            value={draft.productCategories}
            onValueChange={(value) => set("productCategories", value)}
            options={PRODUCT_CATEGORIES.map((value) => ({ value, label: t(`categoryNames.${value}`) }))}
          />
        </Field>
      </div>

      <div className={section}>
        <Field
          label={t("regions")}
          hint={t("multiHint")}
          error={errors.shipToRegions}
          required
          requiredLabel={required}
        >
          <CheckboxTiles
            columns={3}
            value={draft.shipToRegions}
            onValueChange={(value) => set("shipToRegions", value)}
            options={SHIP_TO_REGIONS.map((value) => ({ value, label: t(`regionNames.${value}`) }))}
          />
        </Field>
      </div>

      <div className={section}>
        <Field label={t("months")} hint={t("monthsHint")}>
          <CheckboxTiles<MonthKey>
            columns={6}
            compact
            value={draft.peakMonths.map((month) => String(month) as MonthKey)}
            onValueChange={(value) =>
              set(
                "peakMonths",
                value.map(Number).sort((a, b) => a - b),
              )
            }
            options={MONTHS.map((month) => ({ value: String(month) as MonthKey, label: t(`monthNames.${month}`) }))}
          />
        </Field>
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="bg-bg-subtle rounded-card p-4 sm:px-4.5">
          <h2 className="text-sm font-semibold">{t("purposeTitle")}</h2>
          <p className="text-muted mt-1 text-[0.84375rem] leading-relaxed">{t("purposeBody")}</p>
          <p className="text-muted mt-1 text-[0.84375rem] leading-relaxed">
            {t.rich("purposeRights", {
              link: (chunks) => (
                <Link href="/account/privacy" className="text-primary underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <Checkbox
            className="mt-3"
            checked={draft.purposeAccepted}
            onCheckedChange={(checked) => set("purposeAccepted", checked === true)}
            aria-invalid={errors.purposeAccepted ? true : undefined}
            aria-describedby={errors.purposeAccepted ? "purpose-error" : undefined}
            label={
              <>
                {t("purposeAck")}
                <span className="text-danger ms-1">
                  <span aria-hidden>*</span>
                  <span className="sr-only">{required}</span>
                </span>
              </>
            }
          />
          {errors.purposeAccepted ? (
            <p id="purpose-error" className="text-danger mt-1.5 text-xs font-medium">
              {errors.purposeAccepted}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center gap-3 border-t px-4 py-4 sm:px-6">
        <Button type="submit" size="nav" loading={saving} className="flex-1 sm:flex-none">
          {t("save")}
        </Button>
        <Button asChild variant="ghost" size="nav">
          <Link href="/account/points">{t("cancel")}</Link>
        </Button>
        <p className={cn("text-muted w-full text-xs sm:ms-auto sm:w-auto", !rewardPoints && !savedAt && "hidden")}>
          {rewardPoints && !profile.completedAt
            ? t("reward", { points: format.number(rewardPoints) })
            : savedAt
              ? t("savedAt", { date: format.date(savedAt) })
              : null}
        </p>
      </div>
    </form>
  );
}
