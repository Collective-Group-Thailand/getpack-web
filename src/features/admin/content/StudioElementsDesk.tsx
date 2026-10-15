"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, problemMessage, QueryError, useCan } from "../console";
import { STUDIO_CODE } from "./codes";

type Element = Schemas["StudioElementDto"];
type Kind = Schemas["StudioElementKind"];
type Status = Schemas["StudioCatalogStatus"];

const KINDS = ["shape", "icon", "mark"] as const satisfies readonly Kind[];
const STATUSES = ["draft", "published", "retired"] as const satisfies readonly Status[];

/** An SVG path drawn in a square, scaled to whatever box its numbers span. */
function PathPreview({ d, label }: { d: string; label: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className="bg-bg-subtle size-12 rounded p-1">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/**
 * The studio's own shapes, icons and marks (U4.4): an SVG path each, tagged for search, flagged
 * when using it needs a right (a certification mark). Drafted, published to the studio's element
 * panel, retired when no longer offered.
 */
export function StudioElementsDesk() {
  const t = useTranslations("content.elements");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canManage = useCan("studio_catalog.manage");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [draft, setDraft] = useState<(Schemas["StudioElementInputDto"] & { tagsText: string }) | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "studio_element", { kind, status }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/studio-elements", {
          params: { query: { ...(kind === "all" ? {} : { kind }), ...(status === "all" ? {} : { status }) } },
        })
      ).data!,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "studio_element") });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "retire" }) =>
      action === "publish"
        ? adminBrowserApis().contract.POST("/v1/admin/studio-elements/{elementId}/actions/publish", {
            params: { path: { elementId: id } },
          })
        : adminBrowserApis().contract.POST("/v1/admin/studio-elements/{elementId}/actions/retire", {
            params: { path: { elementId: id } },
          }),
    onSuccess: (_, { action }) => {
      toast.success(t(action === "publish" ? "published" : "retired"));
      refresh();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  const columns: DataTableColumn<Element>[] = [
    { id: "preview", header: t("preview"), cell: (row) => <PathPreview d={row.path} label={row.code} /> },
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <div>
          <p className="font-medium">{locale === "en" ? row.nameEn : row.nameTh}</p>
          <p className="text-muted font-mono text-xs">{row.code}</p>
        </div>
      ),
    },
    { id: "kind", header: t("kind"), cell: (row) => t(`kinds.${row.kind}`) },
    { id: "tags", header: t("tags"), cell: (row) => row.tags.join(", ") },
    {
      id: "right",
      header: t("requiresRight"),
      cell: (row) =>
        row.requiresRight ? (
          <Badge tone="warning" size="sm">
            {t("yes")}
          </Badge>
        ) : null,
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <Badge tone={row.status === "published" ? "success" : "neutral"} size="sm">
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Element) =>
              row.status === "published" ? (
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: row.id, action: "retire" })}>
                  {t("retire")}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: row.id, action: "publish" })}>
                  {t("publish")}
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("kind")} className="min-w-40">
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as Kind | "all")}
            options={[{ value: "all", label: t("all") }, ...KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))]}
          />
        </Field>
        <Field label={t("status")} className="min-w-40">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as Status | "all")}
            options={[
              { value: "all", label: t("all") },
              ...STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
            ]}
          />
        </Field>
        <span className="flex-1" />
        {canManage ? (
          <Button
            iconStart="plus"
            onClick={() =>
              setDraft({
                code: "",
                nameTh: "",
                nameEn: "",
                kind: "shape",
                path: "",
                tags: [],
                requiresRight: false,
                tagsText: "",
              })
            }
          >
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
          empty={<EmptyState icon="pen-tool" title={t("empty")} />}
        />
      )}
      {draft ? (
        <FormDialog
          title={t("create")}
          description={t("formIntro")}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!draft.code.trim() || !draft.nameTh.trim() || !draft.nameEn.trim() || !draft.path.trim())
              throw new FormError(t("incomplete"));
            if (!STUDIO_CODE.test(draft.code.trim())) throw new FormError(t("codeInvalid"));
            const { tagsText, ...body } = draft;
            await adminBrowserApis().contract.POST("/v1/admin/studio-elements", {
              body: {
                ...body,
                code: body.code.trim(),
                path: body.path.trim(),
                tags: tagsText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
            });
            toast.success(t("saved"));
            refresh();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("code")} hint={t("codeHint")} required>
              <Input
                value={draft.code}
                className="font-mono"
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <Field label={t("nameTh")} required>
              <Input value={draft.nameTh} onChange={(e) => setDraft({ ...draft, nameTh: e.target.value })} />
            </Field>
            <Field label={t("nameEn")} required>
              <Input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
            </Field>
          </div>
          <Field label={t("kind")} required>
            <Select
              value={draft.kind}
              onValueChange={(value) => setDraft({ ...draft, kind: value as Kind })}
              options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            />
          </Field>
          <Field label={t("path")} hint={t("pathHint")} required>
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={draft.path}
              onChange={(e) => setDraft({ ...draft, path: e.target.value })}
            />
          </Field>
          {draft.path.trim() ? <PathPreview d={draft.path} label={t("preview")} /> : null}
          <Field label={t("tags")} hint={t("tagsHint")}>
            <Input value={draft.tagsText} onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })} />
          </Field>
          <Switch
            label={t("requiresRight")}
            description={t("requiresRightHint")}
            checked={draft.requiresRight}
            onCheckedChange={(checked) => setDraft({ ...draft, requiresRight: checked })}
          />
        </FormDialog>
      ) : null}
    </div>
  );
}
