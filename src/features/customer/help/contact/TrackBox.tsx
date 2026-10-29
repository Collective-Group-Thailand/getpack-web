"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { trackBusiness } from "@/lib/analytics/business";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

import { classifyReference, verifierOf } from "./reference";
import { newKey, type TicketStatus } from "./send";

const STAGES = ["received", "in_progress", "answered"] as const;

/**
 * The one tracking box (business pack Phase 2 item 1): an order number (PK-…) opens the customer's orders filtered
 * by it (sign-in first for a guest); a request number (the API's `CS-…`, D-440) shows the request's stage inline —
 * for its signed-in owner at once, for a guest after the phone or e-mail they sent it with — with
 * "เพิ่มข้อมูลในเรื่องนี้" (`store.support.lookupTicket` / `addInfo`, D-458).
 */
export function TrackBox({ signedIn, topicLabel }: { signedIn: boolean; topicLabel: Record<string, string> }) {
  const t = useTranslations("help.contact.track");
  const format = useFormat();
  const router = useRouter();
  const id = useId();
  const [reference, setReference] = useState("");
  const [verifier, setVerifier] = useState("");
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<TicketStatus | null>(null);
  const [more, setMore] = useState("");
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const addKey = useRef(newKey());

  async function lookup(ticketNo: string, contact?: { phone?: string; email?: string }) {
    setBusy(true);
    setProblem(null);
    try {
      const { data } = await browserApi().POST("/v1/store/support/actions/lookup", {
        body: { ticketNo, ...(contact ? { contact: { name: "-", ...contact } } : {}) },
      });
      setStatus(data!);
      setAsking(false);
    } catch (error) {
      setStatus(null);
      if (isApiError(error) && error.status === 404) {
        if (!contact && !signedIn) setAsking(true);
        else setProblem(t("notFound"));
      } else setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const kind = classifyReference(reference);
    setAdded(false);
    if (!kind) {
      setProblem(t("invalid"));
      return;
    }
    if (!asking) trackBusiness("contact_track", { type: kind.type });
    if (kind.type === "order") {
      const target = `/account/orders?q=${encodeURIComponent(kind.code)}`;
      router.push(signedIn ? target : `/sign-in?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    if (signedIn) void lookup(kind.code);
    else if (asking && verifierOf(verifier)) void lookup(kind.code, verifierOf(verifier)!);
    else setAsking(true);
  }

  async function addInfo(event: React.FormEvent) {
    event.preventDefault();
    if (!status || !more.trim()) return;
    setBusy(true);
    try {
      const contact = verifierOf(verifier);
      const { data } = await browserApi().POST("/v1/store/support/actions/add-info", {
        params: { header: { "Idempotency-Key": addKey.current } },
        body: {
          ticketNo: status.ticketNo,
          message: more.trim(),
          ...(contact ? { contact: { name: "-", ...contact } } : {}),
        },
      });
      setStatus(data!);
      setMore("");
      setAdded(true);
      addKey.current = newKey();
    } catch (error) {
      addKey.current = newKey();
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const stageAt = status ? STAGES.indexOf(status.stage as (typeof STAGES)[number]) : -1;
  return (
    <div id="track" className="mt-4.5 max-w-[32.5rem] scroll-mt-28">
      <form onSubmit={submit} className="flex gap-2" role="search" aria-label={t("label")}>
        <label htmlFor={`${id}-ref`} className="sr-only">
          {t("label")}
        </label>
        <Input
          id={`${id}-ref`}
          inputSize="lg"
          value={reference}
          placeholder={t("placeholder")}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 tabular-nums"
          aria-invalid={problem === t("invalid") || undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          onChange={(event) => {
            setReference(event.target.value);
            setStatus(null);
            setAsking(false);
            setProblem(null);
          }}
        />
        <Button type="submit" size="lg" loading={busy && !status}>
          {t("submit")}
        </Button>
      </form>
      {asking ? (
        <form onSubmit={submit} className="border-border bg-surface rounded-card mt-3 flex flex-col gap-3 border p-4">
          <b className="text-[15px] font-semibold">{t("verifyTitle")}</b>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={t("verifyField")} hint={t("verifyHint")} className="min-w-0 flex-1">
              <Input value={verifier} autoComplete="tel email" onChange={(event) => setVerifier(event.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" loading={busy} disabled={!verifierOf(verifier)}>
              {t("verifySubmit")}
            </Button>
          </div>
        </form>
      ) : null}
      {problem ? (
        <p id={`${id}-problem`} role="alert" className="text-danger-subtle-fg mt-2 text-sm">
          {problem}
        </p>
      ) : null}
      {status ? (
        <section
          aria-labelledby={`${id}-ticket`}
          className="border-border bg-surface rounded-card mt-3.5 flex flex-col gap-2.5 border p-4"
        >
          <h3
            id={`${id}-ticket`}
            className="flex flex-wrap items-center justify-between gap-2.5 text-[15px] font-semibold"
          >
            <span className="tabular-nums">{t("ticketTitle", { ticket: status.ticketNo })}</span>
            <span className="text-muted text-[13px] font-normal">
              {t("topic", { topic: topicLabel[status.topic] ?? status.topic })}
            </span>
          </h3>
          <ol className="flex flex-col gap-2 text-[13.5px]">
            {STAGES.map((stage, index) => (
              <li
                key={stage}
                aria-current={index === stageAt ? "step" : undefined}
                className={cn(
                  "grid grid-cols-[1.125rem_minmax(0,1fr)] items-center gap-2.5",
                  index < stageAt && "text-muted",
                  index === stageAt && "text-fg font-semibold",
                  index > stageAt && "text-muted",
                )}
              >
                <i
                  aria-hidden="true"
                  className={cn(
                    "size-3 rounded-full border-2",
                    index < stageAt && "border-success bg-success",
                    index === stageAt && "border-primary bg-primary-subtle",
                    index > stageAt && "border-border-strong",
                  )}
                />
                {t(`stages.${stage}`)}
              </li>
            ))}
          </ol>
          <p className="text-muted text-[13px] tabular-nums">
            {status.answeredAt
              ? t("answeredAt", { date: format.dateTime(status.answeredAt) })
              : t("respondBy", { date: format.dateTime(status.respondBy) })}
          </p>
          <form onSubmit={(event) => void addInfo(event)} className="border-border flex flex-col gap-2 border-t pt-3">
            <Field label={t("addTitle")}>
              <Textarea rows={2} maxLength={3000} value={more} onChange={(event) => setMore(event.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!more.trim()}>
                {t("addSubmit")}
              </Button>
              {status.lineUrl ? (
                <a
                  href={status.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {t("openLine")}
                </a>
              ) : null}
            </div>
            {added ? (
              <p role="status" className="text-success-subtle-fg text-[13px]">
                {t("added")}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
