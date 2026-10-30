"use client";

import { useTranslations } from "next-intl";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

import { ActionBar } from "./ActionBar";

type Pr = Schemas["ErpPurchaseRequestDto"];

/** What can be done with a purchase request now (D-336) — only what the API offers. */
export function RequestActions({
  request,
  layout,
}: {
  request: Pr;
  /** `panel` on the record page's next-steps panel. */
  layout?: "row" | "panel";
}) {
  const t = useTranslations("partnerFactory.requests.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const { factoryId } = useFactory();
  const path = { factoryId, prId: request.id };
  const header = (key: string) => ({ "Idempotency-Key": key });

  return (
    <ActionBar
      layout={layout}
      offered={request.nextActions}
      failed={tCommon("failed")}
      actions={[
        {
          key: "erp_pr.convert",
          label: tStatus("convertPurchaseRequest"),
          icon: "cart",
          variant: "primary",
          confirm: { title: t("convertTitle"), body: t("convertBody"), confirmLabel: t("convertConfirm") },
          run: async ({ idempotencyKey }) =>
            (
              await browserApi().POST(
                "/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/convert",
                {
                  params: { path, header: header(idempotencyKey) },
                },
              )
            ).data,
          done: t("converted"),
          next: (result) => {
            const created = (result as Schemas["ErpDraftFromReorderResultDto"] | undefined)?.created ?? [];
            return created.length === 1 ? `/purchasing/${created[0]!.id}` : "/purchasing?view=draft";
          },
        },
        {
          key: "erp_pr.approve",
          label: tStatus("approvePurchaseRequest"),
          icon: "check",
          variant: "primary",
          confirm: {
            title: t("approveTitle"),
            body: t("approveBody", { no: request.prNo }),
            confirmLabel: t("approveConfirm"),
            reason: { label: t("note"), required: false },
          },
          run: ({ idempotencyKey, reason }) =>
            browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/approve", {
              params: { path, header: header(idempotencyKey) },
              body: reason ? { note: reason } : {},
            }),
          done: t("approved"),
        },
        {
          key: "erp_pr.submit",
          label: tStatus("submitPurchaseRequest"),
          icon: "send",
          variant: "primary",
          confirm: { title: t("submitTitle"), body: t("submitBody"), confirmLabel: t("submitConfirm") },
          run: async ({ idempotencyKey }) =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/submit", {
                params: { path, header: header(idempotencyKey) },
              })
            ).data,
          done: (result) => ((result as Pr | undefined)?.status === "approved" ? t("approved") : t("submitted")),
        },
        {
          key: "erp_pr.edit",
          label: tStatus("editPurchaseRequest"),
          icon: "edit",
          href: `/purchasing/requests/${request.id}/edit`,
        },
        {
          key: "erp_pr.reject",
          label: tStatus("rejectPurchaseRequest"),
          icon: "ban",
          variant: "destructive",
          confirm: {
            title: t("rejectTitle"),
            body: t("rejectBody", { no: request.prNo }),
            confirmLabel: t("rejectConfirm"),
            destructive: true,
            reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
          },
          run: ({ idempotencyKey, reason }) =>
            browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/reject", {
              params: { path, header: header(idempotencyKey) },
              body: { reason },
            }),
          done: t("rejected"),
        },
        {
          key: "erp_pr.cancel",
          label: tStatus("cancelPurchaseRequest"),
          icon: "ban",
          variant: "destructive",
          confirm: {
            title: t("cancelTitle"),
            body: t("cancelBody", { no: request.prNo }),
            confirmLabel: t("cancelConfirm"),
            destructive: true,
            reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
          },
          run: ({ idempotencyKey, reason }) =>
            browserApi().POST("/v1/partner/factories/{factoryId}/erp/purchase-requests/{prId}/actions/cancel", {
              params: { path, header: header(idempotencyKey) },
              body: { reason },
            }),
          done: t("cancelled"),
        },
      ]}
    />
  );
}
