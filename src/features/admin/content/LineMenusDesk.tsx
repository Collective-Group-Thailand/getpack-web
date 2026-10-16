"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, FormDialog, FormError, QueryError, useCan } from "../console";
import { RICH_MENU_KEY } from "./codes";

type Menu = Schemas["RichMenuDto"];
type Audience = Schemas["RichMenuAudience"];

/**
 * The LINE official account's rich menus (D-151): the menu shown to a guest and to a member who
 * has linked their account, each the id of a menu made in LINE's own manager. getpack switches
 * between them as people link; this is where the ids are kept.
 */
export function LineMenusDesk() {
  const t = useTranslations("content.line");
  const queryClient = useQueryClient();
  const canManage = useCan("line.manage");
  const [draft, setDraft] = useState<(Menu & { isNew: boolean }) | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "rich_menu", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/line/rich-menus")).data!,
  });
  const columns: DataTableColumn<Menu>[] = [
    { id: "key", header: t("key"), cell: (row) => <span className="font-mono text-sm">{row.key}</span> },
    { id: "audience", header: t("audience"), cell: (row) => t(`audiences.${row.audience}`) },
    {
      id: "provider",
      header: t("providerMenuId"),
      cell: (row) => <span className="font-mono text-xs">{row.providerMenuId}</span>,
    },
    {
      id: "active",
      header: t("active"),
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"} size="sm">
          {row.active ? t("on") : t("off")}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "edit",
            header: t("actions"),
            cell: (row: Menu) => (
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...row, isNew: false })}>
                {t("edit")}
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("intro")}</p>
      {canManage ? (
        <div>
          <Button
            iconStart="plus"
            onClick={() => setDraft({ key: "", audience: "guest", providerMenuId: "", active: true, isNew: true })}
          >
            {t("create")}
          </Button>
        </div>
      ) : null}
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={query.data ?? []}
          getRowId={(row) => row.key}
          loading={query.isPending}
          empty={<EmptyState icon="chat" title={t("empty")} />}
        />
      )}
      {draft ? (
        <FormDialog
          title={draft.isNew ? t("create") : t("editTitle", { key: draft.key })}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            if (!RICH_MENU_KEY.test(draft.key) || !draft.providerMenuId.trim()) throw new FormError(t("incomplete"));
            await adminBrowserApis().contract.PUT("/v1/admin/line/rich-menus/{key}", {
              params: { path: { key: draft.key } },
              body: { audience: draft.audience, providerMenuId: draft.providerMenuId.trim(), active: draft.active },
            });
            toast.success(t("saved"));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "rich_menu") });
          }}
        >
          <Field label={t("key")} hint={t("keyHint")} required>
            <Input
              value={draft.key}
              className="font-mono"
              disabled={!draft.isNew}
              onChange={(e) => setDraft({ ...draft, key: e.target.value.trim().toLowerCase() })}
            />
          </Field>
          <Field label={t("audience")} required>
            <SearchableSelect
              value={draft.audience}
              onValueChange={(value) => setDraft({ ...draft, audience: value as Audience })}
              options={(["guest", "member"] as const).map((a) => ({ value: a, label: t(`audiences.${a}`) }))}
            />
          </Field>
          <Field label={t("providerMenuId")} hint={t("providerHint")} required>
            <Input
              value={draft.providerMenuId}
              className="font-mono"
              onChange={(e) => setDraft({ ...draft, providerMenuId: e.target.value })}
            />
          </Field>
          <Switch
            label={t("active")}
            checked={draft.active}
            onCheckedChange={(active) => setDraft({ ...draft, active })}
          />
        </FormDialog>
      ) : null}
    </div>
  );
}
