"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LAYOUT_SCHEMA_VERSION, readLayout, type TemplateLayout } from "@/features/designer/templates/layout";
import { TEMPLATE_LIBRARY } from "@/features/designer/templates/library";
import { When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { Dialog } from "@/ui/components/Dialog";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

import { FileField } from "../catalogue/FileField";
import { adminBrowserApis, FormDialog, FormError, problemMessage, QueryError, useCan } from "../console";
import { STUDIO_CODE } from "./codes";
import { useStyleFamilies } from "./families";
import { LayoutMap } from "./LayoutMap";

type Template = Schemas["AdminStudioTemplateDto"];
type Status = Schemas["StudioCatalogStatus"];
type UseCase = Schemas["StudioUseCase"];

export const STUDIO_USE_CASES = [
  "coffee",
  "cosmetics",
  "snacks",
  "e_commerce",
  "gift",
  "electronics",
  "pharmacy",
] as const satisfies readonly UseCase[];
const STATUSES = ["draft", "pending_approval", "published", "retired"] as const satisfies readonly Status[];
const TONE: Record<Status, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  pending_approval: "warning",
  published: "success",
  retired: "neutral",
};

interface Draft {
  id: string | null;
  code: string;
  nameTh: string;
  nameEn: string;
  useCases: UseCase[];
  styleFamilies: string[];
  layout: string;
  thumbnailFileId: string;
}

const empty: Draft = {
  id: null,
  code: "",
  nameTh: "",
  nameEn: "",
  useCases: [],
  styleFamilies: [],
  layout: "",
  thumbnailFileId: "",
};

/** The layout a draft holds, or `null` when it is not a layout the studio can re-flow. */
function parseLayout(text: string): TemplateLayout | null {
  try {
    return readLayout(LAYOUT_SCHEMA_VERSION, JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/**
 * Packio's studio templates (U4.4, D-216, D-282): constraint layouts that re-flow onto any box.
 * Drafted here — from the built-in set or as layout JSON (the format `layout.ts` defines), with a
 * map of where each slot goes — then submitted, approved by someone else with the approval
 * permission (or returned), published to the studio, and retired when no longer wanted.
 */
export function StudioTemplatesDesk() {
  const t = useTranslations("content.templates");
  const tStyles = useTranslations("styles");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("studio_catalog.manage");
  const canApprove = useCan("studio_catalog.approve");
  const [status, setStatus] = useState<Status | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const families = useStyleFamilies();
  const key = queryKeys.list("admin", "studio_template", { status });
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/studio-templates", {
          params: { query: status === "all" ? {} : { status } },
        })
      ).data!,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "studio_template") });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "submit" | "approve" | "return" | "retire" }) => {
      const path = { params: { path: { templateId: id } } };
      const api = adminBrowserApis().contract;
      if (action === "submit") return api.POST("/v1/admin/studio-templates/{templateId}/actions/submit", path);
      if (action === "approve") return api.POST("/v1/admin/studio-templates/{templateId}/actions/approve", path);
      if (action === "return") return api.POST("/v1/admin/studio-templates/{templateId}/actions/return", path);
      return api.POST("/v1/admin/studio-templates/{templateId}/actions/retire", path);
    },
    onSuccess: (_, { action }) => {
      toast.success(t(`done.${action}`));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const existing = new Set((query.data ?? []).map((row) => row.code));
  const library = TEMPLATE_LIBRARY.filter((tpl) => !existing.has(tpl.code));
  const name = (row: { nameTh: string; nameEn: string }) => (locale === "en" ? row.nameEn : row.nameTh);
  const edit = (row: Template) =>
    setDraft({
      id: row.id,
      code: row.code,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      useCases: [...row.useCases],
      styleFamilies: row.styleFamilies,
      layout: JSON.stringify(row.layout, null, 2),
      thumbnailFileId: row.thumbnailFileId ?? "",
    });

  const columns: DataTableColumn<Template>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            className="text-primary text-start font-medium hover:underline"
            onClick={() => setPreview(row)}
          >
            {name(row)}
          </button>
          <p className="text-muted font-mono text-xs">{row.code}</p>
        </div>
      ),
    },
    {
      id: "useCases",
      header: t("useCases"),
      cell: (row) => row.useCases.map((u) => t(`useCaseNames.${u}`)).join(", "),
    },
    {
      id: "families",
      header: t("families"),
      cell: (row) =>
        row.styleFamilies.map((f) => (tStyles.has(`families.${f}`) ? tStyles(`families.${f}`) : f)).join(", "),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <Badge tone={TONE[row.status]} size="sm">
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: "approved",
      header: t("approvedAt"),
      hideable: true,
      cell: (row) => <When at={row.approvedAt} />,
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {canManage && (row.status === "draft" || row.status === "pending_approval") ? (
            <Button size="sm" variant="ghost" onClick={() => edit(row)}>
              {t("edit")}
            </Button>
          ) : null}
          {canManage && row.status === "draft" ? (
            <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: row.id, action: "submit" })}>
              {t("submit")}
            </Button>
          ) : null}
          {canApprove && row.status === "pending_approval" ? (
            <>
              <Button size="sm" onClick={() => act.mutate({ id: row.id, action: "approve" })}>
                {t("approve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: row.id, action: "return" })}>
                {t("return")}
              </Button>
            </>
          ) : null}
          {canManage && row.status === "published" ? (
            <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: row.id, action: "retire" })}>
              {t("retire")}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const layout = draft ? parseLayout(draft.layout) : null;
  const shownLayout = preview ? readLayout(preview.layoutSchemaVersion, preview.layout) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl
          label={t("status")}
          value={status}
          onValueChange={(value) => setStatus(value as Status | "all")}
          options={[
            { value: "all", label: t("all") },
            ...STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          ]}
        />
        {canManage ? (
          <Button iconStart="plus" onClick={() => setDraft({ ...empty })}>
            {t("create")}
          </Button>
        ) : null}
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="layers" title={t("empty")} description={t("emptyHint")} />}
        />
      )}

      {draft ? (
        <FormDialog
          title={draft.id ? t("editTitle", { code: draft.code }) : t("create")}
          description={t("formIntro")}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!draft.code.trim() || !draft.nameTh.trim() || !draft.nameEn.trim())
              throw new FormError(t("incomplete"));
            if (!STUDIO_CODE.test(draft.code.trim())) throw new FormError(t("codeInvalid"));
            if (!layout) throw new FormError(t("layoutInvalid"));
            if (draft.useCases.length === 0) throw new FormError(t("useCaseRequired"));
            const body: Schemas["StudioTemplateInputDto"] = {
              code: draft.code.trim(),
              nameTh: draft.nameTh.trim(),
              nameEn: draft.nameEn.trim(),
              useCases: draft.useCases,
              styleFamilies: draft.styleFamilies,
              layoutSchemaVersion: LAYOUT_SCHEMA_VERSION,
              layout: layout as unknown as Record<string, unknown>,
              thumbnailFileId: draft.thumbnailFileId || null,
            };
            const api = adminBrowserApis().contract;
            if (draft.id)
              await api.PUT("/v1/admin/studio-templates/{templateId}", {
                params: { path: { templateId: draft.id } },
                body,
              });
            else await api.POST("/v1/admin/studio-templates", { body });
            toast.success(t("saved"));
            refresh();
          }}
        >
          {!draft.id && library.length ? (
            <Field label={t("fromLibrary")} hint={t("fromLibraryHint")}>
              <Select
                placeholder={t("chooseLibrary")}
                onValueChange={(code) => {
                  const tpl = TEMPLATE_LIBRARY.find((x) => x.code === code);
                  if (tpl)
                    setDraft({
                      ...empty,
                      // Library codes are written upper-case; the catalogue keeps codes lower-case.
                      code: tpl.code.toLowerCase(),
                      nameTh: tpl.nameTh,
                      nameEn: tpl.nameEn,
                      useCases: tpl.useCases as UseCase[],
                      styleFamilies: tpl.styleFamilies.filter((f) => !families.data || families.data.includes(f)),
                      layout: JSON.stringify(tpl.layout, null, 2),
                    });
                }}
                options={library.map((tpl) => ({ value: tpl.code, label: `${name(tpl)} (${tpl.code})` }))}
              />
            </Field>
          ) : null}
          <Field label={t("code")} hint={t("codeHint")} required>
            <Input
              value={draft.code}
              className="font-mono"
              disabled={Boolean(draft.id)}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("nameTh")} required>
              <Input value={draft.nameTh} onChange={(e) => setDraft({ ...draft, nameTh: e.target.value })} />
            </Field>
            <Field label={t("nameEn")} required>
              <Input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("useCases")}</legend>
            <div className="grid gap-2 sm:grid-cols-4">
              {STUDIO_USE_CASES.map((u) => (
                <Checkbox
                  key={u}
                  label={t(`useCaseNames.${u}`)}
                  checked={draft.useCases.includes(u)}
                  onCheckedChange={(checked) =>
                    setDraft({
                      ...draft,
                      useCases: checked ? [...draft.useCases, u] : draft.useCases.filter((x) => x !== u),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("families")}</legend>
            <p className="text-muted text-xs">{t("familiesHint")}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {(families.data ?? draft.styleFamilies).map((family) => (
                <Checkbox
                  key={family}
                  label={tStyles.has(`families.${family}`) ? tStyles(`families.${family}`) : family}
                  checked={draft.styleFamilies.includes(family)}
                  onCheckedChange={(checked) =>
                    setDraft({
                      ...draft,
                      styleFamilies: checked
                        ? [...draft.styleFamilies, family]
                        : draft.styleFamilies.filter((x) => x !== family),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          <Field
            label={t("layout")}
            hint={t("layoutHint")}
            required
            error={draft.layout && !layout ? t("layoutInvalid") : undefined}
          >
            <Textarea
              rows={10}
              className="font-mono text-xs"
              value={draft.layout}
              onChange={(e) => setDraft({ ...draft, layout: e.target.value })}
            />
          </Field>
          {layout ? <LayoutMap layout={layout} label={t("mapLabel")} /> : null}
          <Field label={t("thumbnail")}>
            <FileField
              value={draft.thumbnailFileId}
              onChange={(value) => setDraft({ ...draft, thumbnailFileId: String(value ?? "") })}
            />
          </Field>
        </FormDialog>
      ) : null}

      {preview ? (
        <Dialog
          open
          onOpenChange={(open) => (open ? undefined : setPreview(null))}
          title={name(preview)}
          description={`${preview.code} · ${t(`statuses.${preview.status}`)}`}
          closeLabel={t("close")}
        >
          {shownLayout ? (
            <LayoutMap layout={shownLayout} label={t("mapLabel")} />
          ) : (
            <p className="text-muted text-sm">{t("layoutUnreadable")}</p>
          )}
          <p className="text-muted text-sm">
            {t("createdBy", { name: preview.createdBy.displayName })}
            {preview.approvedBy ? ` · ${t("approvedBy", { name: preview.approvedBy.displayName })}` : ""}
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
