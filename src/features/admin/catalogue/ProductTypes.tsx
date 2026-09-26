"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ifMatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, useCan, type InitialPage } from "../console";
import { adminBrowserApis } from "../console/api";
import { getRow, loose, type CatalogueRow } from "./api";
import { CatalogueTable } from "./CatalogueTable";
import { listFor } from "./resources";
import { tableByKey } from "./tables";

/**
 * Product types (D-100): the generic table plus the one decision that is not an edit — whether
 * a type is quoted instantly or by RFQ. That goes through its own action, with a reason, because
 * it changes what every customer sees; the API refuses `instant` until the type's calculator has
 * shipped, and whether a given configuration is instant is still the factories' (D-043).
 */
export function ProductTypes({ initial }: { initial: InitialPage<CatalogueRow> | null }) {
  const t = useTranslations("catalogue.quoteMode");
  const canManage = useCan("catalog.manage");
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<CatalogueRow | null>(null);
  const def = tableByKey("product-types")!;
  const next = target?.quoteMode === "instant" ? "rfq" : "instant";

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info" title={t("title")}>
        {t("body")}
      </Callout>
      <CatalogueTable
        tableKey="product-types"
        initial={initial}
        extraColumns={
          canManage
            ? [
                {
                  id: "changeQuoteMode",
                  header: t("column"),
                  hideable: false,
                  cell: (row) => (
                    <Button size="sm" variant="secondary" onClick={() => setTarget(row)}>
                      {row.quoteMode === "instant" ? t("toRfq") : t("toInstant")}
                    </Button>
                  ),
                },
              ]
            : []
        }
      />
      <ConfirmAction
        open={target !== null}
        onOpenChange={(open) => (open ? undefined : setTarget(null))}
        title={t(next === "instant" ? "confirmInstantTitle" : "confirmRfqTitle")}
        description={
          target ? (
            <span className="flex flex-col gap-2">
              <span>
                {t(next === "instant" ? "confirmInstantBody" : "confirmRfqBody", {
                  code: String(target.code),
                  name: String(target.nameTh),
                })}
              </span>
              <span className="flex items-center gap-2">
                <Badge>{t(`modes.${String(target.quoteMode)}`)}</Badge>→
                <Badge tone="primary">{t(`modes.${next}`)}</Badge>
              </span>
            </span>
          ) : null
        }
        confirmLabel={t("confirm")}
        confirmationPhrase={target ? String(target.code) : undefined}
        reason={{ label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }}
        onConfirm={async ({ reason }) => {
          if (!target) return;
          try {
            const { contract } = adminBrowserApis();
            const { etag } = await getRow(contract, def.path, target.id);
            await loose(contract).POST(`${def.path}/{id}/actions/change-quote-mode`, {
              params: { path: { id: target.id } },
              body: { quoteMode: next, reason },
              headers: ifMatch(etag),
            });
            toast.success(t("done", { code: String(target.code), mode: t(`modes.${next}`) }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", listFor(def).key) });
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </div>
  );
}
