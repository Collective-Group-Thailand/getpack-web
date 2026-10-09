"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokDay, bangkokToday, useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

/* ------------------------------------------------------------- assisted-entry sign-off */

/**
 * A price list Packio entered for the factory (the D-100 note) applies only once the factory
 * signs it off, from the later of its planned date and now. One key per intent.
 */
export function VersionSignOff({ versionId, label }: { versionId: string; label: string }) {
  const t = useTranslations("partnerPrices.signOff");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  if (!can("factory_onboarding.sign_off")) return null;
  return (
    <>
      <Button size="xl" iconStart="stamp" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body", { label })}
        confirmLabel={t("confirm")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await browserApi().POST(
              "/v1/partner/factories/{factoryId}/price-list-versions/{versionId}/actions/sign-off",
              { params: { path: { factoryId, versionId }, header: { "Idempotency-Key": idempotencyKey } } },
            );
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------- new proposal */

/**
 * Starts a draft proposal for one price list (factory price-list mode, tier A or B — D-042,
 * D-043). The effective date is in the future: prices are never back-dated (B2.2), and orders
 * already priced keep their snapshot (D-040).
 */
export function CreateProposal({ productTypeId, typeName }: { productTypeId: string; typeName: string }) {
  const t = useTranslations("partnerPrices.create");
  const tCommon = useTranslations("common");
  const { factoryId, can } = useFactory();
  const router = useRouter();
  const [from, setFrom] = useState(bangkokToday(7));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ from?: string; reason?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  if (!can("factory_prices.propose")) return null;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof error = {};
    if (!from || from <= bangkokToday()) next.from = t("fromFuture");
    if (reason.trim().length < 3) next.reason = t("reasonRequired");
    setError(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/price-proposals", {
        params: { path: { factoryId } },
        body: { productTypeId, proposedEffectiveFrom: bangkokDay(from), comment: reason.trim() },
      });
      toast.success(t("created", { type: typeName }));
      router.push(`/prices/proposals/${data!.id}`);
    } catch (failure) {
      setError({ form: problemMessage(failure, t("failed")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void create(event)} className="flex flex-col gap-4" noValidate>
      <Field
        label={t("from")}
        hint={t("fromHint")}
        required
        requiredLabel={tCommon("state.required")}
        error={error.from}
      >
        <Input
          type="date"
          inputSize="lg"
          min={bangkokToday(1)}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </Field>
      <Field
        label={t("reason")}
        hint={t("reasonHint")}
        required
        requiredLabel={tCommon("state.required")}
        error={error.reason}
      >
        <Textarea
          placeholder={t("reasonPlaceholder")}
          rows={3}
          value={reason}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {error.form ? (
        <p role="alert" className="text-danger text-sm">
          {error.form}
        </p>
      ) : null}
      <Button type="submit" size="xl" iconStart="edit" loading={busy} className="self-start">
        {t("action")}
      </Button>
    </form>
  );
}

/* ---------------------------------------------------------------- submit / withdraw */

export function SubmitProposal({
  proposalId,
  typeName,
  lines,
}: {
  proposalId: string;
  typeName: string;
  lines: number;
}) {
  const t = useTranslations("partnerPrices.submit");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  if (!can("factory_prices.propose")) return null;
  return (
    <>
      <Button size="xl" block iconStart="send" disabled={lines === 0} onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      {lines === 0 ? <p className="text-muted text-sm">{t("noLines")}</p> : null}
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body", { type: typeName, count: lines })}
        confirmLabel={t("confirm")}
        onConfirm={async ({ idempotencyKey }) => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/submit", {
              params: { path: { factoryId, proposalId }, header: { "Idempotency-Key": idempotencyKey } },
            });
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

export function WithdrawProposal({ proposalId, typeName }: { proposalId: string; typeName: string }) {
  const t = useTranslations("partnerPrices.withdraw");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState(false);
  if (!can("factory_prices.propose")) return null;
  return (
    <>
      <Button size="lg" variant="secondary" iconStart="undo" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body", { type: typeName })}
        confirmLabel={t("confirm")}
        tone="destructive"
        reason={{ label: t("reason"), required: true, minLength: 3 }}
        onConfirm={async ({ reason }) => {
          try {
            await browserApi().POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/withdraw", {
              params: { path: { factoryId, proposalId } },
              body: { reason },
            });
            toast.success(t("done"));
            refresh();
          } catch (error) {
            toast.error(problemMessage(error, t("failed")));
            throw error;
          }
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------- counter answers */

/**
 * Packio countered some lines (D-040): the factory takes each counter — it becomes the line's
 * value — or withdraws that line. Nothing is sent until every counter has an answer.
 */
export function CounterAnswers({ proposalId, lines }: { proposalId: string; lines: { id: string; label: string }[] }) {
  const t = useTranslations("partnerPrices.counters");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [answers, setAnswers] = useState<Record<string, Schemas["PriceCounterAnswer"]>>({});
  const [busy, setBusy] = useState(false);
  if (!can("factory_prices.propose")) return null;
  const complete = lines.every((line) => answers[line.id]);

  async function send() {
    setBusy(true);
    try {
      await browserApi().POST(
        "/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/actions/answer-counters",
        {
          params: { path: { factoryId, proposalId } },
          body: { lines: lines.map((line) => ({ lineId: line.id, response: answers[line.id]! })) },
        },
      );
      toast.success(t("done"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line) => (
        <div key={line.id} className="flex flex-col gap-2">
          <p className="text-sm">{line.label}</p>
          <SegmentedControl
            label={t("answerFor", { line: line.label })}
            size="xl"
            value={answers[line.id] ?? ("" as Schemas["PriceCounterAnswer"])}
            onValueChange={(value) => setAnswers({ ...answers, [line.id]: value })}
            options={[
              { value: "accept", label: t("accept"), icon: "check" },
              { value: "withdraw", label: t("withdrawLine"), icon: "undo" },
            ]}
          />
        </div>
      ))}
      <Button
        size="xl"
        iconStart="send"
        disabled={!complete}
        loading={busy}
        onClick={() => void send()}
        className="self-start"
      >
        {t("send")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------------ evidence */

/**
 * A price letter or invoice attached to the proposal (`partner.priceProposals.addEvidence`, D-040): the
 * file is uploaded and completed first (the presign flow), then attached by id under one key.
 */
export function EvidenceUpload({ proposalId }: { proposalId: string }) {
  const t = useTranslations("partnerPrices.evidence");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  if (!can("factory_prices.propose")) return null;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile("partner", file, "evidence", { factoryId });
      await browserApi().POST("/v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence", {
        params: { path: { factoryId, proposalId }, header: { "Idempotency-Key": key } },
        body: { fileId: uploaded.id, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      setFile(null);
      setNote("");
      setKey(newIdempotencyKey());
      toast.success(t("added"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="flex flex-col gap-3" noValidate>
      <FileDropzone
        accept="application/pdf,image/jpeg,image/png"
        maxBytes={20 * 1024 * 1024}
        onFiles={(files) => setFile(files[0] ?? null)}
        labels={{
          prompt: t("drop"),
          browse: t("browse"),
          hint: t("rules"),
          tooLarge: (name) => t("tooLarge", { name }),
          wrongType: (name) => t("wrongType", { name }),
        }}
      />
      {file ? <p className="text-sm">{t("chosen", { name: file.name })}</p> : null}
      <Field label={t("note")}>
        <Input
          placeholder={t("notePlaceholder")}
          inputSize="lg"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        variant="secondary"
        iconStart="paperclip"
        disabled={!file}
        loading={busy}
        className="self-start"
      >
        {t("attach")}
      </Button>
    </form>
  );
}
