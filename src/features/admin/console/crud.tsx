"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import type { z } from "zod";

import { applyProblemToForm, isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { IconButton } from "@/ui/components/IconButton";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";

import { useCan } from "./actor";
import { adminBrowserApis, type AdminApis } from "./api";
import { ConfirmAction } from "./ConfirmAction";
import { FormFields, type FieldDef } from "./fields";
import type { FilterDef } from "./filters";
import { problemMessage } from "./QueryError";
import type { InitialPage, ListResource } from "./resource";
import { ResourceList } from "./ResourceList";

/**
 * `defineResource` (F2 §2): one declaration → list, create, edit and delete for a simple
 * resource — the catalogue tables, CMS entries, coupons, FAQs — with the shared list behaviour
 * (URL state, saved views, export) and the shared form behaviour (zod on the client, the API's
 * `422 errors[]` mapped onto the same fields, a side sheet rather than a page reload).
 *
 * What it deliberately does not do is decide what a resource *is*: the fetchers, the schema and
 * the fields are the resource's own, typed against its contract or its contract request.
 */
export interface ResourceConfig<TRow extends object, TValues extends FieldValues> {
  list: ListResource<TRow>;
  /** Permission that shows create / edit / delete. The API still decides. */
  manage?: string;
  form?: {
    schema: z.ZodType<TValues, TValues>;
    empty: TValues;
    toValues: (row: TRow) => TValues;
    create?: (apis: AdminApis, values: TValues) => Promise<unknown>;
    update?: (apis: AdminApis, row: TRow, values: TValues) => Promise<unknown>;
  };
  remove?: (apis: AdminApis, row: TRow) => Promise<unknown>;
}

export function defineResource<TRow extends object, TValues extends FieldValues>(
  config: ResourceConfig<TRow, TValues>,
): ResourceConfig<TRow, TValues> {
  return config;
}

export interface CrudListProps<TRow extends object, TValues extends FieldValues> {
  config: ResourceConfig<TRow, TValues>;
  columns: readonly DataTableColumn<TRow>[];
  caption: string;
  /**
   * The form's fields. A prop rather than part of the resource, because their labels are
   * translated at render time and the resource is a plain, server-importable declaration.
   */
  fields?: readonly FieldDef<TValues>[];
  filters?: readonly FilterDef[];
  searchLabel?: string;
  initial?: InitialPage<TRow> | null;
  labels: {
    create?: string;
    createTitle?: string;
    editTitle?: (row: TRow) => string;
    deleteTitle?: (row: TRow) => string;
    deleteDescription?: (row: TRow) => React.ReactNode;
    empty?: string;
  };
  toolbarEnd?: React.ReactNode;
}

export function CrudList<TRow extends object, TValues extends FieldValues>({
  config,
  columns,
  caption,
  fields = [],
  filters,
  searchLabel,
  initial,
  labels,
  toolbarEnd,
}: CrudListProps<TRow, TValues>) {
  const t = useTranslations("console.crud");
  const canManage = useCan(...(config.manage ? [config.manage] : []));
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ row: TRow | null } | null>(null);
  const [deleting, setDeleting] = useState<TRow | null>(null);
  const name = (row: TRow) => config.list.getRowName?.(row) ?? config.list.getRowId(row);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", config.list.key) });

  const actionColumn: DataTableColumn<TRow> = {
    id: "__actions",
    header: <span className="sr-only">{t("actions")}</span>,
    hideable: false,
    className: "w-24 text-end",
    cell: (row) => (
      <div className="flex justify-end gap-1">
        {config.form?.update ? (
          <IconButton
            name="edit"
            size="sm"
            variant="ghost"
            label={t("edit", { name: name(row) })}
            onClick={() => setEditing({ row })}
          />
        ) : null}
        {config.remove ? (
          <IconButton
            name="trash"
            size="sm"
            variant="ghost"
            label={t("delete", { name: name(row) })}
            onClick={() => setDeleting(row)}
          />
        ) : null}
      </div>
    ),
  };

  const withActions = canManage && (config.form?.update || config.remove) ? [...columns, actionColumn] : columns;

  return (
    <>
      <ResourceList
        resource={config.list}
        columns={withActions}
        caption={caption}
        filters={filters}
        searchLabel={searchLabel}
        initial={initial}
        empty={labels.empty ? { title: labels.empty } : undefined}
        toolbarEnd={
          <>
            {toolbarEnd}
            {canManage && config.form?.create ? (
              <Button size="sm" iconStart="plus" onClick={() => setEditing({ row: null })}>
                {labels.create ?? t("create")}
              </Button>
            ) : null}
          </>
        }
      />

      {config.form && editing ? (
        <ResourceSheet
          form={config.form}
          fields={fields}
          row={editing.row}
          title={
            editing.row ? (labels.editTitle?.(editing.row) ?? t("editTitle")) : (labels.createTitle ?? t("createTitle"))
          }
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t("saved"));
            void invalidate();
          }}
        />
      ) : null}

      {config.remove ? (
        <ConfirmAction
          open={deleting !== null}
          onOpenChange={(open) => (open ? undefined : setDeleting(null))}
          title={deleting ? (labels.deleteTitle?.(deleting) ?? t("deleteTitle", { name: name(deleting) })) : ""}
          description={deleting ? (labels.deleteDescription?.(deleting) ?? t("deleteDescription")) : ""}
          confirmLabel={t("deleteConfirm")}
          tone="destructive"
          onConfirm={async () => {
            try {
              await config.remove!(adminBrowserApis(), deleting!);
              toast.success(t("deleted"));
              void invalidate();
            } catch (error) {
              toast.error(problemMessage(error, t("deleteFailed")));
              throw error;
            }
          }}
        />
      ) : null}
    </>
  );
}

function ResourceSheet<TRow extends object, TValues extends FieldValues>({
  form: definition,
  fields,
  row,
  title,
  onClose,
  onSaved,
}: {
  form: NonNullable<ResourceConfig<TRow, TValues>["form"]>;
  fields: readonly FieldDef<TValues>[];
  row: TRow | null;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("console.crud");
  const tCommon = useTranslations("common");
  const [unplaced, setUnplaced] = useState<string[]>([]);

  const form = useForm<TValues>({
    resolver: zodResolver(definition.schema as never) as unknown as Resolver<TValues>,
    defaultValues: (row ? definition.toValues(row) : definition.empty) as DefaultValues<TValues>,
    mode: "onBlur",
  });

  const save = useMutation({
    mutationFn: (values: TValues) =>
      row ? definition.update!(adminBrowserApis(), row, values) : definition.create!(adminBrowserApis(), values),
    onSuccess: onSaved,
    onError: (error) => {
      if (isApiError(error) && error.errors.length > 0) {
        const left = applyProblemToForm(error, (path, message) => form.setError(path as never, message), {
          fields: fields.map((field) => field.name),
        });
        setUnplaced(left.map((item) => item.message));
      } else {
        setUnplaced([problemMessage(error, t("saveFailed"))]);
      }
    },
  });

  const dirty = form.formState.isDirty;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        // A guard, not a trap: closing a changed form asks once (design-system.md §4 forms).
        if (!open && (!dirty || window.confirm(t("discardChanges")))) onClose();
      }}
      title={title}
      closeLabel={tCommon("actions.close")}
      className="w-[min(40rem,calc(100vw-2rem))]"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" form="resource-form" loading={save.isPending}>
            {tCommon("actions.save")}
          </Button>
        </div>
      }
    >
      <form
        id="resource-form"
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="space-y-4"
      >
        {unplaced.length > 0 ? (
          <Callout tone="danger" title={t("saveFailed")}>
            <ul>
              {unplaced.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <FormFields control={form.control} fields={fields} />
      </form>
    </Sheet>
  );
}
