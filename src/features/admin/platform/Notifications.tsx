"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Sheet } from "@/ui/components/Sheet";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, problemMessage, QueryError } from "../console";

type Template = Schemas["NotificationTemplateDto"];
type Version = Schemas["TemplateVersionDto"];
type Route = Schemas["NotificationRouteDto"];
type Locale = Schemas["LocaleCode"];

const LOCALES: Locale[] = ["th", "en"];

/**
 * Notification templates (D-143): Handlebars (MJML for e-mail) per locale, versioned. A draft is
 * previewed with a sample payload, test-sent to yourself, and published — publishing retires the
 * locale's previous version, so what customers receive is always exactly one known version.
 */
export function NotificationTemplates({ initial }: { initial: Template[] | null }) {
  const t = useTranslations("platform.templates");
  const [open, setOpen] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: queryKeys.list("admin", "notification_template"),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/notification-templates")).data!,
    initialData: initial ?? undefined,
  });

  if (templates.isError) return <QueryError error={templates.error} onRetry={() => void templates.refetch()} />;
  const list = templates.data ?? [];
  const selected = list.find((template) => template.id === open) ?? null;

  const columns: DataTableColumn<Template>[] = [
    {
      id: "key",
      header: t("columns.key"),
      cell: (row) => (
        <button
          type="button"
          className="text-primary font-mono text-xs font-medium hover:underline"
          onClick={() => setOpen(row.id)}
        >
          {row.key}
        </button>
      ),
    },
    { id: "description", header: t("columns.description"), cell: (row) => row.description },
    { id: "channel", header: t("columns.channel"), cell: (row) => t(`channels.${row.channel}`) },
    { id: "category", header: t("columns.category"), cell: (row) => t(`categories.${row.category}`) },
    {
      id: "versions",
      header: t("columns.published"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {LOCALES.map((locale) => {
            const published = row.versions.find(
              (version) => version.locale === locale && version.status === "published",
            );
            const drafts = row.versions.filter(
              (version) => version.locale === locale && version.status === "draft",
            ).length;
            return (
              <Badge key={locale} size="sm" tone={published ? "success" : "warning"}>
                {published
                  ? t("publishedAs", { locale: locale.toUpperCase(), version: published.versionNo })
                  : t("notPublished", { locale: locale.toUpperCase() })}
                {drafts > 0 ? ` · ${t("drafts", { count: drafts })}` : null}
              </Badge>
            );
          })}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={list}
        getRowId={(row) => row.id}
        loading={templates.isPending}
        empty={<EmptyState icon="mail" title={t("empty")} />}
      />
      {selected ? <TemplateSheet template={selected} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function TemplateSheet({ template, onClose }: { template: Template; onClose: () => void }) {
  const t = useTranslations("platform.templates");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<Locale>("th");
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [payload, setPayload] = useState('{\n  "orderCode": "PK-2569-00042"\n}');
  const [publishing, setPublishing] = useState<Version | null>(null);
  const [drafting, setDrafting] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.list("admin", "notification_template") });

  const versions = template.versions
    .filter((version) => version.locale === locale)
    .sort((a, b) => b.versionNo - a.versionNo);
  const chosen = versions.find((version) => version.versionNo === versionNo) ?? versions[0];

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const body = (): Schemas["PreviewTemplateDto"] => ({
    locale,
    payload: parsed ?? {},
    ...(chosen ? { versionNo: chosen.versionNo } : {}),
  });

  const preview = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/notification-templates/{templateId}/actions/preview", {
          params: { path: { templateId: template.id } },
          body: body(),
        })
      ).data!,
    onError: (error) => toast.error(problemMessage(error, t("previewFailed"))),
  });

  const testSend = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/notification-templates/{templateId}/actions/test-send", {
          params: { path: { templateId: template.id } },
          body: body(),
        })
      ).data!,
    onSuccess: (result) => toast.success(result.sentTo ? t("testSentTo", { to: result.sentTo }) : t("testSent")),
    onError: (error) => toast.error(problemMessage(error, t("testFailed"))),
  });

  return (
    <Sheet
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={template.key}
      description={template.description}
      closeLabel={tCommon("actions.close")}
      className="w-[min(46rem,calc(100vw-2rem))]"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("locale")}>
            <Select
              value={locale}
              onValueChange={(next) => {
                setLocale(next);
                setVersionNo(null);
                preview.reset();
              }}
              options={LOCALES.map((value) => ({ value, label: value.toUpperCase() }))}
              className="w-24"
            />
          </Field>
          <Field label={t("version")}>
            <Select
              value={chosen ? String(chosen.versionNo) : undefined}
              onValueChange={(next) => {
                setVersionNo(Number(next));
                preview.reset();
              }}
              options={versions.map((version) => ({
                value: String(version.versionNo),
                label: t("versionOption", { no: version.versionNo, status: t(`statuses.${version.status}`) }),
              }))}
              className="w-56"
            />
          </Field>
          <Button variant="secondary" size="sm" iconStart="plus" onClick={() => setDrafting(true)}>
            {t("newDraft")}
          </Button>
          {chosen?.status === "draft" ? (
            <Button size="sm" iconStart="send" onClick={() => setPublishing(chosen)}>
              {t("publish")}
            </Button>
          ) : null}
        </div>

        {chosen ? (
          <Card padding="md" className="space-y-2">
            {chosen.subject ? <p className="text-sm font-medium">{chosen.subject}</p> : null}
            <pre className="bg-surface-subtle max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
              {chosen.body}
            </pre>
            <p className="text-muted text-xs">
              {chosen.publishedAt ? <When at={chosen.publishedAt} /> : t(`statuses.${chosen.status}`)}
            </p>
          </Card>
        ) : (
          <Callout tone="warning" title={t("noVersion")} />
        )}

        <Field label={t("samplePayload")} hint={t("samplePayloadHint")} error={parsed ? undefined : t("invalidJson")}>
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            iconStart="eye"
            disabled={!parsed || !chosen}
            loading={preview.isPending}
            onClick={() => preview.mutate()}
          >
            {t("preview")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconStart="send"
            disabled={!parsed || !chosen}
            loading={testSend.isPending}
            onClick={() => testSend.mutate()}
          >
            {t("testSend")}
          </Button>
        </div>
        {preview.data ? (
          <Card padding="md" className="space-y-2" aria-live="polite">
            <p className="text-muted text-xs font-medium">{t("rendered")}</p>
            {preview.data.subject ? <p className="text-sm font-medium">{preview.data.subject}</p> : null}
            {template.channel === "email" ? (
              // Sandboxed with no permissions: rendered e-mail HTML is shown, never run.
              <iframe
                title={t("rendered")}
                sandbox=""
                srcDoc={preview.data.body}
                className="border-border h-80 w-full rounded-md border bg-white"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{preview.data.body}</p>
            )}
          </Card>
        ) : null}
      </div>

      <ConfirmAction
        open={publishing !== null}
        onOpenChange={(next) => (next ? undefined : setPublishing(null))}
        title={t("publishTitle", { key: template.key, locale: locale.toUpperCase(), no: publishing?.versionNo ?? 0 })}
        description={t("publishBody")}
        confirmLabel={t("publish")}
        onConfirm={async () => {
          try {
            await adminBrowserApis().contract.POST(
              "/v1/admin/notification-templates/{templateId}/versions/{locale}/{versionNo}/actions/publish",
              {
                params: { path: { templateId: template.id, locale, versionNo: publishing!.versionNo } },
              },
            );
            toast.success(t("published"));
            await refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("publishFailed")));
            throw error;
          }
        }}
      />

      {drafting ? (
        <NewDraft template={template} locale={locale} onClose={() => setDrafting(false)} onCreated={refresh} />
      ) : null}
    </Sheet>
  );
}

function NewDraft({
  template,
  locale,
  onClose,
  onCreated,
}: {
  template: Template;
  locale: Locale;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}) {
  const t = useTranslations("platform.templates");
  const tCommon = useTranslations("common");
  const latest = template.versions
    .filter((version) => version.locale === locale)
    .sort((a, b) => b.versionNo - a.versionNo)[0];
  const [subject, setSubject] = useState(latest?.subject ?? "");
  const [body, setBody] = useState(latest?.body ?? "");

  const create = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/notification-templates/{templateId}/versions", {
          params: { path: { templateId: template.id } },
          body: { locale, body, ...(template.channel === "email" ? { subject } : {}) },
        })
      ).data,
    onSuccess: async () => {
      toast.success(t("draftCreated"));
      await onCreated();
      onClose();
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      size="lg"
      title={t("newDraftTitle", { locale: locale.toUpperCase() })}
      description={t("newDraftDescription")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!body.trim() || (template.channel === "email" && !subject.trim())}
          >
            {t("saveDraft")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error ? <Callout tone="danger" title={problemMessage(create.error, t("draftFailed"))} /> : null}
        {template.channel === "email" ? (
          <Field label={t("subject")} required requiredLabel={tCommon("state.required")}>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
        ) : null}
        <Field label={t("body")} hint={t("bodyHint")} required requiredLabel={tCommon("state.required")}>
          <Textarea
            rows={12}
            className="font-mono text-xs"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * The routing matrix (D-143, D-144): which event reaches whom, on which channel, with which
 * template. SMS only for critical events; marketing routes wait for consent and the 09:00–20:00
 * window — both enforced by the API, shown here so nobody is surprised by it.
 */
export function NotificationRoutes({ initial }: { initial: Route[] | null }) {
  const t = useTranslations("platform.routes");
  const tTemplates = useTranslations("platform.templates");
  const queryClient = useQueryClient();
  const key = queryKeys.list("admin", "notification_route");

  const routes = useQuery({
    queryKey: key,
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/notification-routes")).data!,
    initialData: initial ?? undefined,
  });

  const toggle = useMutation({
    mutationFn: async ({ routeId, enabled }: { routeId: string; enabled: boolean }) =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/notification-routes/{routeId}/actions/set-enabled", {
          params: { path: { routeId } },
          body: { enabled },
        })
      ).data,
    // Reversible, so optimistic (F2 §4): the switch moves at once and snaps back on failure.
    onMutate: async ({ routeId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Route[]>(key);
      queryClient.setQueryData<Route[]>(key, (current) =>
        current?.map((route) => (route.id === routeId ? { ...route, enabled } : route)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(problemMessage(error, t("toggleFailed")));
    },
    onSuccess: (_route, { enabled }) => toast.success(enabled ? t("enabled") : t("disabled")),
  });

  if (routes.isError) return <QueryError error={routes.error} onRetry={() => void routes.refetch()} />;

  const columns: DataTableColumn<Route>[] = [
    {
      id: "eventType",
      header: t("columns.event"),
      cell: (row) => <span className="font-mono text-xs">{row.eventType}</span>,
    },
    {
      id: "audience",
      header: t("columns.audience"),
      cell: (row) => `${t(`audiences.${row.audience}`)}${row.staffTeam ? ` · ${row.staffTeam}` : ""}`,
    },
    { id: "channel", header: t("columns.channel"), cell: (row) => tTemplates(`channels.${row.channel}`) },
    {
      id: "template",
      header: t("columns.template"),
      cell: (row) => <span className="font-mono text-xs">{row.template}</span>,
    },
    {
      id: "flags",
      header: t("columns.flags"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.isCritical ? (
            <Badge size="sm" tone="danger" icon="warning">
              {t("critical")}
            </Badge>
          ) : null}
          {row.isMarketing ? (
            <Badge size="sm" tone="info" icon="megaphone">
              {t("marketing")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "enabled",
      header: t("columns.enabled"),
      cell: (row) => (
        <Switch
          label={
            <span className="sr-only">
              {t("toggle", { event: row.eventType, channel: tTemplates(`channels.${row.channel}`) })}
            </span>
          }
          checked={row.enabled}
          onCheckedChange={(enabled) => toggle.mutate({ routeId: row.id, enabled })}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Callout tone="info" title={t("rulesTitle")}>
        {t("rulesBody")}
      </Callout>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={routes.data ?? []}
        getRowId={(row) => row.id}
        loading={routes.isPending}
        density="compact"
        empty={<EmptyState icon="route" title={t("empty")} />}
      />
    </div>
  );
}
