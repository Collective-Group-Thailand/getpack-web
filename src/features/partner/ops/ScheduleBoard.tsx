"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ERP_MACHINE_STATE } from "@/domain/status";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { useErpCall } from "@/features/partner/erp/call";
import { Select } from "@/features/partner/select";
import { StatusChip } from "@/features/partner/status";
import { ConfirmAction } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

type Board = Schemas["ErpScheduleDto"];
type Slot = Schemas["ErpScheduleSlotDto"];
type Block = Schemas["ErpScheduleBlockDto"];
type Hours = Record<string, { from: string; to: string } | null>;

const NONE = "none";
const SNAP = 15 * 60_000;
const CLOSED_PX = 28;

interface Segment {
  day: string;
  open: number;
  close: number;
  x: number;
  width: number;
  closed: boolean;
}

/** Bangkok wall-clock time of a day as epoch ms. */
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+07:00`).getTime();
const pad = (n: number) => String(n).padStart(2, "0");
/** An instant as `YYYY-MM-DDTHH:mm` in Bangkok, for a datetime-local input. */
function localValue(ms: number): string {
  const d = new Date(ms + 7 * 3_600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const isoOf = (local: string) => `${local}:00+07:00`;

/**
 * The machine schedule (D-352): one lane per machine across the window's working hours (closed days are a
 * narrow strip), each operation a bar placed at its planned slot — dragged sideways to move it (the API puts
 * it back into working hours and locks it), tapped to set its start, machine, length or lock. Maintenance
 * windows and open breakdowns show as striped blocks the auto-planner keeps free.
 */
export function ScheduleBoard({
  board,
  machines,
  days,
  canManage,
}: {
  board: Board;
  machines: { id: string; name: string }[];
  days: number;
  canManage: boolean;
}) {
  const t = useTranslations("partnerOps.schedule");
  const format = useFormat();
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [editing, setEditing] = useState<Slot | null>(null);
  const [planning, setPlanning] = useState(false);
  const [late, setLate] = useState<Schemas["ErpAutoPlanResultDto"]["late"]>([]);
  const perMinute = days <= 1 ? 2.4 : days <= 3 ? 0.9 : 0.42;

  // The time axis: working hours only, each day after the other.
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [day, hours] of Object.entries(board.hours as Hours).sort(([a], [b]) => a.localeCompare(b))) {
    if (!hours) {
      segments.push({
        day,
        open: at(day, "00:00"),
        close: at(day, "00:00"),
        x: cursor,
        width: CLOSED_PX,
        closed: true,
      });
      cursor += CLOSED_PX;
      continue;
    }
    const open = at(day, hours.from);
    const close = at(day, hours.to);
    const width = Math.max(40, ((close - open) / 60_000) * perMinute);
    segments.push({ day, open, close, x: cursor, width, closed: false });
    cursor += width;
  }
  const total = cursor;
  const xOf = (ms: number) => {
    for (const s of segments) {
      if (s.closed) {
        if (ms < s.open + 86_400_000 && ms >= s.open) return s.x;
        continue;
      }
      if (ms <= s.open) return s.x;
      if (ms <= s.close) return s.x + ((ms - s.open) / (s.close - s.open)) * s.width;
    }
    return ms < (segments[0]?.open ?? 0) ? 0 : total;
  };
  const timeOf = (x: number) => {
    for (const s of segments) {
      if (x <= s.x + s.width) {
        if (s.closed) return s.open + 86_400_000;
        const ms = s.open + ((Math.max(x, s.x) - s.x) / s.width) * (s.close - s.open);
        return Math.round(ms / SNAP) * SNAP;
      }
    }
    return segments.at(-1)?.close ?? 0;
  };

  const move = (slot: Slot, body: Schemas["ErpMoveOperationDto"]) =>
    call(
      async () =>
        (
          await browserApi().PUT(
            "/v1/partner/factories/{factoryId}/erp/production-orders/{moId}/operations/{operationId}/schedule",
            { params: { path: { factoryId, moId: slot.order.id, operationId: slot.operationId } }, body },
          )
        ).data,
      t("moved"),
    );

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" iconStart="refresh" loading={busy} onClick={() => setPlanning(true)}>
            {t("autoPlan")}
          </Button>
          <p className="text-muted text-sm">{t("dragHint")}</p>
        </div>
      ) : null}
      {board.unscheduled > 0 ? (
        <p className="text-warning-subtle-fg font-medium">{t("unscheduled", { n: board.unscheduled })}</p>
      ) : null}
      {late.length ? (
        <div className="border-warning bg-warning-subtle rounded-xl border p-3">
          <p className="font-semibold">{t("lateTitle")}</p>
          <ul className="text-sm">
            {late.map((l) => (
              <li key={l.order.id}>
                <Link href={`/planning/orders/${l.order.id}`} className="underline-offset-4 hover:underline">
                  {t("lateItem", {
                    moNo: l.order.moNo,
                    due: format.date(l.order.dueOn),
                    at: format.dateTime(l.finishesAt),
                  })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Legend />
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <div style={{ width: total + 176 }} className="min-w-full">
          {/* Day headers */}
          <div className="border-border bg-surface-subtle sticky top-0 flex border-b text-xs">
            <div className="w-44 shrink-0 p-2" />
            <div className="relative h-10" style={{ width: total }}>
              {segments.map((s) => (
                <div
                  key={s.day}
                  className={cn(
                    "border-border absolute top-0 h-full border-s px-1 py-1",
                    s.closed && "bg-surface-muted",
                  )}
                  style={{ left: s.x, width: s.width }}
                >
                  <span className="block truncate font-medium">{format.date(s.day)}</span>
                  <span className="text-muted block truncate">
                    {s.closed
                      ? t("closed")
                      : `${(board.hours as Hours)[s.day]?.from}–${(board.hours as Hours)[s.day]?.to}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {board.machines.map((lane) => (
            <Lane
              key={lane.machine.id}
              title={
                <span className="flex flex-col gap-1">
                  <span className="truncate font-medium">{lane.machine.name}</span>
                  <StatusChip map={ERP_MACHINE_STATE} value={lane.state} />
                </span>
              }
              slots={lane.slots}
              blocks={lane.blocks}
              segments={segments}
              total={total}
              xOf={xOf}
              timeOf={timeOf}
              canManage={canManage}
              onOpen={setEditing}
              onDrop={(slot, start) => void move(slot, { start: new Date(start).toISOString(), locked: true })}
            />
          ))}
          {board.unassigned.length ? (
            <Lane
              title={<span className="text-muted">{t("unassigned")}</span>}
              slots={board.unassigned}
              blocks={[]}
              segments={segments}
              total={total}
              xOf={xOf}
              timeOf={timeOf}
              canManage={canManage}
              onOpen={setEditing}
              onDrop={(slot, start) => void move(slot, { start: new Date(start).toISOString(), locked: true })}
            />
          ) : null}
          {!board.machines.length && !board.unassigned.length ? <p className="text-muted p-4">{t("empty")}</p> : null}
        </div>
      </div>
      {editing ? (
        <MoveDialog
          slot={editing}
          machines={machines}
          machineId={
            board.machines.find((m) => m.slots.some((s) => s.operationId === editing.operationId))?.machine.id ?? null
          }
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const ok = await move(editing, body);
            if (ok) setEditing(null);
          }}
        />
      ) : null}
      <ConfirmAction
        open={planning}
        onOpenChange={setPlanning}
        title={t("autoPlanTitle")}
        description={t("autoPlanBody")}
        confirmLabel={t("autoPlanConfirm")}
        onConfirm={async ({ idempotencyKey }) => {
          const result = await call(
            async () =>
              (
                await browserApi().POST("/v1/partner/factories/{factoryId}/erp/schedule/actions/auto-plan", {
                  params: { path: { factoryId }, header: { "Idempotency-Key": idempotencyKey } },
                })
              ).data,
          );
          setPlanning(false);
          if (result) {
            toast.success(t("planned", { placed: result.placed, kept: result.kept }));
            setLate(result.late);
            router.refresh();
          }
        }}
      />
    </div>
  );
}

function Legend() {
  const t = useTranslations("partnerOps.schedule.legend");
  const items: [string, string][] = [
    ["pending", "bg-info-subtle border-info"],
    ["running", "bg-warning-subtle border-warning"],
    ["locked", "bg-primary-subtle border-primary"],
    ["late", "bg-danger-subtle border-danger"],
    ["maintenance", "bg-surface-muted border-border-strong"],
  ];
  return (
    <ul aria-label={t("label")} className="flex flex-wrap gap-3 text-xs">
      {items.map(([key, tone]) => (
        <li key={key} className="flex items-center gap-1">
          <span className={cn("inline-block size-3 rounded border", tone)} aria-hidden />
          {t(key as "pending")}
        </li>
      ))}
    </ul>
  );
}

function Lane({
  title,
  slots,
  blocks,
  segments,
  total,
  xOf,
  timeOf,
  canManage,
  onOpen,
  onDrop,
}: {
  title: React.ReactNode;
  slots: Slot[];
  blocks: Block[];
  segments: Segment[];
  total: number;
  xOf: (ms: number) => number;
  timeOf: (x: number) => number;
  canManage: boolean;
  onOpen: (slot: Slot) => void;
  onDrop: (slot: Slot, start: number) => void;
}) {
  const t = useTranslations("partnerOps.schedule");
  const tShared = useTranslations("partnerOps.shared");
  const drag = useRef<{ id: string; x0: number; left: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState<{ id: string; dx: number } | null>(null);

  return (
    <div className="border-border flex border-b last:border-b-0">
      <div className="w-44 shrink-0 p-2">{title}</div>
      <div className="relative h-16" style={{ width: total }}>
        {segments.map((s) => (
          <div
            key={s.day}
            aria-hidden
            className={cn("border-border absolute top-0 h-full border-s", s.closed && "bg-surface-muted")}
            style={{ left: s.x, width: s.width }}
          />
        ))}
        {blocks.map((b) => {
          const left = xOf(new Date(b.start).getTime());
          const width = Math.max(6, xOf(new Date(b.end).getTime()) - left);
          return (
            <Link
              key={b.maintenanceOrder.id}
              href={`/maintenance/${b.maintenanceOrder.id}`}
              className="border-warning bg-warning-subtle text-warning-subtle-fg absolute top-1 bottom-1 overflow-hidden rounded-md border-2 border-dashed px-1 text-xs"
              style={{ left, width }}
              title={t("maintenanceBlock", { no: b.maintenanceOrder.code })}
            >
              {t("maintenanceBlock", { no: b.maintenanceOrder.code })}
            </Link>
          );
        })}
        {slots.map((slot) => {
          const left = xOf(new Date(slot.start).getTime());
          const width = Math.max(10, xOf(new Date(slot.end).getTime()) - left);
          const running = slot.status === "in_progress" || slot.status === "paused";
          const draggable = canManage && slot.status === "pending";
          const dx = offset?.id === slot.operationId ? offset.dx : 0;
          return (
            <button
              key={slot.operationId}
              type="button"
              className={cn(
                "absolute top-2 bottom-2 overflow-hidden rounded-md border px-1 text-start text-xs shadow-sm",
                "focus-visible:ring-focus-ring outline-none focus-visible:ring-2",
                slot.late
                  ? "border-danger bg-danger-subtle"
                  : running
                    ? "border-warning bg-warning-subtle"
                    : slot.locked
                      ? "border-primary bg-primary-subtle"
                      : "border-info bg-info-subtle",
                slot.status === "done" && "opacity-60",
                draggable && "cursor-grab touch-none active:cursor-grabbing",
              )}
              style={{ left: left + dx, width }}
              title={t("slot", { seq: slot.seq, name: slot.name, mo: slot.order.moNo })}
              onPointerDown={(event) => {
                if (!draggable) return;
                (event.target as HTMLElement).setPointerCapture(event.pointerId);
                drag.current = { id: slot.operationId, x0: event.clientX, left, moved: false };
              }}
              onPointerMove={(event) => {
                const d = drag.current;
                if (!d || d.id !== slot.operationId) return;
                const delta = event.clientX - d.x0;
                if (Math.abs(delta) > 4) d.moved = true;
                if (d.moved) setOffset({ id: slot.operationId, dx: delta });
              }}
              onPointerUp={(event) => {
                const d = drag.current;
                drag.current = null;
                setOffset(null);
                if (d?.moved) onDrop(slot, timeOf(d.left + (event.clientX - d.x0)));
                else onOpen(slot);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setOffset(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpen(slot);
              }}
            >
              <span className="block truncate font-medium">
                {slot.locked ? "🔒 " : ""}
                {tShared("numbered", { no: slot.seq, name: slot.name })}
              </span>
              <span className="block truncate">{slot.order.moNo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MoveDialog({
  slot,
  machines,
  machineId,
  canManage,
  onClose,
  onSave,
}: {
  slot: Slot;
  machines: { id: string; name: string }[];
  machineId: string | null;
  canManage: boolean;
  onClose: () => void;
  onSave: (body: Schemas["ErpMoveOperationDto"]) => Promise<void>;
}) {
  const t = useTranslations("partnerOps.schedule");
  const format = useFormat();
  const [start, setStart] = useState(localValue(new Date(slot.start).getTime()));
  const [machine, setMachine] = useState(machineId ?? NONE);
  const [minutes, setMinutes] = useState(String(slot.plannedMinutes));
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const editable = canManage && slot.status !== "done";

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("moveTitle", { name: `${slot.seq}. ${slot.name}` })}
      description={`${slot.order.moNo} · ${slot.order.title} · ${format.dateTime(slot.start)} – ${format.dateTime(slot.end)}`}
      closeLabel={t("legend.label")}
      footer={
        editable ? (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onSave({ start: new Date(slot.start).toISOString(), locked: !slot.locked });
                setBusy(false);
              }}
            >
              {slot.locked ? t("unlock") : t("lock")}
            </Button>
            <Button
              loading={busy}
              iconStart="save"
              onClick={async () => {
                setBusy(true);
                await onSave({
                  start: isoOf(start),
                  machineId: machine === NONE ? null : machine,
                  plannedMinutes: Math.max(1, Number.parseInt(minutes, 10) || slot.plannedMinutes || 1),
                  locked,
                });
                setBusy(false);
              }}
            >
              {t("save")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          <Link href={`/planning/orders/${slot.order.id}`} className="text-primary underline-offset-4 hover:underline">
            {slot.order.moNo}
          </Link>
          {slot.locked ? ` · ${t("locked")}` : ""}
          {slot.late ? ` · ${t("late")}` : ""}
        </p>
        {editable ? (
          <>
            <Field label={t("start")}>
              <Input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label={t("machine")}>
              <Select
                value={machine}
                onValueChange={setMachine}
                options={[
                  { value: NONE, label: t("noMachine") },
                  ...machines.map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            </Field>
            <Field label={t("minutes")}>
              <NumberInput min={1} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </Field>
            <Checkbox
              label={t("keepLocked")}
              checked={locked}
              onCheckedChange={(checked) => setLocked(checked === true)}
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
