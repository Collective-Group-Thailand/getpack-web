"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { IconButton } from "@/ui/components/IconButton";
import { toast } from "@/ui/components/Toast";

import { problemMessage, useCan, type InitialPage } from "../console";
import { adminBrowserApis } from "../console/api";
import { listRows, loose, type CatalogueRow } from "./api";
import { CatalogueTable } from "./CatalogueTable";
import { listFor } from "./resources";
import { tableByKey } from "./tables";

/**
 * The home page's sections, in order (A.2.4 "ordered list with move up/down"): the generic
 * table, sorted by position, with a move up / move down per row that sends the whole new order
 * (`actions/reorder`), which is what the contract asks for.
 */
export function HomeSections({ initial }: { initial: InitialPage<CatalogueRow> | null }) {
  const t = useTranslations("catalogue.sections");
  const canManage = useCan("cms.manage");
  const queryClient = useQueryClient();
  const def = tableByKey("home-sections")!;
  const key = listFor(def).key;

  // The full order, independent of the page the table shows.
  const all = useQuery({
    queryKey: queryKeys.list("admin", key, { perPage: 100, order: "all" }),
    queryFn: () => listRows(adminBrowserApis().contract, def.path, { perPage: 100, sort: "sort", order: "asc" }),
  });
  const ids = (all.data?.data ?? []).map((row) => row.id);

  const reorder = useMutation({
    mutationFn: (next: string[]) =>
      loose(adminBrowserApis().contract).POST(`${def.path}/actions/reorder`, { body: { ids: next } }),
    onSuccess: () => {
      toast.success(t("reordered"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", key) });
    },
    onError: (error) => toast.error(problemMessage(error, t("reorderFailed"))),
  });

  const move = (id: string, by: -1 | 1) => {
    const from = ids.indexOf(id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    reorder.mutate(next);
  };

  return (
    <CatalogueTable
      tableKey="home-sections"
      initial={initial}
      extraColumns={
        canManage
          ? [
              {
                id: "move",
                header: t("order"),
                hideable: false,
                cell: (row) => {
                  const at = ids.indexOf(row.id);
                  const name = String(row.titleTh ?? row.slug);
                  return (
                    <div className="flex gap-1">
                      <IconButton
                        name="chevron-up"
                        size="sm"
                        variant="ghost"
                        label={t("up", { name })}
                        disabled={at <= 0 || reorder.isPending}
                        onClick={() => move(row.id, -1)}
                      />
                      <IconButton
                        name="chevron-down"
                        size="sm"
                        variant="ghost"
                        label={t("down", { name })}
                        disabled={at < 0 || at >= ids.length - 1 || reorder.isPending}
                        onClick={() => move(row.id, 1)}
                      />
                    </div>
                  );
                },
              },
            ]
          : []
      }
    />
  );
}
