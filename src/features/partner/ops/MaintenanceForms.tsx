"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { ActionBar } from "@/features/partner/erp/ActionBar";
import { useErpCall } from "@/features/partner/erp/call";
import { plainNumber, QTY_PATTERN } from "@/features/partner/erp/format";
import { type Line, LinesEditor, newLine, type PickItem } from "@/features/partner/erp/LinesEditor";
import { Select } from "@/features/partner/select";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

type MachineOption = { id: string; name: string };
type Warehouse = Pick<Schemas["ErpWarehouseDto"], "id" | "code" | "name" | "isDefault">;
type Priority = Schemas["ErpMaintenancePriority"];

const PRIORITIES = ["low", "normal", "high", "urgent"] as const satisfies readonly Priority[];
const MAX_PHOTOS = 10;
const key = () => crypto.randomUUID();

/** `datetime-local` value → ISO with Bangkok's offset, the form the contract takes. */
const isoOf = (local: string) => (local ? `${local}:00+07:00` : "");

/**
 * Report a breakdown (D-355): which machine, what is wrong, how urgent, and photos. The machine stops on
 * the schedule until the repair is done, and the factory is told.
 */
export function BreakdownForm({
  machines,
  initialMachineId,
}: {
  machines: MachineOption[];
  initialMachineId?: string;
}) {
  const t = useTranslations("partnerOps.maintenance");
  const tCommon = useTranslations("partnerErp.common");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [machineId, setMachineId] = useState(
    initialMachineId && machines.some((m) => m.id === initialMachineId) ? initialMachineId : "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("high");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ machine?: string; title?: string }>({});
  const [idempotencyKey] = useState(key);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      ...(machineId ? {} : { machine: t("form.machineRequired") }),
      ...(title.trim().length >= 3 ? {} : { title: t("form.subjectRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    const saved = await call(
      async () => {
        const uploaded = await Promise.all(files.map((file) => uploadFile("partner", file, "evidence", { factoryId })));
        return (
          await browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/breakdowns", {
            params: { path: { factoryId }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              machineId,
              title: title.trim(),
              description: description.trim() || null,
              priority,
              photoFileIds: uploaded.map((file) => file.id),
            },
          })
        ).data;
      },
      t("form.reported"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/maintenance/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("form.machine")} required requiredLabel={tCommon("required")} error={errors.machine}>
        <Select
          value={machineId || null}
          placeholder={t("form.machine")}
          onValueChange={setMachineId}
          options={machines.map((m) => ({ value: m.id, label: m.name }))}
        />
      </Field>
      <Field label={t("form.subject")} required requiredLabel={tCommon("required")} error={errors.title}>
        <Input
          value={title}
          maxLength={200}
          placeholder={t("form.subjectPlaceholder")}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label={t("priorities.label")}>
        <SegmentedControl
          label={t("priorities.label")}
          size="xl"
          value={priority}
          onValueChange={setPriority}
          options={PRIORITIES.map((p) => ({ value: p, label: t(`priorities.${p}`) }))}
        />
      </Field>
      <Field label={t("form.description")}>
        <Textarea
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Field label={t("form.photos")} hint={t("form.photosHint")}>
        <FileDropzone
          accept="image/*"
          multiple
          maxBytes={20 * 1024 * 1024}
          onFiles={(chosen) => setFiles((all) => [...all, ...chosen].slice(0, MAX_PHOTOS))}
          labels={{
            prompt: files.length ? t("form.chosen", { names: files.map((f) => f.name).join(", ") }) : t("form.drop"),
            browse: t("form.browse"),
            tooLarge: (name) => t("form.tooLarge", { name }),
            wrongType: (name) => t("form.wrongType", { name }),
          }}
        />
      </Field>
      <div>
        <Button type="submit" size="xl" variant="destructive-solid" iconStart="wrench" loading={busy}>
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
}

/**
 * A preventive plan (D-355): a cycle by days and/or pieces produced on the machine, how long it takes,
 * and the spare parts it uses. An order opens itself when the plan comes due.
 */
export function PlanForm({
  machines,
  items,
  locale,
  plan,
  etag,
  initialMachineId,
}: {
  machines: MachineOption[];
  items: PickItem[];
  locale: string;
  plan?: Schemas["ErpMaintenancePlanDto"];
  etag?: string | null;
  initialMachineId?: string;
}) {
  const t = useTranslations("partnerOps.maintenance.planForm");
  const tCommon = useTranslations("partnerErp.common");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [machineId, setMachineId] = useState(plan?.machine.id ?? initialMachineId ?? "");
  const [title, setTitle] = useState(plan?.title ?? "");
  const [instructions, setInstructions] = useState(plan?.instructions ?? "");
  const [everyDays, setEveryDays] = useState(plan?.everyDays ? String(plan.everyDays) : "");
  const [everyImpressions, setEveryImpressions] = useState(plan?.everyImpressions ? String(plan.everyImpressions) : "");
  const [duration, setDuration] = useState(String(plan?.durationMinutes ?? 60));
  const [active, setActive] = useState(plan ? plan.status === "active" : true);
  const [lines, setLines] = useState<Line[]>(
    plan?.parts.length
      ? plan.parts.map((p) => newLine({ itemId: p.item.id, quantity: p.quantity.replace(/\.?0+$/, "") }))
      : [],
  );
  const [errors, setErrors] = useState<{ machine?: string; title?: string; interval?: string }>({});

  const whole = (value: string) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const days = whole(everyDays);
    const pieces = whole(everyImpressions);
    const next = {
      ...(machineId ? {} : { machine: t("machine") }),
      ...(title.trim().length >= 2 ? {} : { title: t("titleRequired") }),
      ...(days || pieces ? {} : { interval: t("intervalRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    const parts = lines
      .filter((line) => line.itemId && QTY_PATTERN.test(plainNumber(line.quantity)))
      .map((line) => ({ itemId: line.itemId, quantity: plainNumber(line.quantity) }));
    const body: Schemas["ErpSaveMaintenancePlanDto"] = {
      machineId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      everyDays: days,
      everyImpressions: pieces,
      durationMinutes: whole(duration) ?? 60,
      parts,
      status: active ? "active" : "archived",
    };
    const saved = await call(
      async () =>
        plan
          ? (
              await browserApi().PUT("/v1/partner/factories/{factoryId}/erp/maintenance/plans/{planId}", {
                params: { path: { factoryId, planId: plan.id }, header: { "If-Match": etag ?? "*" } },
                body,
              })
            ).data
          : (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/plans", {
                params: { path: { factoryId } },
                body,
              })
            ).data,
      t("saved"),
      { refresh: false },
    );
    if (saved) {
      router.push(`/maintenance/plans/${saved.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("machine")} required requiredLabel={tCommon("required")} error={errors.machine}>
        <Select
          value={machineId || null}
          placeholder={t("machine")}
          onValueChange={setMachineId}
          options={machines.map((m) => ({ value: m.id, label: m.name }))}
        />
      </Field>
      <Field label={t("title")} required requiredLabel={tCommon("required")} error={errors.title}>
        <Input
          value={title}
          maxLength={200}
          placeholder={t("titlePlaceholder")}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label={t("instructions")}>
        <Textarea
          rows={4}
          maxLength={4000}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("everyDays")} error={errors.interval} hint={t("intervalHint")}>
          <NumberInput min={1} step={1} value={everyDays} onChange={(event) => setEveryDays(event.target.value)} />
        </Field>
        <Field label={t("everyImpressions")}>
          <NumberInput
            min={1}
            step={1}
            value={everyImpressions}
            onChange={(event) => setEveryImpressions(event.target.value)}
          />
        </Field>
        <Field label={t("duration")}>
          <NumberInput min={1} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("parts")}</legend>
        {lines.length ? (
          <LinesEditor items={items} lines={lines} onChange={setLines} locale={locale} quantityLabel={t("quantity")} />
        ) : (
          <div>
            <Button
              variant="secondary"
              size="sm"
              iconStart="plus"
              onClick={() => setLines((all) => [...all, newLine()])}
            >
              {t("addPart")}
            </Button>
          </div>
        )}
      </fieldset>
      {plan ? <Checkbox label={t("active")} checked={active} onCheckedChange={(c) => setActive(c === true)} /> : null}
      <div>
        <Button type="submit" size="lg" iconStart="save" loading={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Open a plan's maintenance order now, ahead of its cycle. */
export function OpenPlanButton({ planId }: { planId: string }) {
  const t = useTranslations("partnerOps.maintenance.plans");
  const router = useRouter();
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  return (
    <Button
      iconStart="wrench"
      loading={busy}
      onClick={async () => {
        const saved = await call(
          async () =>
            (
              await browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/plans/{planId}/actions/open", {
                params: { path: { factoryId, planId }, header: { "Idempotency-Key": key() } },
              })
            ).data,
          t("opened"),
          { refresh: false },
        );
        if (saved) router.push(`/maintenance/${saved.id}`);
      }}
    >
      {t("openNow")}
    </Button>
  );
}

type Dialogs = "schedule" | "parts" | "finish" | null;

/**
 * A maintenance order's actions (D-355), as its `nextActions` offer them: set a window the schedule
 * keeps free, start, issue spare parts from stock, finish with what was done, or cancel with a reason.
 */
export function MtActions({
  order,
  items,
  warehouses,
  locale,
}: {
  order: Schemas["ErpMaintenanceOrderDto"];
  items: PickItem[];
  warehouses: Warehouse[];
  locale: string;
}) {
  const t = useTranslations("partnerOps.maintenance.actions");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const { call, busy } = useErpCall();
  const [open, setOpen] = useState<Dialogs>(null);
  const offered = new Set(order.nextActions.filter((a) => !a.disabledReason).map((a) => a.key));
  const path = { factoryId, mtId: order.id };
  const [idempotencyKey, setKey] = useState(key);
  const close = () => {
    setOpen(null);
    setKey(key());
  };

  const [from, setFrom] = useState(() =>
    order.scheduledStart ? order.scheduledStart.slice(0, 16) : `${bangkokToday(1)}T08:00`,
  );
  const [to, setTo] = useState(() =>
    order.scheduledEnd ? order.scheduledEnd.slice(0, 16) : `${bangkokToday(1)}T10:00`,
  );
  const [windowError, setWindowError] = useState<string | undefined>();
  const main = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(main?.id ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    order.plannedParts.length && !order.parts.length
      ? order.plannedParts.map((p) => newLine({ itemId: p.item.id, quantity: p.quantity.replace(/\.?0+$/, "") }))
      : [newLine()],
  );
  const [resolution, setResolution] = useState("");
  const [resolutionError, setResolutionError] = useState<string | undefined>();
  const [downtime, setDowntime] = useState("");

  return (
    <div className="flex flex-wrap gap-2">
      {offered.has("erp_mt.schedule") ? (
        <Button variant="secondary" iconStart="calendar" onClick={() => setOpen("schedule")}>
          {t("schedule")}
        </Button>
      ) : null}
      {offered.has("erp_mt.parts") ? (
        <Button variant="secondary" iconStart="package" onClick={() => setOpen("parts")}>
          {t("parts")}
        </Button>
      ) : null}
      {offered.has("erp_mt.finish") ? (
        <Button iconStart="check" onClick={() => setOpen("finish")}>
          {t("finish")}
        </Button>
      ) : null}
      <ActionBar
        offered={order.nextActions}
        failed={tCommon("failed")}
        actions={[
          {
            key: "erp_mt.start",
            label: t("start"),
            icon: "wrench",
            confirm: {
              title: t("startTitle", { no: order.mtNo }),
              body: t("startBody"),
              confirmLabel: t("startConfirm"),
            },
            run: ({ idempotencyKey: k }) =>
              browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/start", {
                params: { path, header: { "Idempotency-Key": k } },
              }),
            done: t("started"),
          },
          {
            key: "erp_mt.cancel",
            label: t("cancel"),
            icon: "ban",
            variant: "destructive",
            confirm: {
              title: t("cancelTitle", { no: order.mtNo }),
              body: t("cancelBody"),
              confirmLabel: t("cancelConfirm"),
              destructive: true,
              reason: { label: t("reason"), required: true, placeholder: t("reasonPlaceholder") },
            },
            run: ({ idempotencyKey: k, reason }) =>
              browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/cancel", {
                params: { path, header: { "Idempotency-Key": k } },
                body: { reason },
              }),
            done: t("cancelled"),
          },
        ]}
      />

      {open === "schedule" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={t("scheduleTitle")}
          description={t("scheduleBody")}
          closeLabel={tCommon("cancel")}
          footer={
            <Button
              iconStart="save"
              loading={busy}
              onClick={async () => {
                if (!from || !to || to <= from) {
                  setWindowError(t("windowInvalid"));
                  return;
                }
                const ok = await call(
                  () =>
                    browserApi().POST(
                      "/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/schedule",
                      {
                        params: { path, header: { "Idempotency-Key": idempotencyKey } },
                        body: { start: isoOf(from), end: isoOf(to) },
                      },
                    ),
                  t("scheduled"),
                );
                if (ok) close();
              }}
            >
              {t("schedule")}
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("from")} error={windowError}>
              <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label={t("to")}>
              <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}

      {open === "parts" ? (
        <Dialog
          open
          size="lg"
          onOpenChange={(o) => !o && close()}
          title={t("partsTitle", { no: order.mtNo })}
          closeLabel={tCommon("cancel")}
          footer={
            <Button
              iconStart="package"
              loading={busy}
              onClick={async () => {
                const picked = lines.filter((line) => line.itemId && QTY_PATTERN.test(plainNumber(line.quantity)));
                if (!picked.length) return;
                const ok = await call(
                  () =>
                    browserApi().POST("/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/parts", {
                      params: { path, header: { "Idempotency-Key": idempotencyKey } },
                      body: {
                        ...(warehouseId ? { warehouseId } : {}),
                        lines: picked.map((line) => ({ itemId: line.itemId, quantity: plainNumber(line.quantity) })),
                      },
                    }),
                  t("partsSaved"),
                );
                if (ok) {
                  setLines([newLine()]);
                  close();
                }
              }}
            >
              {t("parts")}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {warehouses.length > 1 ? (
              <Field label={t("warehouse")}>
                <Select
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name, description: w.code }))}
                />
              </Field>
            ) : null}
            <LinesEditor items={items} lines={lines} onChange={setLines} locale={locale} />
          </div>
        </Dialog>
      ) : null}

      {open === "finish" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={t("finishTitle", { no: order.mtNo })}
          closeLabel={tCommon("cancel")}
          footer={
            <Button
              iconStart="check"
              loading={busy}
              onClick={async () => {
                if (resolution.trim().length < 3) {
                  setResolutionError(t("resolutionRequired"));
                  return;
                }
                const minutes = Number.parseInt(downtime, 10);
                const ok = await call(
                  () =>
                    browserApi().POST(
                      "/v1/partner/factories/{factoryId}/erp/maintenance/orders/{mtId}/actions/finish",
                      {
                        params: { path, header: { "Idempotency-Key": idempotencyKey } },
                        body: {
                          resolution: resolution.trim(),
                          downtimeMinutes: Number.isFinite(minutes) && minutes >= 0 ? minutes : null,
                        },
                      },
                    ),
                  t("finished"),
                );
                if (ok) close();
              }}
            >
              {t("finish")}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label={t("resolution")} required requiredLabel={tCommon("required")} error={resolutionError}>
              <Textarea
                rows={3}
                maxLength={2000}
                placeholder={t("resolutionPlaceholder")}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            </Field>
            <Field label={t("downtime")} hint={t("downtimeHint")}>
              <NumberInput min={0} step={1} value={downtime} onChange={(event) => setDowntime(event.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
