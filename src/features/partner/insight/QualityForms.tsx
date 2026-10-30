"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { FormColumns, FormSummary, SummaryRows } from "@/features/partner/form-layout";
import { plainNumber, trimZeros } from "@/features/partner/erp/format";
import { erpPost, erpSave } from "@/features/partner/sales/api";
import { SalesActions } from "@/features/partner/sales/SalesActions";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { uploadFile } from "@/features/shared/files/upload";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import Link from "next/link";
import { Field, FormSection } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { IconButton } from "@/ui/components/IconButton";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

type Template = Schemas["ErpInspectionTemplateDto"];
type Check = Schemas["ErpQualityCheckDto"];
type Ncr = Schemas["ErpNcrDto"];
type Kind = Schemas["ErpCheckKind"];
type PointType = Schemas["ErpCheckpointType"];
type Option = { id: string; label: string; hint?: string | null };

export const CHECK_KINDS: Kind[] = ["incoming", "in_process", "final", "other"];
const POINT_TYPES: PointType[] = ["measurement", "pass_fail", "note"];
const NUM = /^-?\d{1,10}(\.\d{1,4})?$/;
const QTY = /^\d{1,11}(\.\d{1,3})?$/;
const SOURCES: Schemas["ErpNcrSource"][] = [
  "customer_complaint",
  "internal",
  "production_order",
  "goods_receipt",
  "quality_check",
];
const SEVERITIES: Schemas["DefectSeverity"][] = ["minor", "major", "critical"];
const DISPOSITIONS: Schemas["ErpNcrDisposition"][] = ["rework", "scrap", "return_to_supplier", "use_as_is", "hold"];

function useSave() {
  const t = useTranslations("partnerInsight.common");
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  async function run<T>(work: () => Promise<T>, done: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await work();
      toast.success(done);
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

// ========================================================================================= templates

interface PointDraft {
  key: string;
  name: string;
  type: PointType;
  unit: string;
  minValue: string;
  maxValue: string;
  targetValue: string;
  instruction: string;
}
let seq = 0;
const newPoint = (patch: Partial<PointDraft> = {}): PointDraft => ({
  key: `p-${(seq += 1)}`,
  name: "",
  type: "pass_fail",
  unit: "",
  minValue: "",
  maxValue: "",
  targetValue: "",
  instruction: "",
  ...patch,
});

/** An inspection template (D-373): its kind, item and the ordered checkpoints a check copies. */
export function TemplateForm({
  template,
  etag,
  items,
}: {
  template?: Template;
  etag?: string | null;
  items: Option[];
}) {
  const t = useTranslations("partnerInsight.templates");
  const tKind = useTranslations("partnerInsight.kinds");
  const tType = useTranslations("partnerInsight.pointTypes");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<Kind>(template?.kind ?? "final");
  const [itemId, setItemId] = useState(template?.item?.id ?? "");
  const [hint, setHint] = useState(template?.sampleSizeHint ?? "");
  const [note, setNote] = useState(template?.note ?? "");
  const [archived, setArchived] = useState(template?.status === "archived");
  const [points, setPoints] = useState<PointDraft[]>(() =>
    template?.checkpoints.length
      ? template.checkpoints.map((c) =>
          newPoint({
            name: c.name,
            type: c.type,
            unit: c.unit ?? "",
            minValue: trimZeros(c.minValue),
            maxValue: trimZeros(c.maxValue),
            targetValue: trimZeros(c.targetValue),
            instruction: c.instruction ?? "",
          }),
        )
      : [newPoint({ type: "measurement" }), newPoint()],
  );
  const [error, setError] = useState<string>();
  const update = (i: number, patch: Partial<PointDraft>) =>
    setPoints(points.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function save() {
    const bad = points.some(
      (p) =>
        !p.name.trim() ||
        (p.type === "measurement" &&
          [p.minValue, p.maxValue, p.targetValue].some((v) => v.trim() !== "" && !NUM.test(plainNumber(v)))),
    );
    if (!name.trim() || bad || !points.length) {
      setError(t("invalid"));
      return;
    }
    setError(undefined);
    const body = {
      name: name.trim(),
      kind,
      itemId: itemId || null,
      sampleSizeHint: hint.trim() || null,
      note: note.trim() || null,
      ...(template ? { status: archived ? "archived" : "active" } : {}),
      checkpoints: points.map((p) => ({
        name: p.name.trim(),
        type: p.type,
        unit: p.unit.trim() || null,
        minValue: p.type === "measurement" && p.minValue.trim() ? plainNumber(p.minValue) : null,
        maxValue: p.type === "measurement" && p.maxValue.trim() ? plainNumber(p.maxValue) : null,
        targetValue: p.type === "measurement" && p.targetValue.trim() ? plainNumber(p.targetValue) : null,
        instruction: p.instruction.trim() || null,
      })),
    };
    const saved = await run(
      () =>
        template
          ? erpSave<{ id: string }>(
              "PUT",
              factoryId,
              "/inspection-templates/{templateId}",
              { templateId: template.id },
              body,
              etag,
            )
          : erpPost<{ id: string }>(factoryId, "/inspection-templates", {}, body),
      t("saved"),
    );
    if (saved) {
      router.push("/quality/templates");
      router.refresh();
    }
  }

  const tChecks = useTranslations("partnerInsight.checks");
  const tSections = useTranslations("partnerErp.common.sections");
  return (
    <FormColumns
      aside={
        <FormSummary
          title={tSections("summary")}
          action={
            <Button size="xl" iconStart="save" loading={busy} onClick={() => void save()}>
              {t("save")}
            </Button>
          }
        >
          <SummaryRows
            rows={[
              { key: "kind", label: t("kind"), value: tKind(kind) },
              {
                key: "item",
                label: t("item"),
                value: itemId ? (items.find((i) => i.id === itemId)?.label ?? "") : t("anyItem"),
              },
              { key: "points", label: t("points"), value: String(points.filter((p) => p.name.trim()).length) },
            ]}
          />
          {template ? (
            <SegmentedControl
              label={t("status")}
              size="md"
              value={archived ? "archived" : "active"}
              onValueChange={(v) => setArchived(v === "archived")}
              options={[
                { value: "active", label: t("active") },
                { value: "archived", label: t("archived") },
              ]}
            />
          ) : null}
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {template && template.status === "active" ? (
            <Button asChild variant="secondary" iconStart="clipboard-check">
              <Link href={`/quality/new?kind=${template.kind}&templateId=${template.id}`}>{tChecks("new")}</Link>
            </Button>
          ) : null}
        </FormSummary>
      }
    >
      <FormSection card step={1} title={tSections("details")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("name")} required>
            <Input value={name} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("kind")}>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as Kind)}
              options={CHECK_KINDS.map((k) => ({ value: k, label: tKind(k) }))}
            />
          </Field>
          <Field label={t("item")} hint={t("itemHint")}>
            <Select
              value={itemId || null}
              placeholder={t("anyItem")}
              onValueChange={setItemId}
              options={[
                { value: "", label: t("anyItem") },
                ...items.map((i) => ({ value: i.id, label: i.label, description: i.hint ?? undefined })),
              ]}
            />
          </Field>
          <Field label={t("sampleHint")}>
            <Input value={hint} placeholder={t("sampleHintPlaceholder")} onChange={(e) => setHint(e.target.value)} />
          </Field>
        </div>
        <Field label={t("note")}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormSection>
      <FormSection card step={2} title={t("points")}>
        <ol className="flex flex-col gap-3">
          {points.map((p, i) => (
            <li key={p.key} className="border-border bg-surface-subtle rounded-lg border p-3 md:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-muted text-sm font-medium">{t("point", { n: i + 1 })}</span>
                <span className="flex gap-1">
                  <IconButton
                    name="chevron-up"
                    size="sm"
                    label={t("up", { n: i + 1 })}
                    disabled={i === 0}
                    onClick={() => setPoints(points.map((x, j) => (j === i - 1 ? p : j === i ? points[i - 1]! : x)))}
                  />
                  {points.length > 1 ? (
                    <IconButton
                      name="trash"
                      size="sm"
                      label={t("remove", { n: i + 1 })}
                      onClick={() => setPoints(points.filter((_, j) => j !== i))}
                    />
                  ) : null}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <Field label={t("pointName")}>
                  <Input
                    value={p.name}
                    placeholder={t("pointNamePlaceholder")}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </Field>
                <Field label={t("pointType")}>
                  <Select
                    value={p.type}
                    onValueChange={(v) => update(i, { type: v as PointType })}
                    options={POINT_TYPES.map((x) => ({ value: x, label: tType(x) }))}
                  />
                </Field>
              </div>
              {p.type === "measurement" ? (
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Field label={t("unit")}>
                    <Input
                      value={p.unit}
                      placeholder={t("unitPlaceholder")}
                      onChange={(e) => update(i, { unit: e.target.value })}
                    />
                  </Field>
                  <Field label={t("min")}>
                    <NumberInput
                      step="any"
                      value={p.minValue}
                      onChange={(e) => update(i, { minValue: e.target.value })}
                    />
                  </Field>
                  <Field label={t("max")}>
                    <NumberInput
                      step="any"
                      value={p.maxValue}
                      onChange={(e) => update(i, { maxValue: e.target.value })}
                    />
                  </Field>
                  <Field label={t("target")}>
                    <NumberInput
                      step="any"
                      value={p.targetValue}
                      onChange={(e) => update(i, { targetValue: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
              <div className="mt-3">
                <Field label={t("instruction")}>
                  <Input
                    value={p.instruction}
                    placeholder={t("instructionPlaceholder")}
                    onChange={(e) => update(i, { instruction: e.target.value })}
                  />
                </Field>
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          iconStart="plus"
          className="self-start"
          onClick={() => setPoints([...points, newPoint()])}
        >
          {t("addPoint")}
        </Button>
      </FormSection>
    </FormColumns>
  );
}

// =========================================================================================== checks

/** Starts a check (D-372): what is checked — a receipt line, a production order or an item — and its template. */
export function CheckStartForm({
  templates,
  items,
  orders,
  receipts,
  initial,
}: {
  templates: (Option & { kind: Kind; itemId: string | null })[];
  items: Option[];
  orders: Option[];
  receipts: Option[];
  initial: { kind?: Kind; productionOrderId?: string; goodsReceiptId?: string; itemId?: string; templateId?: string };
}) {
  const t = useTranslations("partnerInsight.checks.start");
  const tKind = useTranslations("partnerInsight.kinds");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [kind, setKind] = useState<Kind>(initial.kind ?? (initial.goodsReceiptId ? "incoming" : "final"));
  const [templateId, setTemplateId] = useState(initial.templateId ?? "");
  const [orderId, setOrderId] = useState(initial.productionOrderId ?? "");
  const [receiptId, setReceiptId] = useState(initial.goodsReceiptId ?? "");
  const [lineNo, setLineNo] = useState("1");
  const [itemId, setItemId] = useState(initial.itemId ?? "");
  const [lotNo, setLotNo] = useState("");
  const [sample, setSample] = useState("");
  const [qty, setQty] = useState("");
  const [key] = useState(newIdempotencyKey);
  const usable = templates.filter((x) => x.kind === kind && (!x.itemId || !itemId || x.itemId === itemId));

  async function start() {
    const created = await run(
      () =>
        erpPost<{ id: string }>(
          factoryId,
          "/quality-checks",
          {},
          {
            kind,
            ...(templateId ? { templateId } : {}),
            ...(kind === "incoming" && receiptId
              ? { goodsReceiptId: receiptId, lineNo: Number.parseInt(lineNo, 10) || 1 }
              : {}),
            ...(kind !== "incoming" && orderId ? { productionOrderId: orderId } : {}),
            ...(itemId ? { itemId } : {}),
            lotNo: lotNo.trim() || null,
            sampleSize: sample.trim() ? plainNumber(sample) : null,
            inspectedQty: qty.trim() ? plainNumber(qty) : null,
          },
          { idempotencyKey: key },
        ),
      t("started"),
    );
    if (created) router.push(`/quality/${created.id}`);
  }

  const tSections = useTranslations("partnerErp.common.sections");
  const documentLabel =
    kind === "incoming"
      ? (receipts.find((r) => r.id === receiptId)?.label ?? "")
      : (orders.find((o) => o.id === orderId)?.label ?? "");
  return (
    <FormColumns
      aside={
        <FormSummary
          title={tSections("summary")}
          action={
            <Button size="xl" iconStart="clipboard-check" loading={busy} onClick={() => void start()}>
              {t("submit")}
            </Button>
          }
        >
          <SummaryRows
            rows={[
              { key: "kind", label: t("kind"), value: tKind(kind) },
              { key: "doc", label: kind === "incoming" ? t("receipt") : t("order"), value: documentLabel },
              { key: "item", label: t("item"), value: items.find((i) => i.id === itemId)?.label ?? "" },
              {
                key: "template",
                label: t("template"),
                value: usable.find((x) => x.id === templateId)?.label ?? t("withoutTemplate"),
              },
            ]}
          />
        </FormSummary>
      }
    >
      <FormSection card step={1} title={tSections("details")}>
        <SegmentedControl
          label={t("kind")}
          size="md"
          value={kind}
          onValueChange={(v) => {
            setKind(v);
            setTemplateId("");
          }}
          options={CHECK_KINDS.map((k) => ({ value: k, label: tKind(k) }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {kind === "incoming" ? (
            <>
              <Field label={t("receipt")} hint={t("receiptHint")}>
                <Select
                  value={receiptId || null}
                  placeholder={t("choose")}
                  onValueChange={setReceiptId}
                  options={receipts.map((r) => ({ value: r.id, label: r.label, description: r.hint ?? undefined }))}
                />
              </Field>
              <Field label={t("lineNo")}>
                <NumberInput min={1} step={1} value={lineNo} onChange={(e) => setLineNo(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label={t("order")} hint={t("orderHint")}>
              <Select
                value={orderId || null}
                placeholder={t("noOrder")}
                onValueChange={setOrderId}
                options={[
                  { value: "", label: t("noOrder") },
                  ...orders.map((o) => ({ value: o.id, label: o.label, description: o.hint ?? undefined })),
                ]}
              />
            </Field>
          )}
          <Field label={t("item")} hint={t("itemHint")}>
            <Select
              value={itemId || null}
              placeholder={t("fromDocument")}
              onValueChange={setItemId}
              options={[
                { value: "", label: t("fromDocument") },
                ...items.map((i) => ({ value: i.id, label: i.label, description: i.hint ?? undefined })),
              ]}
            />
          </Field>
          <Field label={t("template")} hint={usable.length ? undefined : t("noTemplate")}>
            <Select
              value={templateId || null}
              placeholder={t("withoutTemplate")}
              onValueChange={setTemplateId}
              options={[
                { value: "", label: t("withoutTemplate") },
                ...usable.map((x) => ({ value: x.id, label: x.label })),
              ]}
            />
          </Field>
        </div>
      </FormSection>
      <FormSection card step={2} title={tSections("quantities")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("lotNo")}>
            <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
          </Field>
          <Field label={t("sample")}>
            <NumberInput min={0} step="any" value={sample} onChange={(e) => setSample(e.target.value)} />
          </Field>
          <Field label={t("inspectedQty")} hint={t("inspectedQtyHint")}>
            <NumberInput min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </FormColumns>
  );
}

/**
 * Records a check's results (D-372): each measurement's reading (judged against its limits), each pass / fail,
 * notes, the quantities and photos. The result follows from the points; a fail opens an NCR.
 */
export function CheckRecordForm({ check, etag, canEdit }: { check: Check; etag: string | null; canEdit: boolean }) {
  const t = useTranslations("partnerInsight.checks.record");
  const tOutcome = useTranslations("partnerInsight.outcomes");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        check.checkpoints.map((p) => [
          p.seq,
          { measured: trimZeros(p.measured), outcome: p.outcome ?? "", note: p.note ?? "" },
        ]),
      ) as Record<number, { measured: string; outcome: string; note: string }>,
  );
  const [accepted, setAccepted] = useState(trimZeros(check.acceptedQty));
  const [rejected, setRejected] = useState(trimZeros(check.rejectedQty) || "0");
  const [inspected, setInspected] = useState(trimZeros(check.inspectedQty));
  const [remarks, setRemarks] = useState(check.remarks ?? "");
  const [photos, setPhotos] = useState<{ id: string; name: string }[]>(
    check.photos.map((p) => ({ id: p.fileId, name: p.name })),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const set = (seq: number, patch: Partial<{ measured: string; outcome: string; note: string }>) =>
    setValues({ ...values, [seq]: { ...values[seq]!, ...patch } });
  const within = (p: Check["checkpoints"][number], v: string) => {
    if (!v.trim() || !NUM.test(plainNumber(v))) return null;
    const n = Number(plainNumber(v));
    return (p.minValue === null || n >= Number(p.minValue)) && (p.maxValue === null || n <= Number(p.maxValue));
  };

  async function save() {
    const badNumber = check.checkpoints.some(
      (p) =>
        p.type === "measurement" && values[p.seq]!.measured.trim() && !NUM.test(plainNumber(values[p.seq]!.measured)),
    );
    const badQty = [accepted, rejected, inspected].some((q) => q.trim() && !QTY.test(plainNumber(q)));
    if (badNumber || badQty) {
      setError(t("invalid"));
      return;
    }
    setError(undefined);
    const saved = await run(
      () =>
        erpSave<Check>(
          "PUT",
          factoryId,
          "/quality-checks/{checkId}",
          { checkId: check.id },
          {
            points: check.checkpoints.map((p) => {
              const v = values[p.seq]!;
              return {
                seq: p.seq,
                ...(p.type === "measurement" ? { measured: v.measured.trim() ? plainNumber(v.measured) : null } : {}),
                ...(p.type === "pass_fail" ? { outcome: v.outcome || null } : {}),
                note: v.note.trim() || null,
              };
            }),
            inspectedQty: inspected.trim() ? plainNumber(inspected) : null,
            acceptedQty: accepted.trim() ? plainNumber(accepted) : null,
            rejectedQty: plainNumber(rejected || "0"),
            remarks: remarks.trim() || null,
            photoFileIds: photos.map((p) => p.id),
          },
          etag,
        ),
      t("saved"),
    );
    if (saved) {
      if (saved.result === "fail" && saved.ncrs[0]) toast.info(t("ncrOpened", { no: saved.ncrs[0].ncrNo }));
      router.refresh();
    }
  }

  if (!canEdit) return null;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {check.checkpoints.map((p) => {
          const v = values[p.seq]!;
          const ok = p.type === "measurement" ? within(p, v.measured) : null;
          return (
            <li key={p.seq} className="border-border bg-surface rounded-xl border p-3 md:p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {p.seq}. {p.name}
                </span>
                {p.type === "measurement" ? (
                  <span className="text-muted text-sm">
                    {t("spec", {
                      min: p.minValue === null ? "–" : trimZeros(p.minValue),
                      max: p.maxValue === null ? "–" : trimZeros(p.maxValue),
                      unit: p.unit ?? "",
                    })}
                  </span>
                ) : null}
              </div>
              {p.type === "measurement" ? (
                <Field
                  label={t("reading")}
                  hint={ok === null ? undefined : ok ? tOutcome("pass") : tOutcome("fail")}
                  error={ok === false ? t("outOfSpec") : undefined}
                >
                  <NumberInput
                    step="any"
                    unit={p.unit ?? undefined}
                    value={v.measured}
                    onChange={(e) => set(p.seq, { measured: e.target.value })}
                  />
                </Field>
              ) : p.type === "pass_fail" ? (
                <SegmentedControl
                  label={t("outcome")}
                  size="md"
                  value={v.outcome || "none"}
                  onValueChange={(o) => set(p.seq, { outcome: o === "none" ? "" : o })}
                  options={[
                    { value: "pass", label: tOutcome("pass") },
                    { value: "fail", label: tOutcome("fail") },
                    { value: "na", label: tOutcome("na") },
                  ]}
                />
              ) : null}
              <div className="mt-2">
                <Field label={p.type === "note" ? t("noteFor") : t("note")}>
                  <Input value={v.note} onChange={(e) => set(p.seq, { note: e.target.value })} />
                </Field>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("inspected")}>
          <NumberInput min={0} step="any" value={inspected} onChange={(e) => setInspected(e.target.value)} />
        </Field>
        <Field label={t("accepted")}>
          <NumberInput min={0} step="any" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
        </Field>
        <Field label={t("rejected")} hint={t("rejectedHint")}>
          <NumberInput min={0} step="any" value={rejected} onChange={(e) => setRejected(e.target.value)} />
        </Field>
      </div>
      <Field label={t("remarks")}>
        <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <Field label={t("photos")} hint={photos.length ? photos.map((p) => p.name).join(", ") : t("photosHint")}>
        <FilePickButton
          label={t("addPhotos")}
          accept="image/*"
          multiple
          capture="environment"
          loading={uploading}
          onFiles={async (files) => {
            setUploading(true);
            try {
              const up = await Promise.all(files.map((file) => uploadFile("partner", file, "evidence", { factoryId })));
              setPhotos([...photos, ...up.map((u, i) => ({ id: u.id, name: files[i]!.name }))].slice(0, 10));
            } catch (e) {
              toast.error(problemMessage(e, t("uploadFailed")));
            } finally {
              setUploading(false);
            }
          }}
        />
      </Field>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <Button size="xl" iconStart="save" loading={busy || uploading} className="self-start" onClick={() => void save()}>
        {t("save")}
      </Button>
    </div>
  );
}

/** A check's actions (D-372, D-375): set the result with a reason, print the certificate of analysis. */
export function CheckActions({
  check,
  layout = "row",
}: {
  check: Check;
  /** `panel`: the record page's sticky next-steps panel — one full-width stack (see `SalesActions`). */
  layout?: "row" | "panel";
}) {
  const t = useTranslations("partnerInsight.checks.actions");
  const tResult = useTranslations("status.erpCheck");
  const { factoryId } = useFactory();
  const { run, busy } = useSave();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<"pass" | "conditional" | "fail">("conditional");
  const [reason, setReason] = useState("");
  const [key, setKey] = useState(newIdempotencyKey);
  const params = { checkId: check.id };

  async function override() {
    if (reason.trim().length < 3) return;
    const done = await run(
      () =>
        erpPost(
          factoryId,
          "/quality-checks/{checkId}/actions/override",
          params,
          { result, reason: reason.trim() },
          { idempotencyKey: key },
        ),
      t("overridden"),
    );
    if (done) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <SalesActions
        layout={layout}
        offered={check.nextActions.filter((a) => a.key !== "erp_qc.record")}
        actions={[
          { key: "erp_qc.coa", kind: "pdf", path: "/quality-checks/{checkId}/coa", params },
          {
            key: "erp_qc.override",
            kind: "dialog",
            open: () => {
              setKey(newIdempotencyKey());
              setOpen(true);
            },
          },
        ]}
      />
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("overrideTitle", { no: check.qcNo })}
          description={t("overrideBody")}
          closeLabel={t("close")}
          footer={
            <Button iconStart="flag" loading={busy} disabled={reason.trim().length < 3} onClick={() => void override()}>
              {t("overrideConfirm")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <SegmentedControl
              label={t("result")}
              size="md"
              value={result}
              onValueChange={setResult}
              options={(["pass", "conditional", "fail"] as const).map((r) => ({ value: r, label: tResult(r) }))}
            />
            <Field label={t("reason")} required>
              <Textarea
                rows={2}
                value={reason}
                placeholder={t("reasonPlaceholder")}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

// ============================================================================================= NCRs

/** Raises an NCR (D-374): where it came from, how serious, what and how much. */
export function NcrForm({
  items,
  customers,
  suppliers,
  machines,
  warehouses,
  people,
  initial,
}: {
  items: Option[];
  customers: Option[];
  suppliers: Option[];
  machines: Option[];
  warehouses: Option[];
  people: Option[];
  initial: { checkId?: string; productionOrderId?: string; itemId?: string };
}) {
  const t = useTranslations("partnerInsight.ncrs.form");
  const tSource = useTranslations("partnerInsight.sources");
  const tSeverity = useTranslations("status.erpNcrSeverity");
  const format = useFormat();
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [source, setSource] = useState<Schemas["ErpNcrSource"]>(
    initial.checkId ? "quality_check" : "customer_complaint",
  );
  const [severity, setSeverity] = useState<Schemas["DefectSeverity"]>("minor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemId, setItemId] = useState(initial.itemId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [due, setDue] = useState(bangkokToday(7));
  const [error, setError] = useState<string>();
  const [key] = useState(newIdempotencyKey);

  async function save() {
    if (
      title.trim().length < 3 ||
      description.trim().length < 3 ||
      (quantity.trim() && !QTY.test(plainNumber(quantity)))
    ) {
      setError(t("invalid"));
      return;
    }
    setError(undefined);
    const created = await run(
      () =>
        erpPost<{ id: string }>(
          factoryId,
          "/ncrs",
          {},
          {
            source,
            severity,
            title: title.trim(),
            description: description.trim(),
            ...(initial.checkId ? { checkId: initial.checkId } : {}),
            ...(initial.productionOrderId ? { productionOrderId: initial.productionOrderId } : {}),
            ...(itemId ? { itemId } : {}),
            ...(customerId ? { customerId } : {}),
            ...(supplierId ? { supplierId } : {}),
            ...(machineId ? { machineId } : {}),
            ...(warehouseId ? { warehouseId } : {}),
            ...(ownerId ? { ownerId } : {}),
            quantity: quantity.trim() ? plainNumber(quantity) : null,
            ...(due ? { actionDueOn: due } : {}),
          },
          { idempotencyKey: key },
        ),
      t("saved"),
    );
    if (created) router.push(`/quality/ncrs/${created.id}`);
  }

  const pick = (label: string, value: string, set: (v: string) => void, options: Option[], none: string) => (
    <Field label={label}>
      <Select
        value={value || null}
        placeholder={none}
        onValueChange={set}
        options={[
          { value: "", label: none },
          ...options.map((o) => ({ value: o.id, label: o.label, description: o.hint ?? undefined })),
        ]}
      />
    </Field>
  );

  const tSections = useTranslations("partnerErp.common.sections");
  return (
    <FormColumns
      aside={
        <FormSummary
          title={tSections("summary")}
          action={
            <Button size="xl" iconStart="flag" loading={busy} onClick={() => void save()}>
              {t("submit")}
            </Button>
          }
        >
          <SummaryRows
            rows={[
              { key: "source", label: t("source"), value: tSource(source) },
              { key: "severity", label: t("severity"), value: tSeverity(severity) },
              { key: "owner", label: t("owner"), value: people.find((p) => p.id === ownerId)?.label ?? t("me") },
              { key: "due", label: t("due"), value: due ? format.date(due) : "" },
            ]}
          />
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </FormSummary>
      }
    >
      <FormSection card step={1} title={tSections("details")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("source")}>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as Schemas["ErpNcrSource"])}
              options={SOURCES.map((s) => ({ value: s, label: tSource(s) }))}
            />
          </Field>
          <Field label={t("severity")}>
            <SegmentedControl
              label={t("severity")}
              size="md"
              value={severity}
              onValueChange={setSeverity}
              options={SEVERITIES.map((s) => ({ value: s, label: tSeverity(s) }))}
            />
          </Field>
        </div>
        <Field label={t("title")} required>
          <Input value={title} placeholder={t("titlePlaceholder")} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t("description")} required>
          <Textarea
            rows={3}
            value={description}
            placeholder={t("descriptionPlaceholder")}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormSection>
      <FormSection card step={2} title={tSections("affected")}>
        <div className="grid gap-4 md:grid-cols-2">
          {pick(t("item"), itemId, setItemId, items, t("none"))}
          <Field label={t("quantity")} hint={t("quantityHint")}>
            <NumberInput min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          {source === "customer_complaint"
            ? pick(t("customer"), customerId, setCustomerId, customers, t("none"))
            : null}
          {source === "goods_receipt" ? pick(t("supplier"), supplierId, setSupplierId, suppliers, t("none")) : null}
          {pick(t("machine"), machineId, setMachineId, machines, t("none"))}
          {pick(t("warehouse"), warehouseId, setWarehouseId, warehouses, t("none"))}
        </div>
      </FormSection>
      <FormSection card step={3} title={tSections("owner")}>
        <div className="grid gap-4 md:grid-cols-2">
          {pick(t("owner"), ownerId, setOwnerId, people, t("me"))}
          <Field label={t("due")}>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </FormColumns>
  );
}

/** Works an open NCR (D-374): the cause, the corrective and preventive action, owner and due date. */
export function NcrWorkForm({ ncr, etag, people }: { ncr: Ncr; etag: string | null; people: Option[] }) {
  const t = useTranslations("partnerInsight.ncrs.work");
  const tSeverity = useTranslations("status.erpNcrSeverity");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [severity, setSeverity] = useState(ncr.severity);
  const [rootCause, setRootCause] = useState(ncr.rootCause ?? "");
  const [corrective, setCorrective] = useState(ncr.correctiveAction ?? "");
  const [preventive, setPreventive] = useState(ncr.preventiveAction ?? "");
  const [ownerId, setOwnerId] = useState(ncr.owner?.id ?? "");
  const [due, setDue] = useState(ncr.actionDueOn ?? "");
  const [quantity, setQuantity] = useState(trimZeros(ncr.quantity));

  async function save() {
    const done = await run(
      () =>
        erpSave(
          "PUT",
          factoryId,
          "/ncrs/{ncrId}",
          { ncrId: ncr.id },
          {
            severity,
            rootCause: rootCause.trim() || null,
            correctiveAction: corrective.trim() || null,
            preventiveAction: preventive.trim() || null,
            ownerId: ownerId || null,
            actionDueOn: due || null,
            ...(ncr.disposition === "scrap" ? {} : { quantity: quantity.trim() ? plainNumber(quantity) : null }),
          },
          etag,
        ),
      t("saved"),
    );
    if (done) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("severity")}
        size="md"
        value={severity}
        onValueChange={setSeverity}
        options={SEVERITIES.map((s) => ({ value: s, label: tSeverity(s) }))}
      />
      <Field label={t("rootCause")}>
        <Textarea
          rows={2}
          value={rootCause}
          placeholder={t("rootCausePlaceholder")}
          onChange={(e) => setRootCause(e.target.value)}
        />
      </Field>
      <Field label={t("corrective")}>
        <Textarea
          rows={2}
          value={corrective}
          placeholder={t("correctivePlaceholder")}
          onChange={(e) => setCorrective(e.target.value)}
        />
      </Field>
      <Field label={t("preventive")}>
        <Textarea
          rows={2}
          value={preventive}
          placeholder={t("preventivePlaceholder")}
          onChange={(e) => setPreventive(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("owner")}>
          <Select
            value={ownerId || null}
            placeholder={t("noOwner")}
            onValueChange={setOwnerId}
            options={people.map((p) => ({ value: p.id, label: p.label }))}
          />
        </Field>
        <Field label={t("due")}>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label={t("quantity")}>
          <NumberInput
            min={0}
            step="any"
            disabled={ncr.disposition === "scrap"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
      </div>
      <Button size="lg" iconStart="save" loading={busy} className="self-start" onClick={() => void save()}>
        {t("save")}
      </Button>
    </div>
  );
}

/** An NCR's actions (D-374): decide the disposition (a scrap leaves stock), verify, close, cancel. */
export function NcrActions({
  ncr,
  layout = "row",
}: {
  ncr: Ncr;
  /** `panel`: the record page's sticky next-steps panel — one full-width stack (see `SalesActions`). */
  layout?: "row" | "panel";
}) {
  const t = useTranslations("partnerInsight.ncrs.actions");
  const tDisposition = useTranslations("partnerInsight.dispositions");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<Schemas["ErpNcrDisposition"]>("rework");
  const [note, setNote] = useState("");
  const [key, setKey] = useState(newIdempotencyKey);
  const params = { ncrId: ncr.id };

  async function dispose() {
    const done = await run(
      () =>
        erpPost(
          factoryId,
          "/ncrs/{ncrId}/actions/dispose",
          params,
          { disposition, note: note.trim() || null },
          { idempotencyKey: key },
        ),
      t("disposed"),
    );
    if (done) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <SalesActions
        layout={layout}
        offered={ncr.nextActions.filter((a) => a.key !== "erp_ncr.edit")}
        actions={[
          {
            key: "erp_ncr.dispose",
            kind: "dialog",
            primary: true,
            open: () => {
              setKey(newIdempotencyKey());
              setOpen(true);
            },
          },
          {
            key: "erp_ncr.verify",
            kind: "post",
            path: "/ncrs/{ncrId}/actions/verify",
            params,
            body: (reason) => ({ note: reason }),
            title: t("verifyTitle", { no: ncr.ncrNo }),
            description: t("verifyBody"),
            reason: { label: t("verifyNote"), placeholder: t("verifyPlaceholder") },
            done: t("verified"),
            primary: true,
          },
          {
            key: "erp_ncr.close",
            kind: "post",
            path: "/ncrs/{ncrId}/actions/close",
            params,
            title: t("closeTitle", { no: ncr.ncrNo }),
            description: t("closeBody"),
            done: t("closed"),
            primary: true,
          },
          {
            key: "erp_ncr.cancel",
            kind: "post",
            path: "/ncrs/{ncrId}/actions/cancel",
            params,
            body: (reason) => ({ reason }),
            title: t("cancelTitle", { no: ncr.ncrNo }),
            description: t("cancelBody"),
            reason: { label: t("reason"), placeholder: t("reasonPlaceholder") },
            done: t("cancelled"),
          },
        ]}
      />
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("disposeTitle", { no: ncr.ncrNo })}
          description={t("disposeBody")}
          closeLabel={t("close")}
          footer={
            <Button iconStart="split" loading={busy} onClick={() => void dispose()}>
              {t("disposeConfirm")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("disposition")}>
              <Select
                value={disposition}
                onValueChange={(v) => setDisposition(v as Schemas["ErpNcrDisposition"])}
                options={DISPOSITIONS.map((d) => ({ value: d, label: tDisposition(d) }))}
              />
            </Field>
            {disposition === "scrap" ? (
              <p className="text-warning text-sm">
                {ncr.item && ncr.quantity && ncr.warehouse
                  ? t("scrapWarning", {
                      qty: trimZeros(ncr.quantity),
                      item: ncr.item.name,
                      warehouse: ncr.warehouse.name,
                    })
                  : t("scrapNeeds")}
              </p>
            ) : null}
            <Field label={t("note")}>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
