"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { problemMessage, useCan, type InitialPage } from "../console";
import { adminBrowserApis } from "../console/api";
import { loose, type CatalogueRow } from "./api";
import { CatalogueTable } from "./CatalogueTable";
import { listFor } from "./resources";
import { tableByKey } from "./tables";

/**
 * Customer stories on the home page (D-219, `admin.cmsHomeCases.*`): the generic table for the
 * story itself — brand, product, quantity, lead time, the quote, a photo and the customer's
 * consent — and, for those who may, approving a story onto the home page or withdrawing it. The
 * home shows the section only with three approved stories.
 */
export function HomeCases({ initial }: { initial: InitialPage<CatalogueRow> | null }) {
  const t = useTranslations("catalogue.cases");
  const canApprove = useCan("cms.cases.approve");
  const queryClient = useQueryClient();
  const def = tableByKey("home-cases")!;
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "withdraw" }) =>
      loose(adminBrowserApis().contract).POST(`${def.path}/{id}/actions/${action}`, { params: { path: { id } } }),
    onSuccess: (_, { action }) => {
      toast.success(t(action === "approve" ? "approved" : "withdrawn"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", listFor(def).key) });
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  return (
    <CatalogueTable
      tableKey="home-cases"
      initial={initial}
      extraColumns={
        canApprove
          ? [
              {
                id: "decide",
                header: t("decide"),
                cell: (row) =>
                  row.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={act.isPending}
                      onClick={() => act.mutate({ id: row.id, action: "withdraw" })}
                    >
                      {t("withdraw")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={act.isPending}
                      disabled={!row["consentFileId"]}
                      title={row["consentFileId"] ? undefined : t("needsConsent")}
                      onClick={() => act.mutate({ id: row.id, action: "approve" })}
                    >
                      {t("approve")}
                    </Button>
                  ),
              },
            ]
          : []
      }
    />
  );
}
