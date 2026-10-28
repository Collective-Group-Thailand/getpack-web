"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, QueryError, Section, useActor, useCan } from "../console";
import {
  CODE,
  formOf,
  MAX_STYLES,
  move,
  valueOf,
  type StudioFeaturedForm,
  type StudioFeaturedValue,
} from "./studio-featured-form";

const KEY = "studio.featured_styles";

/**
 * C7 (DECISIONS-STAGE-A §2, D-455): the Studio's "แบบที่คนเริ่มบ่อย" — admins pick the styles in order and turn each
 * on or off; the threshold of Studio designs (within a window of days) after which the storefront ranks by real
 * usage instead. Saved as a new effective-dated, audited version of the setting `studio.featured_styles` (its owner
 * role, or Superadmin), with a reason, through the settings API. The storefront shows the first 6 published ones.
 */
export function StudioFeaturedEditor() {
  const t = useTranslations("styleLibrary.studioFeatured");
  const actor = useActor();
  const canChange = useCan("settings.change");
  const client = useQueryClient();
  const [draft, setDraft] = useState<StudioFeaturedForm | null>(null);
  const [adding, setAdding] = useState("");
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "setting", KEY),
    queryFn: async () => {
      const list = (await adminBrowserApis().contract.GET("/v1/admin/settings")).data!;
      const row = list.find((setting) => setting.key === KEY);
      if (!row) return null;
      return (
        await adminBrowserApis().contract.GET("/v1/admin/settings/{settingId}", {
          params: { path: { settingId: row.id } },
        })
      ).data!;
    },
  });
  const setting = query.data ?? null;
  const form = draft ?? formOf((setting?.current?.value ?? null) as StudioFeaturedValue | null);
  const parsed = valueOf(form);
  const owner = setting ? actor.roles.includes(setting.ownerRole) || actor.roles.includes("superadmin") : false;
  const editable = canChange && owner && !!setting && !setting.pending;

  const save = useMutation({
    mutationFn: async (value: StudioFeaturedValue) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/settings/{settingId}/versions", {
          params: { path: { settingId: setting!.id } },
          body: { value: value as never, reason: reason.trim(), effectiveFrom: new Date().toISOString() },
        })
      ).data!,
    onSuccess: () => {
      toast.success(t("saved"));
      setDraft(null);
      setReason("");
      void client.invalidateQueries({ queryKey: queryKeys.detail("admin", "setting", KEY) });
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return null;
  if (!setting) return <Callout tone="warning" title={t("missing")} />;

  const edit = (next: Partial<StudioFeaturedForm>) => setDraft({ ...form, ...next });
  const code = adding.trim().toUpperCase();
  const addable = CODE.test(code) && !form.styles.some((s) => s.code === code) && form.styles.length < MAX_STYLES;

  return (
    <div className="flex flex-col gap-5">
      <Callout tone="info" title={t("rule")} />
      {setting.pending ? <Callout tone="warning" title={t("pending")} /> : null}
      <Section title={t("list.title")} description={t("list.description")}>
        {form.styles.length === 0 ? (
          <p className="text-muted text-sm">{t("list.empty")}</p>
        ) : (
          <ol className="divide-border border-border rounded-card divide-y border">
            {form.styles.map((style, index) => (
              <li key={style.code} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="text-muted w-6 text-end text-sm tabular-nums">{index + 1}</span>
                <span className="min-w-28 font-medium tabular-nums">{style.code}</span>
                <Checkbox
                  label={t("list.on")}
                  checked={style.enabled}
                  disabled={!editable}
                  onCheckedChange={(on) =>
                    edit({ styles: form.styles.map((s, i) => (i === index ? { ...s, enabled: on === true } : s)) })
                  }
                />
                <span className="ms-auto flex gap-1">
                  <IconButton
                    name="chevron-up"
                    label={t("list.up", { code: style.code })}
                    variant="ghost"
                    disabled={!editable || index === 0}
                    onClick={() => edit({ styles: move(form.styles, index, -1) })}
                  />
                  <IconButton
                    name="chevron-down"
                    label={t("list.down", { code: style.code })}
                    variant="ghost"
                    disabled={!editable || index === form.styles.length - 1}
                    onClick={() => edit({ styles: move(form.styles, index, 1) })}
                  />
                  <IconButton
                    name="trash"
                    label={t("list.remove", { code: style.code })}
                    variant="ghost"
                    disabled={!editable}
                    onClick={() => edit({ styles: form.styles.filter((_, i) => i !== index) })}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
        {editable ? (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!addable) return;
              edit({ styles: [...form.styles, { code, enabled: true }] });
              setAdding("");
            }}
          >
            <Field label={t("list.add")} hint={t("list.addHint", { max: MAX_STYLES })} className="min-w-60">
              <Input
                value={adding}
                onChange={(event) => setAdding(event.target.value)}
                placeholder={t("list.placeholder")}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={!addable}>
              {t("list.addButton")}
            </Button>
          </form>
        ) : null}
      </Section>

      <Section title={t("usage.title")} description={t("usage.description")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("usage.minDesigns")}
            hint={t("usage.minDesignsHint")}
            error={!parsed.ok && parsed.error === "minDesigns" ? t("errors.minDesigns") : undefined}
          >
            <Input
              inputMode="numeric"
              value={form.minDesigns}
              disabled={!editable}
              onChange={(event) => edit({ minDesigns: event.target.value })}
            />
          </Field>
          <Field
            label={t("usage.windowDays")}
            hint={t("usage.windowDaysHint")}
            error={!parsed.ok && parsed.error === "windowDays" ? t("errors.windowDays") : undefined}
          >
            <Input
              inputMode="numeric"
              value={form.windowDays}
              disabled={!editable}
              onChange={(event) => edit({ windowDays: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      {editable ? (
        <Section title={t("save.title")}>
          <Field label={t("save.reason")} hint={t("save.reasonHint")}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
          </Field>
          {!parsed.ok && (parsed.error === "code" || parsed.error === "duplicate" || parsed.error === "tooMany") ? (
            <p className="text-danger mt-2 text-sm">{t(`errors.${parsed.error}`)}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              loading={save.isPending}
              disabled={!parsed.ok || reason.trim().length < 3 || draft === null}
              onClick={() => (parsed.ok ? save.mutate(parsed.value) : undefined)}
            >
              {t("save.button")}
            </Button>
            {draft ? (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t("save.reset")}
              </Button>
            ) : null}
          </div>
        </Section>
      ) : (
        <p className="text-muted text-sm">{t("readOnly")}</p>
      )}
    </div>
  );
}
