"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { Select } from "@/features/partner/select";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { ActionBar } from "./ActionBar";
import { useErpCall } from "./call";
import { formatQty, plainNumber, QTY_PATTERN, trimZeros } from "./format";

type Mo = Schemas["ErpProductionOrderDto"];

/**
 * A production order's actions (D-340, D-341), as the API offers them: release (reserve), issue every
 * remaining material, complete with good and scrap pieces, cancel.
 */
export function MoActions({ order, locale }: { order: Mo; locale: string }) {
  const t = useTranslations("partnerFactory.orders.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const { factoryId } = useFactory();
  const path = { factoryId, moId: order.id };
  const header = (key: string) => ({ "Idempotency-Key": key });
  const unit = tCommon(`units.${order.unit}` as never);
  const completable = order.nextActions.some((a) => a.key === "erp_mo.complete" && !a.disabledReason);

  return (
    <div className="flex flex-wrap gap-2">
      <ActionBar
        offered={order.nextActions}
        failed={tCommon("failed")}
        actions={[
          {
            key: "erp_mo.release",
            label: tStatus("releaseProductionOrder"),
            icon: "send",
            variant: "primary",
            confirm: { title: t("releaseTitle"), body: t("releaseBody"), confirmLabel: t("releaseConfirm") },
            run: ({ idempotencyKey }) =>
              browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/actions/release", {
                params: { path, header: header(idempotencyKey) },
              }),
            done: t("released"),
          },
          {
            key: "erp_mo.issue",
            label: tStatus("issueMaterials"),
            icon: "package",
            variant: "primary",
            confirm: {
              title: t("issueTitle"),
              body: (
                <span className="flex flex-col gap-1">
                  <span>{t("issueBody")}</span>
                  <span className="text-muted">
                    {order.materials
                      .filter((m) => m.remainingQty !== "0.000")
                      .map(
                        (m) =>
                          `${m.item.name} ${formatQty(m.remainingQty, locale)} ${tCommon(`units.${m.item.baseUnit}` as never)}`,
                      )
                      .join(" · ")}
                  </span>
                </span>
              ),
              confirmLabel: t("issueConfirm"),
            },
            run: ({ idempotencyKey }) =>
              browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/actions/issue", {
                params: { path, header: header(idempotencyKey) },
                body: {},
              }),
            done: t("issued"),
          },
          {
            key: "erp_mo.cancel",
            label: tStatus("cancelProductionOrder"),
            icon: "ban",
            variant: "destructive",
            confirm: {
              title: t("cancelTitle"),
              body: t("cancelBody", { no: order.moNo }),
              confirmLabel: t("cancelConfirm"),
              destructive: true,
              phrase: order.moNo,
              reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
            },
            run: ({ idempotencyKey, reason }) =>
              browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/actions/cancel", {
                params: { path, header: header(idempotencyKey) },
                body: { reason },
              }),
            done: t("cancelled"),
          },
        ]}
      />
      {completable ? <CompleteButton order={order} unit={unit} /> : null}
    </div>
  );
}

function CompleteButton({ order, unit }: { order: Mo; unit: string }) {
  const t = useTranslations("partnerFactory.orders.actions");
  const tCommon = useTranslations("partnerErp.common");
  const tStatus = useTranslations("status.action");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const last = [...order.operations].reverse().find((o) => o.status === "done");
  const [good, setGood] = useState(trimZeros(last?.goodQty) || trimZeros(order.quantity));
  const [scrap, setScrap] = useState(trimZeros(last?.scrapQty) || "0");
  const valid = QTY_PATTERN.test(plainNumber(good)) && QTY_PATTERN.test(plainNumber(scrap || "0"));
  return (
    <>
      <Button size="lg" variant="primary" iconStart="check" onClick={() => setOpen(true)}>
        {tStatus("completeProductionOrder")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("completeTitle")}
        description={order.item ? t("completeBodyStock", { name: order.item.name }) : t("completeBody")}
        confirmLabel={t("completeConfirm")}
        confirmationPhrase={order.moNo}
        onConfirm={async ({ idempotencyKey }) => {
          if (!valid) {
            toast.error(tCommon("qtyPlaceholder"));
            throw new Error("invalid");
          }
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/actions/complete", {
              params: { path: { factoryId, moId: order.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { goodQty: plainNumber(good), scrapQty: plainNumber(scrap || "0") },
            });
            toast.success(t("completed"));
            setOpen(false);
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, tCommon("failed")));
            throw error;
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("good")}>
            <NumberInput
              step="any"
              min={0}
              unit={unit}
              value={good}
              onChange={(event) => setGood(event.target.value)}
            />
          </Field>
          <Field label={t("scrap")}>
            <NumberInput
              step="any"
              min={0}
              unit={unit}
              value={scrap}
              onChange={(event) => setScrap(event.target.value)}
            />
          </Field>
        </div>
      </ConfirmAction>
    </>
  );
}

/** Puts unused material back (D-341): one material, how much — at most what was issued. */
export function ReturnMaterial({ order, locale }: { order: Mo; locale: string }) {
  const t = useTranslations("partnerFactory.orders.actions");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const issued = order.materials.filter((m) => m.issuedQty !== "0.000");
  const [materialId, setMaterialId] = useState(issued[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string>();
  const material = issued.find((m) => m.id === materialId);
  if (!issued.length) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!QTY_PATTERN.test(plainNumber(quantity))) {
      setError(tCommon("qtyPlaceholder"));
      return;
    }
    setError(undefined);
    const ok = await call(
      () =>
        browserApi().POST("/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/actions/return", {
          params: { path: { factoryId, moId: order.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
          body: { lines: [{ materialId, quantity: plainNumber(quantity) }] },
        }),
      t("returned"),
    );
    if (ok) setQuantity("");
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
      noValidate
    >
      <Field label={t("returnWhat")}>
        <Select
          value={materialId}
          onValueChange={setMaterialId}
          options={issued.map((m) => ({
            value: m.id,
            label: m.item.name,
            description: formatQty(m.issuedQty, locale),
          }))}
        />
      </Field>
      <Field label={tCommon("quantity")} error={error}>
        <NumberInput
          step="any"
          min={0}
          unit={material ? tCommon(`units.${material.item.baseUnit}` as never) : undefined}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary" iconStart="undo" loading={busy}>
        {t("returnSubmit")}
      </Button>
    </form>
  );
}

/** An operator's buttons on one operation (D-341): start, finish with good and scrap, or skip. */
export function OperationButtons({
  orderId,
  operation,
  unit,
  defaultGood,
}: {
  orderId: string;
  operation: Schemas["ErpProductionOperationDto"];
  unit: string;
  defaultGood: string;
}) {
  const t = useTranslations("partnerFactory.floor");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [finishing, setFinishing] = useState(false);
  const [good, setGood] = useState(trimZeros(defaultGood));
  const [scrap, setScrap] = useState("0");
  const path = { factoryId, moId: orderId, operationId: operation.id };
  const header = { "Idempotency-Key": crypto.randomUUID() };

  if (operation.status === "done" || operation.status === "skipped") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {operation.status === "pending" ? (
          <Button
            size="lg"
            iconStart="play"
            loading={busy}
            onClick={() =>
              void call(
                () =>
                  browserApi().POST(
                    "/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/operations/{operationId}/actions/start",
                    { params: { path, header } },
                  ),
                t("started"),
              )
            }
          >
            {t("start")}
          </Button>
        ) : null}
        <Button
          size="lg"
          variant={operation.status === "in_progress" ? "primary" : "secondary"}
          iconStart="check"
          onClick={() => setFinishing(!finishing)}
        >
          {t("finish")}
        </Button>
        {operation.status === "pending" ? (
          <Button
            size="lg"
            variant="ghost"
            iconStart="minus"
            loading={busy}
            onClick={() =>
              void call(
                () =>
                  browserApi().POST(
                    "/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/operations/{operationId}/actions/skip",
                    { params: { path, header } },
                  ),
                t("skipped"),
              )
            }
          >
            {t("skip")}
          </Button>
        ) : null}
      </div>
      {finishing ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!QTY_PATTERN.test(plainNumber(good)) || !QTY_PATTERN.test(plainNumber(scrap || "0"))) {
              toast.error(tCommon("qtyPlaceholder"));
              return;
            }
            void call(
              () =>
                browserApi().POST(
                  "/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/operations/{operationId}/actions/finish",
                  {
                    params: { path, header },
                    body: { goodQty: plainNumber(good), scrapQty: plainNumber(scrap || "0") },
                  },
                ),
              t("finished"),
            ).then((ok) => ok && setFinishing(false));
          }}
        >
          <Field label={t("good")}>
            <NumberInput
              step="any"
              min={0}
              unit={unit}
              value={good}
              onChange={(event) => setGood(event.target.value)}
            />
          </Field>
          <Field label={t("scrap")}>
            <NumberInput
              step="any"
              min={0}
              unit={unit}
              value={scrap}
              onChange={(event) => setScrap(event.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" iconStart="save" loading={busy}>
            {t("save")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
