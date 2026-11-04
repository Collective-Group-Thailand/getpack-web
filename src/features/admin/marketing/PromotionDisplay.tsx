"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DealCard } from "@/features/shared/deals/DealCard";
import { uploadFile } from "@/features/shared/files/upload";
import type { PromotionDisplay as Display, PromotionVisibility } from "@/lib/api/requests/admin-promotions";
import { browserRequests } from "@/lib/api/requests/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
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
import { canPublish, previewDeal, publicFieldsOf, publishChecks, type PublishCheck } from "./promotion-display";

type Localized = { th: string; en: string };

/**
 * The promotion editor's "การแสดงผล" tab (loyalty P1.5, API-CHANGES-P15 Admin): who sees the promotion on the deals
 * surface (hidden by default, unlisted for a link only, public), the ticket's words in Thai and English, the slug,
 * "ดีลเด่น" and a hero image — with the storefront's own DealCard as the preview. Publishing waits until the API's
 * guard holds (active, slug, Thai headline and terms, no blocked words); the panel lists each condition.
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
  const set = (patch: Partial<Display>) => setDisplay((current) => ({ ...current, ...patch }));
  const setText = (key: "headline" | "subline" | "terms", lang: keyof Localized, value: string) =>
    set({ [key]: { ...display[key], [lang]: value } } as Partial<Display>);
  const checks = publishChecks(item.status, display);
  const publishable = canPublish(checks);
  const blocked = visibility === "public" && !publishable;
  const deal = previewDeal(item, display, locale);

  const save = async () => {
    setSaving(true);
    try {
      const { response } = await adminBrowserApis().contract.GET("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id } },
      });
      const etag = response.headers.get("ETag");
      const body = { visibility, display: { ...display, slug: display.slug.trim() } };
      // CONTRACT-REQUEST admin.promotions.display — the published PATCH takes these fields from P1.5 on.
      const { data } = await adminBrowserApis().contract.PATCH("/v1/admin/promotions/{promotionId}", {
        params: { path: { promotionId: item.id }, header: { "If-Match": etag ?? "" } },
        body: body as unknown as Schemas["UpdatePromotionDto"],
      });
      queryClient.setQueryData(queryKeys.detail("admin", "promotion", item.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "promotion") });
      toast.success(visibility === "public" ? t("published") : t("saved"));
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFile("admin", file, "image");
      const result = await browserRequests().call("POST /v1/admin/promotions/{promotionId}/hero-image", {
        path: { promotionId: item.id },
        body: { fileId: uploaded.id },
      });
      set({ heroImageKey: result.heroImageKey });
      setHeroUrl(result.heroImageUrl);
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
      iconStart={visibility === "public" ? "megaphone" : "save"}
      loading={saving}
      disabled={blocked}
      aria-describedby="display-checks"
      onClick={() => void save()}
    >
      {visibility === "public" ? t("publish") : t("save")}
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
        <Field label={t("fields.slug")} hint={t("fields.slugHint")}>
          <Input
            value={display.slug}
            disabled={!editable}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => set({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
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
