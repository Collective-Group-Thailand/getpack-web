"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

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
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Board = Schemas["ErpScheduleDto"];
type Slot = Schemas["ErpScheduleSlotDto"];
type Block = Schemas["ErpScheduleBlockDto"];
type Hours = Record<string, { from: string; to: string } | null>;

const NONE = "none";
const SNAP = 15 * 60_000;
const CLOSED_PX = 72;
/** The machine-name column of the board. */
const NAME_PX = 200;

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
  nav,
}: {
  board: Board;
  machines: { id: string; name: string }[];
  days: number;
  canManage: boolean;
  /** The window controls (1/3/7 days, previous/today/next): the left end of the board's one toolbar. */
  nav?: React.ReactNode;
}) {
  const t = useTranslations("partnerOps.schedule");
  const tShared = useTranslations("partnerOps.shared");
  const format = useFormat();
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [editing, setEditing] = useState<Slot | null>(null);
  const [planning, setPlanning] = useState(false);
  const [late, setLate] = useState<Schemas["ErpAutoPlanResultDto"]["late"]>([]);
  const perMinute = days <= 1 ? 2.4 : days <= 3 ? 0.9 : 0.42;
  // "Now" is drawn only after hydration, so the server and the browser render the same markup.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

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
  // Hour marks inside working hours: labelled when an hour is wide enough to read, a faint rule otherwise.
  const pxPerHour = perMinute * 60;
  const labelEvery = pxPerHour >= 48 ? 1 : pxPerHour >= 24 ? 3 : 0;
  const hours: { key: string; x: number; label: string | null }[] = [];
  for (const s of segments) {
    if (s.closed) continue;
    const first = Math.ceil(s.open / 3_600_000) * 3_600_000;
    for (let ms = first; ms < s.close; ms += 3_600_000) {
      if (ms === s.open) continue;
      const hour = new Date(ms + 7 * 3_600_000).getUTCHours();
      hours.push({
        key: `${s.day}-${hour}`,
        x: s.x + ((ms - s.open) / (s.close - s.open)) * s.width,
        label: labelEvery && hour % labelEvery === 0 ? `${pad(hour)}:00` : null,
      });
    }
  }
  const lanes = [
    ...board.machines.map((lane) => ({
      key: lane.machine.id,
      name: lane.machine.name,
      state: lane.state as string | null,
      slots: lane.slots,
      blocks: lane.blocks,
    })),
    ...(board.unassigned.length
      ? [{ key: NONE, name: t("unassigned"), state: null, slots: board.unassigned, blocks: [] as Block[] }]
      : []),
  ];
  const empty = lanes.every((lane) => !lane.slots.length && !lane.blocks.length);
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

  const nowX = now !== null && segments.some((s) => !s.closed && now >= s.open && now <= s.close) ? xOf(now) : null;
  // On a phone a slot reads "30 ต.ค. · 08:30–11:00"; one running past midnight keeps both full times.
  const slotTime = (slot: Slot) => {
    const start = localValue(new Date(slot.start).getTime());
    const end = localValue(new Date(slot.end).getTime());
    return start.slice(0, 10) === end.slice(0, 10)
      ? `${format.date(slot.start, { style: "dayMonth" })} · ${start.slice(11)}–${end.slice(11)}`
      : `${format.dateTime(slot.start)} – ${format.dateTime(slot.end)}`;
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

  const autoPlan = canManage ? (
    <Button size="lg" iconStart="refresh" loading={busy} onClick={() => setPlanning(true)}>
      {t("autoPlan")}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* One toolbar: the window on the left, the one primary action on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">{nav}</div>
        {autoPlan}
      </div>
      {board.unscheduled > 0 ? <Callout tone="warning">{t("unscheduled", { n: board.unscheduled })}</Callout> : null}
      {late.length ? (
        <Callout tone="warning" title={t("lateTitle")}>
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
        </Callout>
      ) : null}

      {/* A desk reads the timeline: the machine names stay put while the hours scroll under them. */}
      <div className="border-border bg-surface relative hidden overflow-x-auto rounded-xl border md:block">
        <div style={{ width: total + NAME_PX }} className="min-w-full">
          <div className="border-border bg-surface-subtle sticky top-0 z-10 flex border-b text-xs">
            <div
              className="border-border bg-surface-subtle sticky left-0 z-20 shrink-0 border-e px-3 py-2"
              style={{ width: NAME_PX }}
            >
              <span className="text-muted font-medium">{t("machine")}</span>
            </div>
            <div className="relative h-14" style={{ width: total }}>
              {segments.map((s) => (
                <div
                  key={s.day}
                  className={cn(
                    "border-border absolute top-0 h-full border-s px-2 pt-1.5",
                    s.closed && "bg-surface-muted",
                  )}
                  style={{ left: s.x, width: s.width }}
                >
                  <span className="block truncate" title={format.date(s.day)}>
                    <span className="font-semibold">{format.date(s.day, { style: "dayMonth" })}</span>
                    <span className="text-muted">
                      {s.closed
                        ? ` · ${t("closed")}`
                        : ` · ${(board.hours as Hours)[s.day]?.from}–${(board.hours as Hours)[s.day]?.to}`}
                    </span>
                  </span>
                </div>
              ))}
              {hours.map((h) =>
                h.label ? (
                  <span
                    key={h.key}
                    aria-hidden
                    className="text-muted absolute bottom-1 -translate-x-1/2 text-[0.6875rem] tabular-nums"
                    style={{ left: h.x }}
                  >
                    {h.label}
                  </span>
                ) : null,
              )}
            </div>
          </div>
          {lanes.map((lane) => (
            <Lane
              key={lane.key}
              title={
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={cn("truncate text-sm font-medium", !lane.state && "text-muted")} title={lane.name}>
                    {lane.name}
                  </span>
                  {lane.state ? (
                    <span className="self-start">
                      <StatusChip map={ERP_MACHINE_STATE} value={lane.state as Board["machines"][number]["state"]} />
                    </span>
                  ) : null}
                </span>
              }
              slots={lane.slots}
              blocks={lane.blocks}
              segments={segments}
              hours={hours}
              nowX={nowX}
              total={total}
              xOf={xOf}
              timeOf={timeOf}
              canManage={canManage}
              onOpen={setEditing}
              onDrop={(slot, start) => void move(slot, { start: new Date(start).toISOString(), locked: true })}
            />
          ))}
          {!lanes.length ? <p className="text-muted p-4">{t("empty")}</p> : null}
        </div>
        {empty && lanes.length ? (
          // Nothing planned in this window: say so over the empty lanes, with the one way to fill them.
          <div className="pointer-events-none absolute inset-x-0 top-14 bottom-0 flex items-center justify-center p-6">
            <div className="rounded-card border-border bg-surface pointer-events-auto flex max-w-sm flex-col items-center gap-3 border p-5 text-center shadow-sm">
              <Icon name="gantt" size={22} className="text-muted" aria-hidden />
              <p className="font-semibold">{t("empty")}</p>
              {canManage && board.unscheduled > 0 ? (
                <Button variant="secondary" iconStart="refresh" loading={busy} onClick={() => setPlanning(true)}>
                  {t("autoPlan")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* A phone reads a list: each machine with its work in time order; a tap opens the same dialog. */}
      {empty ? (
        <p className="border-border bg-surface text-muted rounded-xl border px-4 py-5 text-center md:hidden">
          {t("empty")}
        </p>
      ) : null}
      <ul className={cn("flex flex-col gap-3 md:hidden", empty && "hidden")}>
        {lanes.map((lane) => {
          const slots = [...lane.slots].sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={lane.key} className="border-border bg-surface rounded-xl border">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className={cn("min-w-0 font-semibold break-keep", !lane.state && "text-muted")}>{lane.name}</span>
                {lane.state ? (
                  <StatusChip map={ERP_MACHINE_STATE} value={lane.state as Board["machines"][number]["state"]} />
                ) : null}
              </div>
              {slots.length || lane.blocks.length ? (
                <ul className="border-border divide-border divide-y border-t">
                  {lane.blocks.map((b) => (
                    <li key={b.maintenanceOrder.id}>
                      <Link
                        href={`/maintenance/${b.maintenanceOrder.id}`}
                        className="text-warning-subtle-fg flex min-h-12 items-center gap-2 px-4 py-2 text-sm"
                      >
                        <Icon name="wrench" size={16} aria-hidden />
                        {t("maintenanceBlock", { no: b.maintenanceOrder.code })}
                      </Link>
                    </li>
                  ))}
                  {slots.map((slot) => (
                    <li key={slot.operationId}>
                      <button
                        type="button"
                        onClick={() => setEditing(slot)}
                        className="hover:bg-surface-subtle focus-visible:ring-focus-ring flex min-h-14 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        <span className="flex w-full items-center gap-2">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2.5 shrink-0 rounded-full",
                              slot.late
                                ? "bg-danger"
                                : slot.status === "in_progress" || slot.status === "paused"
                                  ? "bg-warning"
                                  : slot.locked
                                    ? "bg-primary"
                                    : "bg-info",
                            )}
                          />
                          <span className="min-w-0 flex-1 font-medium break-keep">
                            {tShared("numbered", { no: slot.seq, name: slot.name })}
                          </span>
                          {slot.locked ? (
                            <Icon name="lock" size={14} className="text-muted" aria-label={t("locked")} />
                          ) : null}
                        </span>
                        <span className="text-muted ps-4.5 text-sm tabular-nums">{slotTime(slot)}</span>
                        <span className="text-muted ps-4.5 text-sm">{slot.order.moNo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted border-border border-t px-4 py-3 text-sm">{t("empty")}</p>
              )}
            </li>
          );
        })}
        {!lanes.length ? <li className="text-muted">{t("empty")}</li> : null}
      </ul>
      <Legend />
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
    ["maintenance", "bg-warning-subtle border-warning border-dashed"],
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
  hours,
  nowX,
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
  hours: { key: string; x: number }[];
  nowX: number | null;
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
      <div
        className="border-border bg-surface sticky left-0 z-[5] flex shrink-0 items-center border-e px-3 py-2"
        style={{ width: NAME_PX }}
      >
        {title}
      </div>
      <div className="relative h-[4.5rem]" style={{ width: total }}>
        {segments.map((s) => (
          <div
            key={s.day}
            aria-hidden
            className={cn("border-border absolute top-0 h-full border-s", s.closed && "bg-surface-muted")}
            style={{ left: s.x, width: s.width }}
          />
        ))}
        {hours.map((h) => (
          <div
            key={h.key}
            aria-hidden
            className="bg-border absolute top-0 h-full w-px opacity-50"
            style={{ left: h.x }}
          />
        ))}
        {nowX !== null ? (
          <div aria-hidden className="bg-danger absolute top-0 z-[2] h-full w-0.5" style={{ left: nowX }} />
        ) : null}
        {blocks.map((b) => {
          const left = xOf(new Date(b.start).getTime());
          const width = Math.max(6, xOf(new Date(b.end).getTime()) - left);
          return (
            <Link
              key={b.maintenanceOrder.id}
              href={`/maintenance/${b.maintenanceOrder.id}`}
              className="border-warning bg-warning-subtle text-warning-subtle-fg absolute top-1.5 bottom-1.5 z-[3] overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-xs"
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
                "absolute top-2.5 bottom-2.5 z-[3] overflow-hidden rounded-md border px-1.5 py-1 text-start text-xs",
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
              <span className="flex items-center gap-1 truncate font-medium">
                {slot.locked ? <Icon name="lock" size={12} className="shrink-0" aria-label={t("locked")} /> : null}
                <span className="truncate">{tShared("numbered", { no: slot.seq, name: slot.name })}</span>
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
