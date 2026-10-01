"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { newReport, uploadPhotos, useFloorAction } from "@/features/partner/floor";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { CameraCapture, type CapturedPhoto } from "@/ui/components/CameraCapture";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { ScanButton } from "@/ui/components/ScanButton";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

export type PartnerJob = ResponseOf<Requests, "GET /v1/partner/factories/{factoryId}/jobs/{jobId}">;
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

/* ----------------------------------------------------------------------- accept / reject */

/**
 * Accepting commits the factory to produce at the PO's price by the promised date (D-011, D-074)
 * and starts the advance payable (D-022) — restated before it is sent.
 */
export function AcceptJob({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.accept");
  const format = useFormat();
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy } = useFloorAction();
  const [open, setOpen] = useState(false);
  if (!can("factory_jobs.respond")) return <p className="text-muted">{t("plannerOnly")}</p>;
  return (
    <>
      <BigActionButton
        title={t("action")}
        hint={job.acceptDueAt ? t("hint", { due: format.dateTime(job.acceptDueAt) }) : undefined}
        icon="check"
        loading={busy}
        onClick={() => setOpen(true)}
      />
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title", { jobNo: job.jobNo })}
        description={t("body", {
          jobNo: job.jobNo,
          quantity: format.number(job.quantity),
          date: format.date(job.promisedShipDate),
          amount: format.thb(job.purchaseOrder.buyAmount),
        })}
        confirmLabel={t("confirm")}
        onConfirm={async () => {
          const next = report.get();
          const ok = await run(
            () =>
              browserRequests().call("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/accept", {
                path: { factoryId, jobId: job.id },
                body: next.stamp,
                idempotencyKey: next.idempotencyKey,
              }),
            t("done", { jobNo: job.jobNo }),
          );
          if (ok) report.done();
          else throw new Error("not accepted");
        }}
      />
    </>
  );
}

const REJECT_REASONS = ["capacity", "material", "machine", "spec_not_feasible", "price", "other"] as const;

export function RejectJob({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.reject");
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run } = useFloorAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number]>("capacity");
  if (!can("factory_jobs.respond")) return null;
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
        reason={{ label: t("note"), hint: t("noteHint") }}
        onConfirm={async ({ reason: note }) => {
          const next = report.get();
          const ok = await run(
            () =>
              browserRequests().call("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/reject", {
                path: { factoryId, jobId: job.id },
                body: { ...next.stamp, reason, ...(note ? { note } : {}) },
                idempotencyKey: next.idempotencyKey,
              }),
            t("done", { jobNo: job.jobNo }),
          );
          if (ok) report.done();
          else throw new Error("not rejected");
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

export function StartMilestone({ job, milestone }: { job: PartnerJob; milestone: Milestone }) {
  const t = useTranslations("partnerJobs.milestone");
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy } = useFloorAction();
  if (!can("factory_milestones.update")) return <p className="text-muted">{t("noPermission")}</p>;
  return (
    <BigActionButton
      title={t("start", { name: milestone.name })}
      icon="play"
      loading={busy}
      onClick={async () => {
        const next = report.get();
        const ok = await run(
          () =>
            browserRequests().call(
              "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/start",
              {
                path: { factoryId, jobId: job.id, seq: String(milestone.seq) },
                body: next.stamp,
                idempotencyKey: next.idempotencyKey,
              },
            ),
          t("started", { name: milestone.name }),
        );
        if (ok) report.done();
      }}
    />
  );
}

/**
 * Completing a step with what went in, what came out good and what was scrapped (B4.2) — the API
 * checks the arithmetic and what the previous step put out; the form only guides it. Photos where
 * the route asks for them, taken here and uploaded before the report.
 */
export function CompleteMilestone({ job, milestone }: { job: PartnerJob; milestone: Milestone }) {
  const t = useTranslations("partnerJobs.milestone");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const cameraLabels = useCameraLabels();
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy, errors } = useFloorAction();
  const previous = [...job.milestones].reverse().find((item) => item.seq < milestone.seq && item.quantityOut !== null);
  const start = previous?.quantityOut ?? job.quantity;
  const [quantityIn, setIn] = useState(String(start));
  const [quantityScrap, setScrap] = useState("0");
  const [quantityOut, setOut] = useState(String(start));
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  if (!can("factory_milestones.update")) return <p className="text-muted">{t("noPermission")}</p>;
  const needsQc = milestone.requiresQc && !job.qcChecks.some((check) => check.result !== "fail");
  const numbers = [quantityIn, quantityOut, quantityScrap].map(Number);
  const invalid = numbers.some((value) => !Number.isInteger(value) || value < 0);
  const overflow = !invalid && numbers[1]! + numbers[2]! > numbers[0]!;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || overflow) return;
    if (milestone.requiresPhoto && photos.length === 0) return void toast.error(t("photoRequired"));
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
        browserRequests().call(
          "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/complete",
          {
            path: { factoryId, jobId: job.id, seq: String(milestone.seq) },
            body: {
              ...next.stamp,
              quantityIn: numbers[0]!,
              quantityOut: numbers[1]!,
              quantityScrap: numbers[2]!,
              photoFileIds,
              ...(note.trim() ? { note: note.trim() } : {}),
            },
            idempotencyKey: next.idempotencyKey,
          },
        ),
      t("completed", { name: milestone.name }),
    );
    if (ok) {
      report.done();
      setPhotos([]);
    }
  }

  if (needsQc) return <p className="text-muted">{t("qcFirst")}</p>;

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
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
      {milestone.requiresPhoto ? (
        <Field label={t("photos")} hint={t("photosHint")} error={errors.photoFileIds}>
          <CameraCapture photos={photos} onChange={setPhotos} labels={cameraLabels} />
        </Field>
      ) : null}
      <Field label={t("note")}>
        <Textarea rows={2} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <BigActionButton
        type="submit"
        title={t("complete", { name: milestone.name })}
        hint={t("completeHint", {
          good: format.number(Number(quantityOut) || 0),
          scrap: format.number(Number(quantityScrap) || 0),
        })}
        icon="check"
        loading={busy || uploading}
        disabled={invalid || overflow}
      />
    </form>
  );
}

/* ------------------------------------------------------------------------------------ QC */

/** The factory's QC with photos (D-076): the checklist item by item, defects counted. */
export function QcForm({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.qc");
  const cameraLabels = useCameraLabels();
  const { factoryId, can } = useFactory();
  const report = useReport();
  const { run, busy, errors } = useFloorAction();
  const [answers, setAnswers] = useState<Record<string, "pass" | "fail">>({});
  const [result, setResult] = useState<"pass" | "fail" | "conditional" | null>(null);
  const [defects, setDefects] = useState<{ label: string; count: string }[]>([]);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  if (!can("factory_qc.record")) return <p className="text-muted">{t("qcOnly")}</p>;
  const complete = job.qcChecklist.every((item) => answers[item.key]);
  const derived = complete ? (Object.values(answers).every((value) => value === "pass") ? "pass" : "fail") : null;
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
    const next = report.get();
    const ok = await run(
      () =>
        browserRequests().call("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/qc-checks", {
          path: { factoryId, jobId: job.id },
          body: {
            ...next.stamp,
            checklist: job.qcChecklist.map((item) => ({ key: item.key, pass: answers[item.key] === "pass" })),
            result: chosen,
            defects: defects
              .filter((item) => item.label.trim() && Number(item.count) > 0)
              .map((item) => ({ label: item.label.trim(), count: Number(item.count) })),
            photoFileIds,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
          idempotencyKey: next.idempotencyKey,
        }),
      t("recorded"),
    );
    if (ok) {
      report.done();
      setPhotos([]);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <ul className="flex flex-col gap-3">
        {job.qcChecklist.map((item) => (
          <li key={item.key} className="flex flex-col gap-2">
            <span className="font-medium">{item.label}</span>
            <SegmentedControl
              label={t("answerFor", { item: item.label })}
              size="xl"
              value={answers[item.key] ?? ("" as "pass")}
              onValueChange={(value) => setAnswers({ ...answers, [item.key]: value })}
              options={[
                { value: "pass", label: t("pass"), icon: "check" },
                { value: "fail", label: t("fail"), icon: "close" },
              ]}
            />
          </li>
        ))}
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
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("defects")}</legend>
        {defects.map((defect, index) => (
          <div key={index} className="grid grid-cols-[1fr_6rem] gap-2">
            <Input
              inputSize="lg"
              aria-label={t("defectLabel", { n: index + 1 })}
              value={defect.label}
              onChange={(event) =>
                setDefects(defects.map((item, at) => (at === index ? { ...item, label: event.target.value } : item)))
              }
            />
            <NumberInput
              inputSize="lg"
              inputMode="numeric"
              min={1}
              aria-label={t("defectCount", { n: index + 1 })}
              value={defect.count}
              onChange={(event) =>
                setDefects(defects.map((item, at) => (at === index ? { ...item, count: event.target.value } : item)))
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          iconStart="plus"
          onClick={() => setDefects([...defects, { label: "", count: "1" }])}
          className="self-start"
        >
          {t("addDefect")}
        </Button>
      </fieldset>
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

const ISSUE_KINDS = ["material", "machine", "artwork", "quantity", "quality", "delay", "other"] as const;

export function RaiseIssue({ job }: { job: PartnerJob }) {
  const t = useTranslations("partnerJobs.issue");
  const tCommon = useTranslations("common");
  const { factoryId } = useFactory();
  const report = useReport();
  const { run, busy, errors } = useFloorAction();
  const [kind, setKind] = useState<(typeof ISSUE_KINDS)[number]>("material");
  const [description, setDescription] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (description.trim().length < 3) return void toast.error(t("tooShort"));
        const next = report.get();
        const ok = await run(
          () =>
            browserRequests().call("POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues", {
              path: { factoryId, jobId: job.id },
              body: { ...next.stamp, kind, description: description.trim() },
              idempotencyKey: next.idempotencyKey,
            }),
          t("raised"),
        );
        if (ok) {
          report.done();
          setDescription("");
        }
      }}
    >
      <Field label={t("kind")}>
        <Select
          value={kind}
          onValueChange={setKind}
          options={ISSUE_KINDS.map((key) => ({ value: key, label: t(`kinds.${key}`) }))}
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

export function ResolveIssue({ jobId, issueId }: { jobId: string; issueId: string }) {
  const t = useTranslations("partnerJobs.issue");
  const { factoryId } = useFactory();
  const report = useReport();
  const { run, busy } = useFloorAction();
  return (
    <Button
      size="lg"
      variant="ghost"
      iconStart="check"
      loading={busy}
      onClick={async () => {
        const next = report.get();
        const ok = await run(
          () =>
            browserRequests().call(
              "POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues/{issueId}/actions/resolve",
              {
                path: { factoryId, jobId, issueId },
                body: next.stamp,
                idempotencyKey: next.idempotencyKey,
              },
            ),
          t("resolved"),
        );
        if (ok) report.done();
      }}
    >
      {t("resolve")}
    </Button>
  );
}

/* ---------------------------------------------------------------------------------- scan */

/** A job traveller's or carton label's code → that job (contract request `partner.jobs`). */
export function JobScan() {
  const t = useTranslations("partnerJobs.scan");
  const { factoryId } = useFactory();
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
          const found = await browserRequests().call("GET /v1/partner/factories/{factoryId}/jobs/lookup", {
            path: { factoryId },
            query: { code },
          });
          router.push(`/jobs/${found.jobId}`);
        } catch (error) {
          toast.error(problemMessage(error, t("notFound", { code })));
        }
      }}
    />
  );
}
