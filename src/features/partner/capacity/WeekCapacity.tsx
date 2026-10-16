"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * One week's capacity of one product type, changed by the factory itself (`factory_capacity.manage`): a holiday,
 * a machine overhaul, an extra shift. getpack books new jobs against it from then on.
 */
export function WeekCapacity({
  productTypeId,
  productTypeName,
  weekStart,
  weekLabel,
  capacity,
}: {
  productTypeId: string;
  productTypeName: string;
  weekStart: string;
  weekLabel: string;
  capacity: string;
}) {
  const t = useTranslations("partnerJobs.capacity.override");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(Number(capacity)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^\d{1,9}$/.test(value.trim()) && reason.trim().length >= 3;

  async function save() {
    if (!valid) return toast.error(t("invalid"));
    setBusy(true);
    try {
      await browserApi().PUT("/v1/partner/factories/{factoryId}/capacity-overrides", {
        params: { path: { factoryId } },
        body: { productTypeId, weekStart, capacity: Number(value.trim()), reason: reason.trim() },
      });
      toast.success(t("saved"));
      setOpen(false);
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>
        {t("change")}
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={setOpen}
          title={t("title", { type: productTypeName, week: weekLabel })}
          description={t("body")}
          closeLabel={t("cancel")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button iconStart="save" loading={busy} disabled={!valid} onClick={() => void save()}>
                {t("save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label={t("capacity")}>
              <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field label={t("reason")}>
              <Input value={reason} maxLength={200} placeholder={t("reasonPlaceholder")} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
