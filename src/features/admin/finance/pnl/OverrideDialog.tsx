"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PNL_CELL_MODE } from "@/domain/status";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { CellMark } from "@/ui/components/CellMark";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage } from "../../console";
import { usePnlFormat } from "./format";
import { pnlKeys, type PnlCell, type PnlGridLine } from "./resources";

const MONEY = /^-?\d{1,12}(\.\d{1,2})?$/;
const normalise = (text: string) => text.replace(/[,\s฿]/g, "").replace(/^−/, "-");

/**
 * Overriding a system value (D-472 item 4): the system's figure stays on screen while the person types theirs, a
 * reason is required every time, and an existing override can go back to the system value. Sent with the cell's ETag
 * as `If-Match`; a stale cell reloads the grid and says so. The grid then shows both values side by side.
 */
export function OverrideDialog({
  planId,
  line,
  cell,
  onClose,
}: {
  planId: string;
  line: PnlGridLine;
  cell: PnlCell;
  onClose: () => void;
}) {
  const t = useTranslations("finance.pnl.override");
  const tEdit = useTranslations("finance.pnl.edit");
  const tTip = useTranslations("finance.pnl.tip");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const format = usePnlFormat();
  const queryClient = useQueryClient();
  const system = cell.mode === "override" ? cell.autoValue : cell.value;
  const [value, setValue] = useState(cell.value === null ? "" : format.plain(cell.value).replace(/^−/, "-"));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ value?: string; reason?: string; form?: string }>({});
  const [busy, setBusy] = useState<"save" | "revert" | null>(null);

  const send = async (next: string | null, which: "save" | "revert") => {
    setBusy(which);
    try {
      const { data } = await adminBrowserApis().contract.PUT(
        "/v1/admin/finance/pnl/plans/{planId}/cells/{lineKey}/{month}",
        {
          params: {
            path: { planId, lineKey: line.line.key, month: cell.month },
            header: { "If-Match": cell.etag },
          },
          body: { value: next, ...(reason.trim() ? { note: reason.trim() } : {}) },
        },
      );
      queryClient.setQueryData(pnlKeys.grid(planId), data);
      void queryClient.invalidateQueries({ queryKey: pnlKeys.plans() });
      toast.success(which === "revert" ? t("reverted") : t("saved"));
      onClose();
    } catch (error) {
      if (isApiError(error) && error.status === 412) {
        await queryClient.invalidateQueries({ queryKey: pnlKeys.grid(planId) });
        toast.error(tEdit("stale"));
        return onClose();
      }
      setErrors({ form: problemMessage(error, tEdit("failed")) });
    } finally {
      setBusy(null);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = normalise(value);
    const next: typeof errors = {};
    if (!MONEY.test(raw)) next.value = tEdit("invalid");
    if (reason.trim().length < 3) next.reason = t("reasonRequired");
    setErrors(next);
    if (next.value || next.reason) return;
    void send(raw, "save");
  };

  const auto = PNL_CELL_MODE.auto;
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={t("title")}
      description={t("description", { line: format.label(line.line), month: format.month(cell.month) })}
      closeLabel={t("cancel")}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {errors.form ? (
          <Callout tone="danger" live>
            {errors.form}
          </Callout>
        ) : null}
        <div className="border-border bg-surface-subtle rounded-card flex items-center justify-between gap-4 border px-4 py-3">
          <span className="flex flex-col gap-1">
            <span className="text-muted text-xs">{t("system")}</span>
            <CellMark variant="chip" icon={auto.icon} label={tTip(`kinds.${cell.source}`)} />
          </span>
          <span className="text-lg font-semibold tabular-nums" data-testid="override-system-value">
            {format.value(line.line, system)}
          </span>
        </div>
        <Field label={t("value")} error={errors.value} required requiredLabel={tCommon("state.required")}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            className="text-end tabular-nums"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field
          label={t("reason")}
          hint={cell.mode === "override" && cell.note ? t("previous", { reason: cell.note }) : t("reasonHint")}
          error={errors.reason}
          required
          requiredLabel={tCommon("state.required")}
        >
          <Textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {cell.mode === "override" ? (
            <Button
              type="button"
              variant="ghost"
              iconStart="undo"
              loading={busy === "revert"}
              disabled={busy !== null}
              onClick={() => void send(null, "revert")}
            >
              {t("revert")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy !== null}>
              {t("cancel")}
            </Button>
            <Button type="submit" iconStart="flag" loading={busy === "save"} disabled={busy !== null}>
              {t("submit")}
            </Button>
          </div>
        </div>
        <p className="text-muted text-xs">{tStatus(PNL_CELL_MODE.override.descriptionKey!)}</p>
      </form>
    </Dialog>
  );
}
