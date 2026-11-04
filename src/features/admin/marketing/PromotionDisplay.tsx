"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DealCard } from "@/features/shared/deals/DealCard";
import { uploadFile } from "@/features/shared/files/upload";
import { isApiError, type ProblemFieldError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field, FormSection } from "@/ui/components/Field";
import { EDGE_BAR, FormColumns, FormSummary } from "@/ui/components/FormLayout";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, problemMessage } from "../console";
import {
  canPublish,
  displayInput,
  previewDeal,
  publicFieldsOf,
  publishChecks,
  type DisplayDraft as Display,
  type PromotionVisibility,
  type PublishCheck,
} from "./promotion-display";

type Localized = { th: string; en: string };

/**
 * The promotion editor's "การแสดงผล" tab (loyalty P1.5, API-CHANGES-P15 Admin): who sees the promotion on the deals
 * surface (hidden by default, unlisted for a link only, public), the ticket's words in Thai and English, the slug,
 * "ดีลเด่น" and a hero image — with the storefront's own DealCard as the preview. Publishing (public or unlisted)
 * waits until the API's guard holds (active, slug, Thai headline and terms, no blocked words); the panel lists each
 * condition. When the API still refuses — 422 `promotions.not_publishable` — its `errors[]` are listed under the
 * button; 409 `promotions.slug_taken` sits under the slug.
 */
export function PromotionDisplay({ item, editable }: { item: Schemas["PromotionDto"]; editable: boolean }) {
  const t = useTranslations("marketing.promotion.display");
  const locale = useLocale() === "en" ? "en" : "th";
  const queryClient = useQueryClient();
  const saved = publicFieldsOf(item);
  const [visibility, setVisibility] = useState<PromotionVisibility>(saved.visibility);
  const [display, setDisplay] = useState<Display>(saved.display);
  const [heroUrl, setHeroUrl] = useState<string | null>(saved.heroImageUrl);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());
  const [uploading, setUploading] = useState(false);
  /** The API's refusal of the last save: each failed rule (422 `errors[]`), and a slug another promotion holds. */
  const [refusals, setRefusals] = useState<readonly ProblemFieldError[]>([]);
  const [slugTaken, setSlugTaken] = useState(false);
  const set = (patch: Partial<Display>) => setDisplay((current) => ({ ...current, ...patch }));
  const setText = (key: "headline" | "subline" | "terms", lang: keyof Localized, value: string) =>
    set({ [key]: { ...display[key], [lang]: value } } as Partial<Display>);
  const checks = publishChecks(item.status, display);
  const publishable = canPublish(checks);
  const shown = visibility !== "hidden";
  const blocked = shown && !publishable;
  const deal = previewDeal(item, display, locale);
  /** One failed rule of the API's guard, in the panel's words; an unknown rule shows the API's own message. */
  const refusalText = (refusal: ProblemFieldError) => {
    if (refusal.code === "blocked_word") {
      const [, key, lang] = refusal.path.split(".");
      const field =
        key === "badge"
          ? t("fields.badge")
          : key === "headline" || key === "subline" || key === "terms"
            ? t(`fields.${key}.${lang === "en" ? "en" : "th"}`)
            : refusal.path;
      return t("refusals.blocked_word", { field });
    }
    if (refusal.path === "visibility" && refusal.code === "system_managed") return t("refusals.system_managed");
    if (refusal.path === "status") return t("refusals.status");
    if (refusal.path === "display.slug") return t("refusals.slug");
    if (refusal.path === "display.headline.th") return t("refusals.headline");
    if (refusal.path === "display.terms.th") return t("refusals.terms");
    return refusal.message;
  };

  const save = async () => {
    setSaving(true);
    setRefusals([]);
    setSlugTaken(false);
    try {
      const { response } = await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id } },
      });
      const etag = response.headers.get("ETag");
      const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id }, header: { "If-Match": etag ?? "" } },
        body: { visibility, display: displayInput(display) },
      });
      queryClient.setQueryData(queryKeys.detail("admin", "promotion", item.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      toast.success(shown ? t("published") : t("saved"));
    } catch (error) {
      if (isApiError(error) && error.code === "promotions.not_publishable") setRefusals(error.errors);
      if (isApiError(error) && error.code === "promotions.slug_taken") setSlugTaken(true);
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFile("admin", file, "image");
      // admin.promotions.setHeroImage answers the promotion, with its new `heroImageUrl`.
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/promotions/{promotionId}/hero-image", {
        params: { path: { promotionId: item.id } },
        body: { heroImageFileId: uploaded.id },
      });
      setHeroUrl(data!.heroImageUrl);
      queryClient.setQueryData(queryKeys.detail("admin", "promotion", item.id), data);
      toast.success(t("heroSaved"));
    } catch (error) {
      toast.error(problemMessage(error, t("heroFailed")));
    } finally {
      setUploading(false);
    }
  };

  const pair = (key: "headline" | "subline" | "terms", multiline = false) =>
    (["th", "en"] as const).map((lang) => (
      <Field
        key={lang}
        label={t(`fields.${key}.${lang}`)}
        hint={lang === "th" && key !== "subline" ? t("fields.required") : undefined}
      >
        {multiline ? (
          <Textarea
            rows={4}
            value={display[key][lang]}
            disabled={!editable}
            onChange={(event) => setText(key, lang, event.target.value)}
          />
        ) : (
          <Input
            value={display[key][lang]}
            disabled={!editable}
            onChange={(event) => setText(key, lang, event.target.value)}
          />
        )}
      </Field>
    ));

  const action = editable ? (
    <Button
      iconStart={shown ? "megaphone" : "save"}
      loading={saving}
      disabled={blocked}
      aria-describedby="display-checks"
      onClick={() => void save()}
    >
      {shown ? t("publish") : t("save")}
    </Button>
  ) : null;

  return (
    <FormColumns
      aside={
        <FormSummary title={t("preview")} barClassName={EDGE_BAR} action={action}>
          <div className="flex flex-col gap-4">
            <DealCard
              deal={deal}
              signedIn
              now={now}
              stateOverride={deal.code ? "claimable" : "automatic"}
              showBadge={display.featured}
            />
            <div className="border-border bg-surface rounded-card overflow-hidden border">
              <DealCard
                deal={deal}
                signedIn
                now={now}
                variant="compact"
                stateOverride={deal.code ? "claimable" : "automatic"}
              />
            </div>
            <section id="display-checks" aria-labelledby="display-checks-title">
              <h3 id="display-checks-title" className="m-0 text-sm font-semibold">
                {t("checks.title")}
              </h3>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[0.8125rem]">
                {(Object.keys(checks) as PublishCheck[]).map((key) => (
                  <li key={key} className={cn("flex items-start gap-2", checks[key] ? "text-muted" : "text-fg")}>
                    <Icon
                      name={checks[key] ? "check" : "close"}
                      size={14}
                      aria-hidden="true"
                      className={cn("mt-[3px] shrink-0", checks[key] ? "text-success" : "text-danger")}
                    />
                    <span>
                      {t(`checks.${key}`)}
                      <span className="sr-only">{checks[key] ? t("checks.met") : t("checks.unmet")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            {refusals.length > 0 ? (
              <Callout tone="danger" live title={t("refusals.title")}>
                <ul className="m-0 flex list-disc flex-col gap-1 ps-4 text-[0.8125rem]">
                  {refusals.map((refusal) => (
                    <li key={`${refusal.path}:${refusal.code}`}>{refusalText(refusal)}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </div>
        </FormSummary>
      }
    >
      <FormSection card step={1} title={t("visibility")} description={t("visibilityNote")}>
        <RadioCards
          columns={3}
          aria-label={t("visibility")}
          value={visibility}
          onValueChange={(value) => setVisibility(value as PromotionVisibility)}
          options={(["hidden", "unlisted", "public"] as const).map((value) => ({
            value,
            label: t(`visibilities.${value}`),
            description: t(`visibilityHints.${value}`),
            disabled: !editable,
          }))}
        />
        <Field
          label={t("fields.slug")}
          hint={t("fields.slugHint")}
          error={slugTaken ? t("refusals.slugTaken") : undefined}
        >
          <Input
            value={display.slug}
            disabled={!editable}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setSlugTaken(false);
              set({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
            }}
          />
        </Field>
        <Switch
          label={t("fields.featured")}
          description={t("fields.featuredHint")}
          checked={display.featured}
          disabled={!editable}
          onCheckedChange={(featured) => set({ featured })}
        />
      </FormSection>

      <FormSection card step={2} title={t("ticket")} description={t("ticketNote")}>
        <div className="grid gap-4 md:grid-cols-2">{pair("headline")}</div>
        <div className="grid gap-4 md:grid-cols-2">{pair("subline")}</div>
        <Switch
          label={t("fields.badge")}
          description={t("fields.badgeHint")}
          checked={display.badge !== null}
          disabled={!editable}
          onCheckedChange={(on) => set({ badge: on ? { th: t("badgeDefault.th"), en: t("badgeDefault.en") } : null })}
        />
      </FormSection>

      <FormSection card step={3} title={t("terms")} description={t("termsNote")}>
        <div className="grid gap-4 md:grid-cols-2">{pair("terms", true)}</div>
      </FormSection>

      <FormSection card step={4} title={t("hero")} description={t("heroNote")}>
        <div className="flex flex-wrap items-center gap-4">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- an API-origin preview of the uploaded file
            <img
              src={heroUrl}
              alt=""
              width={160}
              height={90}
              className="rounded-control border-border h-[90px] w-40 border object-cover"
            />
          ) : (
            <span className="text-muted text-sm">{t("heroNone")}</span>
          )}
          {editable ? (
            <FilePickButton
              label={heroUrl ? t("heroReplace") : t("heroUpload")}
              accept="image/png,image/jpeg,image/webp"
              loading={uploading}
              onFiles={(files) => files[0] && void upload(files[0])}
            />
          ) : null}
        </div>
      </FormSection>
    </FormColumns>
  );
}
