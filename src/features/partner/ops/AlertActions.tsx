"use client";

import { useTranslations } from "next-intl";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";

/** Acknowledges one alert (D-358): it leaves the open list; who and when are kept. */
export function AcknowledgeAlert({ alertId }: { alertId: string }) {
  const t = useTranslations("partnerOps.alerts");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart="check"
      loading={busy}
      onClick={() =>
        void call(
          async () =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/alerts/{alertId}/actions/acknowledge", {
                params: { path: { factoryId, alertId }, header: { "Idempotency-Key": newIdempotencyKey() } },
              })
            ).data,
          t("acknowledged"),
        )
      }
    >
      {t("acknowledge")}
    </Button>
  );
}

/** Acknowledges every open alert at once (the inbox's "mark all read"). */
export function AcknowledgeAll() {
  const t = useTranslations("partnerOps.alerts");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  return (
    <Button
      size="lg"
      variant="secondary"
      iconStart="check"
      loading={busy}
      onClick={() =>
        void call(
          async () =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/alerts/actions/acknowledge-all", {
                params: { path: { factoryId }, header: { "Idempotency-Key": newIdempotencyKey() } },
              })
            ).data,
          t("allAcknowledged"),
        )
      }
    >
      {t("acknowledgeAll")}
    </Button>
  );
}
