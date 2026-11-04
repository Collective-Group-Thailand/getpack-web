"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { isApiError, type ProblemFieldError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { FormSection } from "@/ui/components/Field";
import { EDGE_BAR, FormColumns, FormSummary } from "@/ui/components/FormLayout";
import { RadioCards } from "@/ui/components/RadioCards";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { adminBrowserApis, problemMessage, useProductTypes } from "../console";
import { audienceDraftOf, audienceOf, type AudienceDraft } from "./audience";
import { SegmentPicker } from "./SegmentPicker";

type Listing = "everyone" | "matching_only";

/**
 * The promotion editor's "กลุ่มลูกค้า" tab (loyalty P2, D-494; prototype `p2-promotion-audience.html`): the segment
 * picker, the live "ตรงกับลูกค้าประมาณ N ราย" (`admin.promotions.estimateAudience`, rounded, hidden under 10), who sees
 * the deal on the deals page, and a note on what customers are told. Saved through the published
 * `admin.promotions.update` with conditions v2 (`audience`; any legacy `segments` dropped — the API refuses both) and
 * display v2 (`listing`); the estimate is `admin.promotions.estimateAudience` (rounded to tens, null under 10).
 */
export function PromotionAudience({ item, editable }: { item: Schemas["PromotionDto"]; editable: boolean }) {
  const t = useTranslations("marketing.promotion.audience");
  const format = useFormat();
  const queryClient = useQueryClient();
  const productTypes = useProductTypes();
  const [draft, setDraft] = useState<AudienceDraft>(() => audienceDraftOf(item.conditions.audience ?? null));
  const [listing, setListing] = useState<Listing>(item.display.listing);
  const [saving, setSaving] = useState(false);
  const [refusals, setRefusals] = useState<readonly ProblemFieldError[]>([]);
  const audience = audienceOf(draft);
  const audienceJson = audience ? JSON.stringify(audience) : "";

  // The estimate follows the draft, a moment after the last change.
  const [asked, setAsked] = useState(audienceJson);
  useEffect(() => {
    const timer = setTimeout(() => setAsked(audienceJson), 400);
    return () => clearTimeout(timer);
  }, [audienceJson]);
  const estimate = useQuery({
    queryKey: queryKeys.related("admin", "promotion", item.id, `audience:${asked}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}/audience-estimate", {
          params: { path: { promotionId: item.id }, query: asked ? { audience: asked } : {} },
        })
      ).data!,
    enabled: Boolean(asked),
    staleTime: 60_000,
  });

  const typeOptions = productTypes.types
    .filter((type) => type.status === "active" || draft.orderedTypes.includes(type.code))
    .map((type) => ({ value: type.code, label: productTypes.labelOf(type.code) }));
  const matchingOnlyWithoutAudience = listing === "matching_only" && !audience;

  const save = async () => {
    setSaving(true);
    setRefusals([]);
    try {
      const api = adminBrowserApis().contract;
      const { response } = await api.GET("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id } },
      });
      const { segments: _legacy, ...conditions } = item.conditions as Schemas["PromotionConditionsDto"] & {
        audience?: unknown;
      };
      void _legacy;
      // CONTRACT-REQUEST admin.promotions.audience — conditions v2 and display v2 are not in the published body yet.
      const body = {
        conditions: { ...conditions, ...(audience ? { audience } : { audience: undefined }) },
        conditionsSchemaVersion: 2,
        display: { listing },
        displaySchemaVersion: 2,
      } as unknown as Schemas["UpdatePromotionDto"];
      const { data } = await api.PATCH("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
        body,
      });
      queryClient.setQueryData(queryKeys.detail("admin", "promotion", item.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      toast.success(t("saved"));
    } catch (error) {
      if (isApiError(error) && error.errors.length) setRefusals(error.errors);
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  const figure = !audience ? (
    <span className="text-muted text-base font-medium">{t("estimate.everyone")}</span>
  ) : estimate.isPending || asked !== audienceJson ? (
    <Skeleton className="h-9 w-28" />
  ) : estimate.data?.customers === null || estimate.data === undefined ? (
    <span className="text-muted text-base font-medium">{t("estimate.few")}</span>
  ) : (
    <>
      {format.number(estimate.data.customers)}
      <span className="text-muted ms-1.5 text-[0.9375rem] font-medium">{t("estimate.unit")}</span>
    </>
  );

  return (
    <FormColumns
      aside={
        <FormSummary
          title={t("estimate.title")}
          barClassName={EDGE_BAR}
          action={
            editable ? (
              <Button
                iconStart="save"
                loading={saving}
                disabled={matchingOnlyWithoutAudience}
                onClick={() => void save()}
              >
                {t("save")}
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-5">
            <div aria-live="polite">
              <p className="text-[1.875rem] leading-tight font-semibold tracking-[-0.01em] tabular-nums">{figure}</p>
              <p className="text-muted mt-1 text-[0.8125rem]">{t("estimate.hint")}</p>
            </div>
            <section aria-labelledby="audience-listing" className="flex flex-col gap-2.5">
              <h3 id="audience-listing" className="m-0 text-sm font-semibold">
                {t("listing.title")}
              </h3>
              <RadioCards<Listing>
                columns={1}
                aria-label={t("listing.title")}
                value={listing}
                onValueChange={setListing}
                options={(["everyone", "matching_only"] as const).map((value) => ({
                  value,
                  label: t(`listing.${value}`),
                  description: t(`listing.${value}Hint`),
                  disabled: !editable,
                }))}
              />
              {matchingOnlyWithoutAudience ? (
                <p className="text-danger text-[0.8125rem]">{t("listing.needsAudience")}</p>
              ) : null}
            </section>
            <p className="bg-bg-subtle rounded-card text-muted flex items-start gap-2.5 px-3.5 py-3 text-[0.8125rem] leading-relaxed">
              <Icon name="info" size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t("customerNote")}
            </p>
            {refusals.length ? (
              <Callout tone="danger" live title={t("refused")}>
                <ul className="m-0 flex list-disc flex-col gap-1 ps-4 text-[0.8125rem]">
                  {refusals.map((refusal) => (
                    <li key={`${refusal.path}:${refusal.code}`}>
                      {t.has(`refusals.${refusal.code}`) ? t(`refusals.${refusal.code}`) : refusal.message}
                    </li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </div>
        </FormSummary>
      }
    >
      <FormSection card step={1} title={t("title")} description={t("description")}>
        <SegmentPicker draft={draft} onChange={setDraft} productTypes={typeOptions} disabled={!editable} />
      </FormSection>
    </FormColumns>
  );
}
