"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber, trimZeros } from "@/features/partner/erp/format";
import { erpDelete, erpPost, erpSave } from "@/features/partner/sales/api";
import { SalesActions } from "@/features/partner/sales/SalesActions";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

type Shift = Schemas["ErpShiftDto"];
type Skill = Schemas["ErpOperatorSkillDto"];
type Rate = Schemas["ErpMachineRateDto"];
type Grant = Schemas["ErpSupportGrantDto"];
type Level = Schemas["ErpSkillLevel"];
type Option = { id: string; label: string };
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

function useRun() {
  const t = useTranslations("partnerInsight.common");
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  async function run<T>(work: () => Promise<T>, done: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await work();
      toast.success(done);
      refresh();
      return result;
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? t("stale") : problemMessage(error, t("failed")));
      if (stale) refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

// ------------------------------------------------------------------------------------ machine rates

/** D-376: each machine's hourly cost — what a run minute on it adds to a job. */
export function MachineRates({ rates, canEdit }: { rates: Rate[]; canEdit: boolean }) {
  const t = useTranslations("partnerInsight.rates");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  async function save(machineId: string) {
    if (!MONEY.test(plainNumber(value))) {
      toast.error(t("invalid"));
      return;
    }
    const done = await run(
      () =>
        erpSave(
          "PUT",
          factoryId,
          "/machine-rates/{machineId}",
          { machineId },
          { hourlyRate: plainNumber(value), note: note.trim() || null },
          null,
        ),
      t("saved"),
    );
    if (done) setEditing(null);
  }

  return (
    <ul className="border-border divide-border divide-y rounded-xl border">
      {rates.map((r) => (
        <li key={r.machine.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{r.machine.name}</p>
            {r.note ? <p className="text-muted text-sm">{r.note}</p> : null}
          </div>
          {editing === r.machine.id ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("rate")}>
                <NumberInput
                  min={0}
                  step="any"
                  unit={t("perHour")}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-36"
                />
              </Field>
              <Field label={t("note")}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-48" />
              </Field>
              <Button size="lg" loading={busy} onClick={() => void save(r.machine.id)}>
                {t("save")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setEditing(null)}>
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {r.hourlyRate ? (
                  t("value", { rate: format.thb(r.hourlyRate) })
                ) : (
                  <Badge tone="warning">{t("notSet")}</Badge>
                )}
              </span>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="edit"
                  onClick={() => {
                    setEditing(r.machine.id);
                    setValue(trimZeros(r.hourlyRate));
                    setNote(r.note ?? "");
                  }}
                >
                  {t("edit")}
                </Button>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------ shifts

/** D-380: a shift — name, hours (past midnight allowed) and days; OEE plans its time from them. */
export function ShiftDialog({ shift, onClose }: { shift?: Shift; onClose: () => void }) {
  const t = useTranslations("partnerInsight.people.shifts");
  const tDay = useTranslations("partnerInsight.days");
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [name, setName] = useState(shift?.name ?? "");
  const [start, setStart] = useState(shift?.startTime ?? "08:00");
  const [end, setEnd] = useState(shift?.endTime ?? "17:00");
  const [days, setDays] = useState<number[]>(shift?.days ?? [1, 2, 3, 4, 5, 6]);
  const [note, setNote] = useState(shift?.note ?? "");
  const [archived, setArchived] = useState(shift?.status === "archived");
  const [error, setError] = useState<string>();

  async function save() {
    if (!name.trim() || !HHMM.test(start) || !HHMM.test(end) || !days.length) {
      setError(t("invalid"));
      return;
    }
    const body = {
      name: name.trim(),
      startTime: start,
      endTime: end,
      days,
      note: note.trim() || null,
      ...(shift ? { status: archived ? "archived" : "active" } : {}),
    };
    const done = await run(
      () =>
        shift
          ? erpSave("PUT", factoryId, "/shifts/{shiftId}", { shiftId: shift.id }, body, "*")
          : erpPost(factoryId, "/shifts", {}, body),
      t("saved"),
    );
    if (done) onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={shift ? t("editTitle", { name: shift.name }) : t("addTitle")}
      closeLabel={t("close")}
      footer={
        <Button iconStart="save" loading={busy} onClick={() => void save()}>
          {t("save")}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Field label={t("name")} required>
          <Input value={name} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("start")}>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t("end")} hint={t("endHint")}>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("days")}</legend>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((d) => (
              <Checkbox
                key={d}
                label={tDay(String(d))}
                checked={days.includes(d)}
                onCheckedChange={(on) =>
                  setDays(on === true ? [...new Set([...days, d])] : days.filter((x) => x !== d))
                }
              />
            ))}
          </div>
        </fieldset>
        <Field label={t("note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {shift ? (
          <Checkbox label={t("archive")} checked={archived} onCheckedChange={(on) => setArchived(on === true)} />
        ) : null}
        {error ? <p className="text-danger text-sm">{error}</p> : null}
      </div>
    </Dialog>
  );
}

/** The page's shift list with add / edit (D-380). */
export function ShiftManager({ shifts, canEdit }: { shifts: Shift[]; canEdit: boolean }) {
  const t = useTranslations("partnerInsight.people.shifts");
  const tDay = useTranslations("partnerInsight.days");
  const [open, setOpen] = useState<Shift | "new" | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {shifts.length ? (
        <ul className="border-border divide-border divide-y rounded-xl border">
          {shifts.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.name} {s.status === "archived" ? <Badge tone="neutral">{t("archived")}</Badge> : null}
                </p>
                <p className="text-muted text-sm">
                  {t("hours", {
                    start: s.startTime,
                    end: s.endTime,
                    hours: (s.minutes / 60).toFixed(1).replace(/\.0$/, ""),
                  })}{" "}
                  · {s.days.map((d) => tDay(String(d))).join(" ")}
                  {s.note ? ` · ${s.note}` : ""}
                </p>
              </div>
              {canEdit ? (
                <Button size="sm" variant="secondary" iconStart="edit" onClick={() => setOpen(s)}>
                  {t("edit")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t("empty")}</p>
      )}
      {canEdit ? (
        <Button variant="secondary" iconStart="plus" className="self-start" onClick={() => setOpen("new")}>
          {t("add")}
        </Button>
      ) : null}
      {open ? <ShiftDialog shift={open === "new" ? undefined : open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/** D-380: who can run which machine, and how well. */
export function SkillManager({
  skills,
  people,
  machines,
  canEdit,
}: {
  skills: Skill[];
  people: Option[];
  machines: Option[];
  canEdit: boolean;
}) {
  const t = useTranslations("partnerInsight.people.skills");
  const tLevel = useTranslations("partnerInsight.levels");
  const format = useFormat();
  const { factoryId } = useFactory();
  const { run, busy } = useRun();
  const [userId, setUserId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [level, setLevel] = useState<Level>("competent");
  const [certified, setCertified] = useState("");

  async function save() {
    if (!userId || !machineId) {
      toast.error(t("pick"));
      return;
    }
    await run(
      () =>
        erpSave(
          "PUT",
          factoryId,
          "/operator-skills",
          {},
          { userId, machineId, level, certifiedOn: certified || null },
          null,
        ),
      t("saved"),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {skills.length ? (
        <ul className="border-border divide-border divide-y rounded-xl border">
          {skills.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.user.name}</p>
                <p className="text-muted text-sm">
                  {s.machine.name}
                  {s.certifiedOn ? ` · ${t("certified", { date: format.date(s.certifiedOn) })}` : ""}
                </p>
              </div>
              <Badge tone={s.level === "expert" ? "success" : s.level === "competent" ? "info" : "neutral"}>
                {tLevel(s.level)}
              </Badge>
              {canEdit ? (
                <IconButton
                  name="trash"
                  size="sm"
                  label={t("remove", { name: s.user.name, machine: s.machine.name })}
                  onClick={() =>
                    void run(() => erpDelete(factoryId, "/operator-skills/{skillId}", { skillId: s.id }), t("removed"))
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t("empty")}</p>
      )}
      {canEdit ? (
        <div className="border-border grid gap-3 rounded-xl border p-4 md:grid-cols-4">
          <Field label={t("person")}>
            <Select
              value={userId || null}
              placeholder={t("choose")}
              onValueChange={setUserId}
              options={people.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Field>
          <Field label={t("machine")}>
            <Select
              value={machineId || null}
              placeholder={t("choose")}
              onValueChange={setMachineId}
              options={machines.map((m) => ({ value: m.id, label: m.label }))}
            />
          </Field>
          <Field label={t("level")}>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as Level)}
              options={(["learner", "competent", "expert"] as const).map((l) => ({ value: l, label: tLevel(l) }))}
            />
          </Field>
          <Field label={t("certifiedOn")}>
            <Input type="date" value={certified} onChange={(e) => setCertified(e.target.value)} />
          </Field>
          <Button iconStart="save" loading={busy} className="self-start md:col-span-4" onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------- support grants

/** D-381: the owner lets getpack support read the dashboard and settings for a few days, and sees every read. */
export function SupportGrants({ grants }: { grants: Grant[] }) {
  const t = useTranslations("partnerInsight.support");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useRun();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("3");
  const [key, setKey] = useState(newIdempotencyKey);
  const active = grants.find((g) => g.active);

  async function grant() {
    const n = Number.parseInt(days, 10);
    if (reason.trim().length < 3 || !(n >= 1 && n <= 7)) {
      toast.error(t("invalid"));
      return;
    }
    const done = await run(
      () => erpPost(factoryId, "/support-grants", {}, { reason: reason.trim(), days: n }, { idempotencyKey: key }),
      t("granted"),
    );
    if (done) {
      setReason("");
      setKey(newIdempotencyKey());
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {active ? (
        <div className="border-warning bg-warning-subtle flex flex-col gap-2 rounded-xl border p-4">
          <p className="font-medium">{t("activeTitle", { until: format.dateTime(active.expiresAt) })}</p>
          <p className="text-sm">{active.reason}</p>
          <SalesActions
            offered={active.nextActions}
            actions={[
              {
                key: "erp_support.revoke",
                kind: "post",
                path: "/support-grants/{grantId}/actions/revoke",
                params: { grantId: active.id },
                body: (r) => ({ reason: r }),
                title: t("revokeTitle"),
                description: t("revokeBody"),
                reason: { label: t("reason"), placeholder: t("revokePlaceholder") },
                done: t("revoked"),
              },
            ]}
          />
        </div>
      ) : (
        <div className="border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_10rem]">
          <Field label={t("reason")} hint={t("reasonHint")}>
            <Textarea
              rows={2}
              value={reason}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field label={t("days")} hint={t("daysHint")}>
            <SegmentedControl
              label={t("days")}
              size="md"
              value={days}
              onValueChange={setDays}
              options={["1", "3", "7"].map((d) => ({ value: d, label: t("dayCount", { n: Number(d) }) }))}
            />
          </Field>
          <Button iconStart="shield" loading={busy} className="self-start" onClick={() => void grant()}>
            {t("grant")}
          </Button>
        </div>
      )}
      {grants.length ? (
        <ul className="border-border divide-border divide-y rounded-xl border">
          {grants.map((g) => (
            <li key={g.id} className="flex flex-col gap-1 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {g.reason}
                <Badge tone={g.active ? "warning" : "neutral"}>
                  {g.active ? t("active") : g.revokedAt ? t("revokedBadge") : t("expired")}
                </Badge>
              </p>
              <p className="text-muted text-sm">
                {t("line", {
                  by: g.grantedBy,
                  at: format.dateTime(g.createdAt),
                  until: format.dateTime(g.expiresAt),
                  views: g.viewCount,
                })}
              </p>
              {g.views.length ? (
                <ul className="text-muted list-disc ps-5 text-sm">
                  {g.views.slice(0, 5).map((v) => (
                    <li key={`${g.id}-${v.at}`}>{t("view", { staff: v.staff, at: format.dateTime(v.at) })}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
