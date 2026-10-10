"use client";

import { useTranslations } from "next-intl";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { ActionBar } from "@/features/partner/erp/ActionBar";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

/** What can be done with a request for quotation now (D-348): send, edit, cancel — as the API offers. */
export function RfqActions({ rfq }: { rfq: Schemas["ErpRfqDto"] }) {
  const t = useTranslations("partnerOps.rfqs.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const { factoryId } = useFactory();
  const path = { factoryId, rfqId: rfq.id };
  const header = (key: string) => ({ "Idempotency-Key": key });

  return (
    <ActionBar
      offered={rfq.nextActions}
      failed={tCommon("failed")}
      actions={[
        {
          key: "erp_rfq.send",
          label: tStatus("sendRfq"),
          icon: "send",
          variant: "primary",
          confirm: { title: t("sendTitle"), body: t("sendBody"), confirmLabel: t("sendConfirm") },
          run: async ({ idempotencyKey }) =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/actions/send", {
                params: { path, header: header(idempotencyKey) },
              })
            ).data,
          done: t("sent"),
        },
        { key: "erp_rfq.edit", label: t("edit"), icon: "edit", href: `/purchasing/rfqs/${rfq.id}/edit` },
        {
          key: "erp_rfq.cancel",
          label: t("cancel"),
          icon: "ban",
          variant: "destructive",
          confirm: {
            title: t("cancelTitle", { no: rfq.rfqNo }),
            body: t("cancelBody"),
            confirmLabel: t("cancelConfirm"),
            destructive: true,
            reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
          },
          run: async ({ idempotencyKey, reason }) =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/rfqs/{rfqId}/actions/cancel", {
                params: { path, header: header(idempotencyKey) },
                body: { reason },
              })
            ).data,
          done: t("cancelled"),
        },
      ]}
    />
  );
}
