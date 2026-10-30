"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { offered } from "@/features/partner/account/offered";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

type Po = Schemas["ErpPurchaseOrderDto"];
type Dialog = "issue" | "cancel" | "close" | null;

/**
 * What can be done with a purchase order now — only the actions the API offers (`nextActions`, ADR-0005):
 * edit the draft, approve it (numbered and frozen; restated and typed), receive goods, close what will not
 * come, cancel. Each confirmation carries one `Idempotency-Key`.
 */
export function PoActions({ order, etag }: { order: Po; etag: string | null }) {
  const t = useTranslations("partnerErp.purchasing.detail");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const { factoryId } = useFactory();
  const format = useFormat();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState<Dialog>(null);
  const has = (key: string) => Boolean(offered(order.nextActions, key));
  const path = { factoryId, poId: order.id };

  async function run(kind: Exclude<Dialog, null>, idempotencyKey: string, reason: string) {
    try {
      const header = { "Idempotency-Key": idempotencyKey };
      const result =
        kind === "issue"
          ? await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}/actions/issue", {
              params: { path, header: { ...header, "If-Match": etag ?? undefined } },
            })
          : kind === "cancel"
            ? await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}/actions/cancel", {
                params: { path, header },
                body: { reason },
              })
            : await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-orders/{poId}/actions/close", {
                params: { path, header },
                body: { reason },
              });
      toast.success(kind === "issue" ? t("issue.done", { no: result.data?.poNo ?? "" }) : t(`${kind}.done`));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
      throw error;
    }
  }

  return (
    // The purchase order page's sticky action panel: one full-width stack, cancelling last.
    <div data-fill="row" className="flex flex-col gap-2">
      {has("erp_po.receive") ? (
        <Button asChild size="lg" iconStart="package-check">
          <Link href={`/stock/receive?po=${order.id}`}>{tStatus("receiveGoods")}</Link>
        </Button>
      ) : null}
      {has("erp_po.issue") ? (
        <Button size="lg" iconStart="send" onClick={() => setOpen("issue")}>
          {tStatus("issuePurchaseOrder")}
        </Button>
      ) : null}
      {has("erp_po.edit") ? (
        <Button asChild size="lg" variant="secondary" iconStart="edit">
          <Link href={`/purchasing/${order.id}/edit`}>{tStatus("editPurchaseOrder")}</Link>
        </Button>
      ) : null}
      <Button asChild size="lg" variant="secondary" iconStart="printer">
        <Link href={`/purchasing/${order.id}/print`}>{t("print")}</Link>
      </Button>
      {has("erp_po.close") ? (
        <Button size="lg" variant="secondary" iconStart="archive" onClick={() => setOpen("close")}>
          {tStatus("closePurchaseOrder")}
        </Button>
      ) : null}
      {has("erp_po.cancel") ? (
        <Button size="lg" variant="destructive" iconStart="ban" onClick={() => setOpen("cancel")}>
          {tStatus("cancelPurchaseOrder")}
        </Button>
      ) : null}

      {open === "issue" ? (
        <ConfirmAction
          open
          onOpenChange={(next) => !next && setOpen(null)}
          tone="primary"
          title={t("issue.title")}
          description={t("issue.body", { total: format.thb(order.total), supplier: order.supplier.name })}
          confirmLabel={t("issue.confirm")}
          confirmationPhrase={order.supplier.code}
          onConfirm={({ idempotencyKey }) => run("issue", idempotencyKey, "")}
        />
      ) : null}
      {open === "cancel" || open === "close" ? (
        <ConfirmAction
          open
          onOpenChange={(next) => !next && setOpen(null)}
          tone={open === "cancel" ? "destructive" : "primary"}
          title={t(`${open}.title`)}
          description={t(`${open}.body`)}
          confirmLabel={t(`${open}.confirm`)}
          {...(order.poNo ? { confirmationPhrase: order.poNo } : {})}
          reason={{ label: t("reason"), required: true, minLength: 3, placeholder: t("reasonPlaceholder") }}
          onConfirm={({ idempotencyKey, reason }) => run(open, idempotencyKey, reason)}
        />
      ) : null}
    </div>
  );
}

/** The browser's print dialog (a PDF is "Save as PDF" there). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="lg" iconStart="printer" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
