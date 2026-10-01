"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import { STALE_TIME } from "@/lib/query/defaults";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { DropdownMenu, type MenuItem } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { useActor } from "./actor";
import { adminBrowserApis } from "./api";
import { problemMessage } from "./QueryError";

/**
 * Saved views (F2 A.3): per-user presets stored server-side, optionally shared, and a link that
 * reproduces the current view for anyone who may open the list.
 *
 * `admin.savedViews.*` (U-B0.3). A view *is* its URL query, so applying one is navigation and the
 * list needs no second notion of state. The API lists my views first, then colleagues' shared ones;
 * only the owner may delete one.
 */
export function SavedViews({
  resource,
  currentQuery,
  columns,
  onApply,
}: {
  resource: string;
  currentQuery: Record<string, string>;
  columns: string[] | null;
  onApply: (query: Record<string, string>) => void;
}) {
  const t = useTranslations("console.views");
  const tCommon = useTranslations("common");
  const actor = useActor();
  const queryClient = useQueryClient();
  const key = queryKeys.list("admin", "saved_view", { resource });
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);

  const views = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/saved-views", {
          params: { query: { resource, perPage: 100 } },
        })
      ).data!,
    staleTime: STALE_TIME.stable,
  });

  const save = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/saved-views", {
          body: { resource, name: name.trim(), query: currentQuery, columns, shared },
        })
      ).data!,
    onSuccess: () => {
      toast.success(t("saved"));
      setSaving(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(problemMessage(error, t("saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: async (viewId: string) => {
      await adminBrowserApis().contract.DELETE("/v1/admin/saved-views/{viewId}", { params: { path: { viewId } } });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(problemMessage(error, t("deleteFailed"))),
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyFailed"));
    }
  }

  const list = views.data?.data ?? [];
  const items: MenuItem[] = [
    ...list.map((view) => ({
      id: view.id,
      label: view.name,
      description: view.shared ? t("sharedBy", { name: view.owner.displayName }) : undefined,
      icon: view.shared ? ("users" as const) : ("eye" as const),
      onSelect: () => onApply(view.query),
    })),
    ...list
      .filter((view) => view.owner.id === actor.id)
      .map((view, index) => ({
        id: `delete-${view.id}`,
        label: t("delete", { name: view.name }),
        icon: "trash" as const,
        tone: "destructive" as const,
        separatorBefore: index === 0,
        onSelect: () => remove.mutate(view.id),
      })),
    { id: "save", label: t("saveCurrent"), icon: "save", separatorBefore: true, onSelect: () => setSaving(true) },
    { id: "link", label: t("copyLink"), icon: "link", onSelect: () => void copyLink() },
  ];

  return (
    <>
      <DropdownMenu
        label={t("label")}
        align="end"
        items={items}
        trigger={
          <Button variant="secondary" size="sm" iconStart="filter">
            {t("label")}
          </Button>
        }
      />
      <Dialog
        open={saving}
        onOpenChange={setSaving}
        title={t("saveTitle")}
        description={t("saveDescription")}
        closeLabel={tCommon("actions.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaving(false)}>
              {tCommon("actions.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
              {tCommon("actions.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("name")} required requiredLabel={tCommon("state.required")}>
            <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Switch label={t("share")} description={t("shareHint")} checked={shared} onCheckedChange={setShared} />
        </div>
      </Dialog>
    </>
  );
}
