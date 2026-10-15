"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Pagination } from "@/ui/components/Pagination";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, FormDialog, FormError, problemMessage, QueryError, useCan } from "../console";
import { CANNED_TAG, tagsFrom } from "./codes";

type Canned = Schemas["CannedResponseDto"];
/** `key` is minted when the dialog opens, so a retried create replays rather than repeats. */
type Draft = { id: string | null; key: string; title: string; bodyTh: string; bodyEn: string; tags: string };

const EMPTY: Omit<Draft, "key"> = { id: null, title: "", bodyTh: "", bodyEn: "", tags: "" };

/**
 * Canned responses for customer service (D-300): the Thai and English texts an agent drops into a
 * reply from the inbox, found by title, text or tag. Those who manage them add, change, archive
 * and restore; archived ones leave the inbox picker but stay here on request.
 */
export function CannedResponsesDesk() {
  const t = useTranslations("content.canned");
  const tList = useTranslations("console.list");
  const queryClient = useQueryClient();
  const canManage = useCan("conversations.manage_canned");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState<Canned | null>(null);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "canned_response", { q, tag, archived, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/canned-responses", {
          params: {
            query: { page, perPage: 25, archived, ...(q.trim() ? { q: q.trim() } : {}), ...(tag ? { tag } : {}) },
          },
        })
      ).data!,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "canned_response") });

  const toggle = async (row: Canned) => {
    const params = { path: { cannedResponseId: row.id } };
    try {
      if (row.archived) {
        await adminBrowserApis().contract.POST("/v1/admin/canned-responses/{cannedResponseId}/actions/restore", {
          params,
        });
      } else {
        await adminBrowserApis().contract.POST("/v1/admin/canned-responses/{cannedResponseId}/actions/archive", {
          params,
        });
      }
      toast.success(t(row.archived ? "restoredToast" : "archivedToast"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
      throw error;
    }
  };

  const columns: DataTableColumn<Canned>[] = [
    {
      id: "title",
      header: t("titleColumn"),
      cell: (row) => (
        <div className="max-w-xl">
          <p className="font-medium">
            {row.title}
            {row.archived ? (
              <Badge size="sm" tone="neutral" className="ms-2">
                {t("archived")}
              </Badge>
            ) : null}
          </p>
          <p className="text-muted line-clamp-2 text-sm">{row.bodyTh}</p>
          <p className="text-muted line-clamp-1 text-xs">{row.bodyEn}</p>
        </div>
      ),
    },
    {
      id: "tags",
      header: t("tags"),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.tags.map((value) => (
            <button
              key={value}
              type="button"
              className="focus-visible:ring-primary rounded-md focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                setTag(value);
                setPage(1);
              }}
            >
              <Badge size="sm" tone="info">
                {value}
              </Badge>
            </button>
          ))}
        </span>
      ),
    },
    {
      id: "updated",
      header: t("updated"),
      cell: (row) => (
        <div className="text-sm">
          <When at={row.updatedAt} />
          <p className="text-muted text-xs">{row.updatedBy.displayName}</p>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t("actions"),
            cell: (row: Canned) => (
              <span className="flex flex-wrap gap-1">
                {!row.archived ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        key: "",
                        title: row.title,
                        bodyTh: row.bodyTh,
                        bodyEn: row.bodyEn,
                        tags: row.tags.join(", "),
                      })
                    }
                  >
                    {t("edit")}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setConfirming(row)}>
                  {t(row.archived ? "restore" : "archive")}
                </Button>
              </span>
            ),
          } satisfies DataTableColumn<Canned>,
        ]
      : []),
  ];

  const data = query.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("search")} className="w-72">
          <Input
            type="search"
            value={q}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t("tag")} className="w-44">
          <Input
            value={tag}
            onChange={(e) => {
              setTag(e.target.value.toLowerCase().replace(/[\s-]+/g, "_"));
              setPage(1);
            }}
          />
        </Field>
        <Checkbox
          label={t("showArchived")}
          checked={archived}
          onCheckedChange={(checked) => {
            setArchived(checked === true);
            setPage(1);
          }}
        />
        {canManage ? (
          <Button className="ms-auto" iconStart="plus" onClick={() => setDraft({ ...EMPTY, key: newIdempotencyKey() })}>
            {t("add")}
          </Button>
        ) : null}
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          empty={<EmptyState icon="chat" title={t("empty")} />}
        />
      )}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={data.meta.perPage}
          total={data.meta.total}
          onPageChange={setPage}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) => tList("range", { from, to, total }),
            pageOf: (current, pages) => tList("pageOf", { page: current, pages }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
      {confirming ? (
        <ConfirmAction
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t(confirming.archived ? "restoreTitle" : "archiveTitle", { title: confirming.title })}
          description={t(confirming.archived ? "restoreBody" : "archiveBody")}
          confirmLabel={t(confirming.archived ? "restore" : "archive")}
          tone={confirming.archived ? "primary" : "destructive"}
          onConfirm={async () => {
            await toggle(confirming);
            setConfirming(null);
          }}
        />
      ) : null}
      {draft ? (
        <FormDialog
          title={draft.id ? t("editTitle") : t("addTitle")}
          submitLabel={t("save")}
          onClose={() => setDraft(null)}
          onSubmit={async () => {
            const body = {
              title: draft.title.trim(),
              bodyTh: draft.bodyTh.trim(),
              bodyEn: draft.bodyEn.trim(),
              tags: tagsFrom(draft.tags),
            };
            if (!body.title || !body.bodyTh || !body.bodyEn) throw new FormError(t("required"));
            if (!body.tags.every((tag) => CANNED_TAG.test(tag))) throw new FormError(t("tagsInvalid"));
            if (draft.id) {
              await adminBrowserApis().contract.PUT("/v1/admin/canned-responses/{cannedResponseId}", {
                params: { path: { cannedResponseId: draft.id } },
                body,
              });
            } else {
              await adminBrowserApis().contract.POST("/v1/admin/canned-responses", {
                params: { header: { "Idempotency-Key": draft.key } },
                body,
              });
            }
            toast.success(t("saved"));
            refresh();
          }}
        >
          <Field label={t("titleLabel")} required>
            <Input
              value={draft.title}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label={t("bodyTh")} required>
            <Textarea rows={4} value={draft.bodyTh} onChange={(e) => setDraft({ ...draft, bodyTh: e.target.value })} />
          </Field>
          <Field label={t("bodyEn")} required>
            <Textarea rows={4} value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} />
          </Field>
          <Field label={t("tags")} hint={t("tagsHint")}>
            <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
