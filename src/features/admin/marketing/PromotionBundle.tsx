"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { promotionP2Of } from "@/features/shared/loyalty-p2/read";
import { isApiError, type ProblemFieldError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field, FormSection } from "@/ui/components/Field";
import { EDGE_BAR, FormColumns, FormSummary } from "@/ui/components/FormLayout";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, problemMessage, useProductTypes } from "../console";
import {
  blankBundleRow,
  bundleChecks,
  bundleDraftOf,
  bundleItemsOf,
  bundleRowProblems,
  configurationSummary,
  type BundleRowDraft,
} from "./audience";

/**
 * The promotion editor's "ชุดสินค้า" tab (loyalty P2, D-494; prototype `p2-promotion-audience.html`): 2–4 pieces, each
 * a product type, its preset (the configurator's configuration, as JSON) and a quantity; the number of product types
 * the cart must hold; and `stackGroup` locked to `bundle` (the API refuses a bundle in any other group). Prices are
 * the API's — the publish guard reports a piece that does not price today (`bundle_unpriceable`), shown on its row.
 * Saved through the published `admin.promotions.update` with conditions v2 and display v2. CONTRACT-REQUEST
 * admin.promotions.audience: one cast, here.
 */
export function PromotionBundle({ item, editable }: { item: Schemas["PromotionDto"]; editable: boolean }) {
  const t = useTranslations("marketing.promotion.bundle");
  const queryClient = useQueryClient();
  const productTypes = useProductTypes();
  const saved = promotionP2Of(item);
  const isBundle = (saved.cartProductTypeCountGte ?? 0) >= 2;
  const [rows, setRows] = useState<BundleRowDraft[]>(() => bundleDraftOf(saved.bundleItems));
  const [minTypes, setMinTypes] = useState(String(saved.cartProductTypeCountGte ?? 2));
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [refusals, setRefusals] = useState<readonly ProblemFieldError[]>([]);
  const checks = bundleChecks(rows, Number(minTypes));
  const ready = checks.count && checks.types && checks.rows;
  const rowRefusal = (index: number) =>
    refusals.find((refusal) => refusal.path.includes(`items[${index}]`) || refusal.path.endsWith(`.${index}`));
  const setRow = (index: number, patch: Partial<BundleRowDraft>) =>
    setRows(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const typeOptions = productTypes.types
    .filter((type) => type.status === "active" || rows.some((row) => row.productTypeCode === type.code))
    .map((type) => ({ value: type.code, label: productTypes.labelOf(type.code) }));

  const send = async (bundle: boolean) => {
    setSaving(true);
    setRefusals([]);
    try {
      const api = adminBrowserApis().contract;
      const { response } = await api.GET("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id } },
      });
      const conditions = { ...(item.conditions as Record<string, unknown>) };
      delete conditions.cartProductTypeCountGte;
      // CONTRACT-REQUEST admin.promotions.audience — conditions v2 and display v2 are not in the published body yet.
      const body = (bundle
        ? {
            stackGroup: "bundle",
            conditions: { ...conditions, cartProductTypeCountGte: Math.trunc(Number(minTypes)) },
            conditionsSchemaVersion: 2,
            display: { bundle: { items: bundleItemsOf(rows) } },
            displaySchemaVersion: 2,
          }
        : {
            stackGroup: null,
            conditions,
            display: { bundle: null },
            displaySchemaVersion: 2,
          }) as unknown as Schemas["UpdatePromotionDto"];
      const { data } = await api.PATCH("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id }, header: { "If-Match": response.headers.get("ETag") ?? "" } },
        body,
      });
      queryClient.setQueryData(queryKeys.detail("admin", "promotion", item.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      toast.success(bundle ? t("saved") : t("removed"));
    } catch (error) {
      if (isApiError(error)) setRefusals(error.errors);
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormColumns
      aside={
        <FormSummary
          title={t("checks.title")}
          barClassName={EDGE_BAR}
          action={
            editable ? (
              <Button iconStart="save" loading={saving} disabled={!ready} onClick={() => void send(true)}>
                {t("save")}
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-4">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.8125rem]">
              {(["count", "types", "rows"] as const).map((key) => (
                <li key={key} className={cn("flex items-start gap-2", checks[key] ? "text-muted" : "text-fg")}>
                  <Icon
                    name={checks[key] ? "check" : "close"}
                    size={14}
                    aria-hidden="true"
                    className={cn("mt-[3px] shrink-0", checks[key] ? "text-success" : "text-danger")}
                  />
                  {t(`checks.${key}`)}
                </li>
              ))}
            </ul>
            <p className="text-muted text-[0.8125rem]">{t("pricingNote")}</p>
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
            {editable && isBundle ? (
              <Button
                variant="ghost"
                className="text-danger self-start"
                disabled={saving}
                onClick={() => void send(false)}
              >
                {t("remove")}
              </Button>
            ) : null}
          </div>
        </FormSummary>
      }
    >
      <FormSection card step={1} title={t("title")} description={t("description")}>
        <ol className="m-0 list-none p-0">
          {rows.map((row, index) => {
            const problems = bundleRowProblems(row);
            const refusal = rowRefusal(index);
            const summary = configurationSummary(row.configuration);
            return (
              <li
                key={index}
                className="border-border grid gap-3 py-4 not-first:border-t md:grid-cols-[1.5rem_minmax(0,1fr)_9rem_auto]"
              >
                <span className="text-subtle pt-2 text-[0.8125rem] tabular-nums max-md:hidden">{index + 1}</span>
                <div className="flex min-w-0 flex-col gap-2">
                  <Field label={t("fields.type", { no: index + 1 })}>
                    <SearchableSelect
                      value={row.productTypeCode || "none"}
                      disabled={!editable}
                      onValueChange={(value) => setRow(index, { productTypeCode: value === "none" ? "" : value })}
                      options={[{ value: "none", label: t("fields.pickType") }, ...typeOptions]}
                    />
                  </Field>
                  <p className="text-muted text-[0.8125rem] [overflow-wrap:anywhere]">
                    {summary || t("fields.noPreset")}{" "}
                    <button
                      type="button"
                      className="text-primary font-medium underline underline-offset-4"
                      aria-expanded={open === index}
                      onClick={() => setOpen(open === index ? null : index)}
                    >
                      {open === index ? t("fields.hidePreset") : t("fields.editPreset")}
                    </button>
                  </p>
                  {open === index ? (
                    <Field label={t("fields.preset")} hint={t("fields.presetHint")}>
                      <Textarea
                        rows={5}
                        className="font-mono text-[0.8125rem]"
                        value={row.configuration}
                        disabled={!editable}
                        onChange={(event) => setRow(index, { configuration: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  {problems.includes("configuration") ? (
                    <p className="text-danger text-[0.8125rem]">{t("problems.configuration")}</p>
                  ) : null}
                  {refusal ? (
                    <p className="text-danger flex items-center gap-1.5 text-[0.8125rem]">
                      <Icon name="error" size={14} aria-hidden="true" />
                      {t.has(`refusals.${refusal.code}`) ? t(`refusals.${refusal.code}`) : refusal.message}
                    </p>
                  ) : null}
                </div>
                <Field label={t("fields.quantity")}>
                  <NumberInput
                    min={1}
                    step={1}
                    value={row.quantity}
                    disabled={!editable}
                    onChange={(event) => setRow(index, { quantity: event.target.value })}
                  />
                </Field>
                <div className="flex items-end md:pt-7">
                  <IconButton
                    name="trash"
                    variant="ghost"
                    label={t("removeItem", { no: index + 1 })}
                    disabled={!editable || rows.length <= 2}
                    onClick={() => setRows(rows.filter((_, at) => at !== index))}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        {editable && rows.length < 4 ? (
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            className="self-start"
            onClick={() => setRows([...rows, blankBundleRow()])}
          >
            {t("addItem")}
          </Button>
        ) : null}
        <div className="border-border grid gap-4 border-t pt-4 md:grid-cols-2">
          <Field label={t("fields.minTypes")} hint={t("fields.minTypesHint")}>
            <NumberInput
              min={2}
              max={10}
              step={1}
              unit={t("fields.types")}
              value={minTypes}
              disabled={!editable}
              onChange={(event) => setMinTypes(event.target.value)}
            />
          </Field>
          <Field label={t("fields.stackGroup")} hint={t("fields.stackGroupHint")}>
            <Input value="bundle" disabled readOnly />
          </Field>
        </div>
      </FormSection>
    </FormColumns>
  );
}
