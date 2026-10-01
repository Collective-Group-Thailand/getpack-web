"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { QC_CHECKLIST_ITEMS, QC_CHECKLIST_VERSION, qcItemLabelKey, type QcChecklistItem } from "@/domain/qc/checklist";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { newReport, uploadPhotos, useFloorAction } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Field } from "@/ui/components/Field";
import { NumberInput, Textarea } from "@/ui/components/Input";
import { ScanButton } from "@/ui/components/ScanButton";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

export type PartnerJob = Schemas["PartnerJobDto"];
type Milestone = PartnerJob["milestones"][number];
type Report = ReturnType<typeof newReport>;

/** One report per intent: minted on the first attempt, kept on a retry, dropped on success. */
function useReport() {
  const current = useRef<Report | null>(null);
  return {
    get: () => (current.current ??= newReport()),
    done: () => {
      current.current = null;
    },
  };
}

/** One `Idempotency-Key` per intent, for writes without a device report (QC, issues). */
function useIntentKey() {
  const current = useRef<string | null>(null);
  return {
    get: () => (current.current ??= newReport().idempotencyKey),
    done: () => {
      current.current = null;
    },
  };
}

function useCameraLabels() {
  const t = useTranslations("partnerJobs.camera");
  return {
    take: t("take"),
    more: t("more"),
    photo: (n: number) => t("photo", { n }),
    remove: (n: number) => t("remove", { n }),
    count: (count: number) => t("count", { count }),
    processing: t("processing"),
  };
}

/** A step's evidence rule (`EvidenceRequirement`): a photo, the QC form, or both. */
export const needsPhoto = (milestone: Pick<Milestone, "evidence">) =>
  milestone.evidence === "photo" || milestone.evidence === "photo_and_qc_form";
export const needsQcForm = (milestone: Pick<Milestone, "evidence">) =>
  milestone.evidence === "qc_form" || milestone.evidence === "photo_and_qc_form";

/* ----------------------------------------------------------------------- accept / reject */

/**
 * Accepting commits the factory to produce by the promised date (D-011, D-074) at its purchase
 * order's price, and starts the advance payable (D-022) — restated before it is sent. The PO is
 * the factory's own (`partner.payables.listPurchaseOrders`), shown to the roles that may read it.
 */
export function AcceptJob({ job, poAmount }: { job: PartnerJob; poAmount: string | null }) {
  const t = useTranslations("partnerJobs.accept");
  const format = useFormat();
  const { run, busy } = useFloorAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <BigActionButton
        title={t("action")}
        hint={t("hint", { due: format.dateTime(job.acceptDueAt) })}
        icon="check"
        loading={busy}
        onClick={() => setOpen(true)}
      />
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title", { jobNo: job.jobNo })}
        description={[
          t("body", { jobNo: job.jobNo, quantity: format.number(job.quantityOrdered) }),
          job.promisedShipDate ? t("bodyDate", { date: format.date(job.promisedShipDate) }) : null,
          poAmount ? t("bodyPo", { amount: format.thb(poAmount) }) : null,
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={t("confirm")}
        onConfirm={async ({ idempotencyKey }) => {
          const ok = await run(
            () =>
              browserApi().POST("/v1/partner/production-jobs/{jobId}/actions/accept", {
                params: { path: { jobId: job.id }, header: { "Idempotency-Key": idempotencyKey } },
              }),
            t("done", { jobNo: job.jobNo }),
          );
          if (!ok) throw new Error("not accepted");
        }}
      />
    </>
  );
}

const REJECT_REASONS = [
  "capacity",
  "material_unavailable",
  "artwork_issue",
  "spec_not_feasible",
  "price",
  "other",
] as const satisfies readonly Schemas["JobRejectReason"][];

/** Turning a job down cannot be undone (`job.reject` is irreversible): the job number is retyped. */
export function RejectJob({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.reject");
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Schemas["JobRejectReason"]>("capacity");
  return (
    <>
      <Button size="xl" variant="secondary" iconStart="ban" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        title={t("title", { jobNo: job.jobNo })}
        description={t("body", { jobNo: job.jobNo })}
        confirmLabel={t("confirm")}
        confirmationPhrase={job.jobNo}
        reason={{ label: t("note"), hint: t("noteHint") }}
        onConfirm={async ({ idempotencyKey, reason: note }) => {
          const ok = await run(
            () =>
              browserApi().POST("/v1/partner/production-jobs/{jobId}/actions/reject", {
                params: { path: { jobId: job.id }, header: { "Idempotency-Key": idempotencyKey } },
                body: { reasonCode: reason, ...(note ? { note } : {}) },
              }),
            t("done", { jobNo: job.jobNo }),
          );
          if (!ok) throw new Error("not rejected");
        }}
      >
        <Field label={t("reason")} className="mt-4">
          <Select
            value={reason}
            onValueChange={setReason}
            options={REJECT_REASONS.map((key) => ({ value: key, label: t(`reasons.${key}`) }))}
          />
        </Field>
      </ConfirmAction>
    </>
  );
}

/* ---------------------------------------------------------------------------- milestones */

/**
 * `partner.production.updateMilestone` answers `applied: false` when nothing changed — the same
 * report again, or a step another device already moved. That is not an error: the screen reloads
 * the job and says why.
 */
function useMilestoneUpdate(job: PartnerJob, milestone: Milestone) {
  const t = useTranslations("partnerJobs.milestone");
  return async (body: Omit<Schemas["UpdateMilestoneDto"], "clientRef" | "clientReportedAt">, report: Report) => {
    const result = (
      await browserApi().POST("/v1/partner/production-jobs/{jobId}/milestones/{milestoneId}", {
        params: {
          path: { jobId: job.id, milestoneId: milestone.id },
          header: { "Idempotency-Key": report.idempotencyKey },
        },
        body: { ...body, ...report.stamp },
      })
    ).data!;
    return result.applied ? undefined : { notice: t(`outcomes.${result.reason ?? "duplicate"}`) };
  };
}

export function StartMilestone({ job, milestone, name }: { job: PartnerJob; milestone: Milestone; name: string }) {
  const t = useTranslations("partnerJobs.milestone");
  const report = useReport();
  const update = useMilestoneUpdate(job, milestone);
  const { run, busy } = useFloorAction();
  return (
    <BigActionButton
      title={t("start", { name })}
      icon="play"
      loading={busy}
      onClick={async () => {
        const next = report.get();
        const ok = await run(() => update({ action: "start" }, next), t("started", { name }));
        if (ok) report.done();
      }}
    />
  );
}

/**
 * Completing a step. A step that tracks quantities says what went in, what came out good and
 * what was scrapped (B4.2) — the API checks the arithmetic against what the previous step put
 * out; the form only guides it. Photos where the step's evidence asks for them, taken here and
 * uploaded before the report.
 */
export function CompleteMilestone({ job, milestone, name }: { job: PartnerJob; milestone: Milestone; name: string }) {
  const t = useTranslations("partnerJobs.milestone");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const cameraLabels = useCameraLabels();
  const { factoryId } = useFactory();
  const report = useReport();
  const update = useMilestoneUpdate(job, milestone);
  const { run, busy, errors } = useFloorAction();
  const previous = [...job.milestones]
    .sort((a, b) => b.seq - a.seq)
    .find((item) => item.seq < milestone.seq && item.tracksQuantity && item.quantityOut !== null);
  const start = milestone.quantityIn ?? previous?.quantityOut ?? job.quantityOrdered;
  const [quantityIn, setIn] = useState(String(start));
  const [quantityScrap, setScrap] = useState("0");
  const [quantityOut, setOut] = useState(String(start));
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const photoRequired = needsPhoto(milestone) && milestone.photoFileIds.length === 0;
  const numbers = [quantityIn, quantityOut, quantityScrap].map(Number);
  const invalid = milestone.tracksQuantity && numbers.some((value) => !Number.isInteger(value) || value < 0);
  const overflow = milestone.tracksQuantity && !invalid && numbers[1]! + numbers[2]! > numbers[0]!;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || overflow) return;
    if (photoRequired && photos.length === 0) return void toast.error(t("photoRequired"));
    setUploading(true);
    let photoFileIds: string[];
    try {
      photoFileIds = await uploadPhotos(photos, factoryId);
    } catch (error) {
      setUploading(false);
      return void toast.error(problemMessage(error, t("uploadFailed")));
    }
    setUploading(false);
    const next = report.get();
    const ok = await run(
      () =>
        update(
          {
            action: "complete",
            ...(milestone.tracksQuantity
              ? { quantityIn: numbers[0]!, quantityOut: numbers[1]!, quantityScrap: numbers[2]! }
              : {}),
            ...(photoFileIds.length ? { photoFileIds } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          next,
        ),
      t("completed", { name }),
    );
    if (ok) {
      report.done();
      setPhotos([]);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      {milestone.tracksQuantity ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("in")} error={errors.quantityIn} required requiredLabel={tCommon("state.required")}>
              <NumberInput
                inputSize="lg"
                inputMode="numeric"
                min={0}
                value={quantityIn}
                onChange={(event) => setIn(event.target.value)}
              />
            </Field>
            <Field label={t("good")} error={errors.quantityOut ?? (overflow ? t("overflow") : undefined)}>
              <NumberInput
                inputSize="lg"
                inputMode="numeric"
                min={0}
                value={quantityOut}
                onChange={(event) => setOut(event.target.value)}
              />
            </Field>
            <Field label={t("scrap")} error={errors.quantityScrap}>
              <NumberInput
                inputSize="lg"
                inputMode="numeric"
                min={0}
                value={quantityScrap}
                onChange={(event) => {
                  setScrap(event.target.value);
                  const left = Number(quantityIn) - Number(event.target.value);
                  if (Number.isInteger(left) && left >= 0) setOut(String(left));
                }}
              />
            </Field>
          </div>
          <p className="text-muted text-sm">{t("fromBefore", { quantity: format.number(start) })}</p>
        </>
      ) : null}
      {needsPhoto(milestone) ? (
        <Field label={t("photos")} hint={t("photosHint")} error={errors.photoFileIds}>
          <CameraCapture photos={photos} onChange={setPhotos} labels={cameraLabels} />
        </Field>
      ) : null}
      <Field label={t("note")}>
        <Textarea rows={2} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <BigActionButton
        type="submit"
        title={t("complete", { name })}
        hint={
          milestone.tracksQuantity
            ? t("completeHint", {
                good: format.number(Number(quantityOut) || 0),
                scrap: format.number(Number(quantityScrap) || 0),
              })
            : undefined
        }
        icon="check"
        loading={busy || uploading}
        disabled={invalid || overflow}
      />
    </form>
  );
}

/* ------------------------------------------------------------------------------------ QC */

const SEVERITIES = ["critical", "major", "minor"] as const satisfies readonly Schemas["DefectSeverity"][];
type DefectInput = { severity: Schemas["DefectSeverity"]; count: string };

/**
 * The factory's QC with photos (D-076): the checklist item by item, and a defect for each failed
 * item with its severity and count (`QcDefectDto`, coded by the item).
 *
 * CONTRACT-GAP partner.job-qc-checklist — no partner response carries the route's checklist, so
 * the factory answers the web's interim list (`src/domain/qc/checklist.ts`) under its own version.
 */
export function QcForm({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.qc");
  const cameraLabels = useCameraLabels();
  const { factoryId } = useFactory();
  const key = useIntentKey();
  const { run, busy, errors } = useFloorAction();
  const [answers, setAnswers] = useState<Partial<Record<QcChecklistItem, "pass" | "fail">>>({});
  const [result, setResult] = useState<Schemas["QcResult"] | null>(null);
  const [defects, setDefects] = useState<Partial<Record<QcChecklistItem, DefectInput>>>({});
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const complete = QC_CHECKLIST_ITEMS.every((item) => answers[item]);
  const failed = QC_CHECKLIST_ITEMS.filter((item) => answers[item] === "fail");
  const derived = complete ? (failed.length === 0 ? "pass" : "fail") : null;
  const chosen = result ?? derived;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || !chosen) return void toast.error(t("answerAll"));
    if (!photos.length) return void toast.error(t("photoRequired"));
    setUploading(true);
    let photoFileIds: string[];
    try {
      photoFileIds = await uploadPhotos(photos, factoryId);
    } catch (error) {
      setUploading(false);
      return void toast.error(problemMessage(error, t("uploadFailed")));
    }
    setUploading(false);
    const idempotencyKey = key.get();
    const ok = await run(
      () =>
        browserApi().POST("/v1/partner/production-jobs/{jobId}/qc-checks", {
          params: { path: { jobId: job.id }, header: { "Idempotency-Key": idempotencyKey } },
          body: {
            checklistVersion: QC_CHECKLIST_VERSION,
            checklist: Object.fromEntries(QC_CHECKLIST_ITEMS.map((item) => [item, answers[item]!])),
            result: chosen,
            defects: failed.flatMap((item) => {
              const defect = defects[item];
              const count = Number(defect?.count ?? 1);
              return Number.isInteger(count) && count > 0
                ? [{ code: item, severity: defect?.severity ?? "minor", count }]
                : [];
            }),
            photoFileIds,
            ...(notes.trim() ? { note: notes.trim() } : {}),
          },
        }),
      t("recorded"),
    );
    if (ok) {
      key.done();
      setPhotos([]);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <ul className="flex flex-col gap-3">
        {QC_CHECKLIST_ITEMS.map((item) => {
          const label = t(qcItemLabelKey(item));
          const defect: DefectInput = defects[item] ?? { severity: "minor", count: "1" };
          return (
            <li key={item} className="flex flex-col gap-2">
              <span className="font-medium">{label}</span>
              <SegmentedControl
                label={t("answerFor", { item: label })}
                size="xl"
                value={answers[item] ?? ("" as "pass")}
                onValueChange={(value) => setAnswers({ ...answers, [item]: value })}
                options={[
                  { value: "pass", label: t("pass"), icon: "check" },
                  { value: "fail", label: t("fail"), icon: "close" },
                ]}
              />
              {answers[item] === "fail" ? (
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <Field label={t("severityFor", { item: label })}>
                    <Select
                      value={defect.severity}
                      onValueChange={(severity) => setDefects({ ...defects, [item]: { ...defect, severity } })}
                      options={SEVERITIES.map((severity) => ({ value: severity, label: t(`severity.${severity}`) }))}
                    />
                  </Field>
                  <Field label={t("defectCount")}>
                    <NumberInput
                      inputSize="lg"
                      inputMode="numeric"
                      min={1}
                      value={defect.count}
                      onChange={(event) => setDefects({ ...defects, [item]: { ...defect, count: event.target.value } })}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {complete ? (
        <Field label={t("result")}>
          <SegmentedControl
            label={t("result")}
            size="xl"
            value={chosen ?? "pass"}
            onValueChange={setResult}
            options={[
              { value: "pass", label: t("results.pass") },
              { value: "conditional", label: t("results.conditional") },
              { value: "fail", label: t("results.fail") },
            ]}
          />
        </Field>
      ) : null}
      <Field label={t("photos")} hint={t("photosHint")} error={errors.photoFileIds}>
        <CameraCapture photos={photos} onChange={setPhotos} labels={cameraLabels} />
      </Field>
      <Field label={t("notes")}>
        <Textarea rows={2} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <BigActionButton
        type="submit"
        title={t("submit")}
        icon="clipboard-check"
        loading={busy || uploading}
        disabled={!complete}
      />
    </form>
  );
}

/* -------------------------------------------------------------------------------- issues */

const ISSUE_KINDS = [
  "material_shortage",
  "machine_down",
  "artwork_question",
  "quantity",
  "quality",
  "delay",
  "other",
] as const satisfies readonly Schemas["JobIssueKind"][];

/** Raising an issue (D-232): a named kind and what happened; Packio sees it on the board. */
export function RaiseIssue({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.issue");
  const tCommon = useTranslations("common");
  const key = useIntentKey();
  const { run, busy, errors } = useFloorAction();
  const [kind, setKind] = useState<Schemas["JobIssueKind"]>("material_shortage");
  const [description, setDescription] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (description.trim().length < 3) return void toast.error(t("tooShort"));
        const idempotencyKey = key.get();
        const ok = await run(
          () =>
            browserApi().POST("/v1/partner/production-jobs/{jobId}/issues", {
              params: { path: { jobId: job.id }, header: { "Idempotency-Key": idempotencyKey } },
              body: { kind, description: description.trim() },
            }),
          t("raised"),
        );
        if (ok) {
          key.done();
          setDescription("");
        }
      }}
    >
      <Field label={t("kind")}>
        <Select
          value={kind}
          onValueChange={setKind}
          options={ISSUE_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
        />
      </Field>
      <Field label={t("description")} required requiredLabel={tCommon("state.required")} error={errors.description}>
        <Textarea
          rows={3}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Button type="submit" size="xl" variant="secondary" iconStart="flag" loading={busy} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}

/** The factory closes an issue its own people raised (D-232), saying how it was fixed. */
export function ResolveIssue({ jobId, issueId, description }: { jobId: string; issueId: string; description: string }) {
  const t = useTranslations("partnerJobs.issue");
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" variant="ghost" iconStart="check" onClick={() => setOpen(true)}>
        {t("resolve")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("resolveTitle")}
        description={description}
        confirmLabel={t("resolve")}
        reason={{ label: t("resolveNote"), required: true, hint: t("resolveNoteHint") }}
        onConfirm={async ({ idempotencyKey, reason }) => {
          const ok = await run(
            () =>
              browserApi().POST("/v1/partner/production-jobs/{jobId}/issues/{issueId}/actions/resolve", {
                params: { path: { jobId, issueId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { note: reason },
              }),
            t("resolved"),
          );
          if (!ok) throw new Error("not resolved");
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------------- scan */

/** A job traveller's or carton label's code → that job (`partner.production.lookup`). */
export function JobScan() {
  const t = useTranslations("partnerJobs.scan");
  const router = useRouter();
  return (
    <ScanButton
      labels={{
        open: t("open"),
        title: t("title"),
        aim: t("aim"),
        noCamera: t("noCamera"),
        manual: t("manual"),
        manualHint: t("manualHint"),
        submit: t("submit"),
        close: t("close"),
      }}
      onCode={async (code) => {
        try {
          const found = (await browserApi().GET("/v1/partner/production-jobs/lookup", { params: { query: { code } } }))
            .data!;
          router.push(`/jobs/${found.jobId}`);
        } catch (error) {
          toast.error(problemMessage(error, t("notFound", { code })));
        }
      }}
    />
  );
}
