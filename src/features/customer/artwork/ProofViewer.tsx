"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { BoxPreview3D } from "@/features/designer/components/BoxPreview3D";
import { resolveStyleId } from "@packio/dieline";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PROOF_STATUS } from "@/domain/status";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Select } from "@/ui/components/Select";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import type { Artwork } from "./ArtworkWorkspace";
import { artworkKey } from "./keys";

type Proof = Artwork["proofs"][number];
type Thread = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/proofs/{proofId}/annotations">["data"][number];
type Tool = "view" | "pin" | "rect";
type Draft = { kind: "pin" | "rect"; geometry: Record<string, number> };

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A proof page as an image with its dieline overlay; the markers and drawing layer sit on top. */
function Page({
  proof,
  overlay,
  zoom,
  threads,
  selected,
  onSelect,
  tool,
  onDraft,
  draft,
  label,
}: {
  proof: Proof;
  overlay: boolean;
  zoom: number;
  threads: Thread[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  tool?: Tool;
  onDraft?: (draft: Draft) => void;
  draft?: Draft | null;
  label: string;
}) {
  const t = useTranslations("proof");
  const page = proof.pages[0];
  const layer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const point = (event: React.PointerEvent) => {
    const rect = layer.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  if (!page) return <p className="text-muted text-sm">{t("noPages")}</p>;

  return (
    <div
      ref={scroller}
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "bg-bg-subtle border-border relative max-h-[70vh] overflow-auto rounded-xl border focus-visible:outline-2",
        tool === "view" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
      )}
      onPointerDown={(event) => {
        if (tool && tool !== "view") return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          left: scroller.current!.scrollLeft,
          top: scroller.current!.scrollTop,
        };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        scroller.current!.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
        scroller.current!.scrollTop = drag.current.top - (event.clientY - drag.current.y);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <div className="relative mx-auto" style={{ width: `${zoom * 100}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a rasterised proof page from the API */}
        <img
          src={page.imageUrl}
          alt={t("pageAlt", { version: proof.versionNo })}
          className="block w-full select-none"
          draggable={false}
        />
        {overlay && page.dielineOverlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the dieline overlay, decorative (the toggle names it)
          <img
            src={page.dielineOverlayUrl}
            alt=""
            className="pointer-events-none absolute inset-0 block w-full select-none"
            draggable={false}
          />
        ) : null}
        <div
          ref={layer}
          className="absolute inset-0"
          onPointerDown={(event) => {
            if (tool !== "rect") return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const at = point(event);
            setBox({ x0: at.x, y0: at.y, x1: at.x, y1: at.y });
          }}
          onPointerMove={(event) => {
            if (tool !== "rect" || !box) return;
            const at = point(event);
            setBox({ ...box, x1: at.x, y1: at.y });
          }}
          onPointerUp={(event) => {
            if (tool === "pin") {
              onDraft?.({ kind: "pin", geometry: point(event) });
            } else if (tool === "rect" && box) {
              const x = Math.min(box.x0, box.x1);
              const y = Math.min(box.y0, box.y1);
              const w = Math.abs(box.x1 - box.x0);
              const h = Math.abs(box.y1 - box.y0);
              setBox(null);
              if (w > 0.01 && h > 0.01) onDraft?.({ kind: "rect", geometry: { x, y, w, h } });
            }
          }}
        >
          {threads.map((thread, index) => {
            const { x = 0.5, y = 0.5, w, h } = thread.geometry;
            const first = thread.messages[0]?.body ?? "";
            return (
              <button
                key={thread.id}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onSelect?.(thread.id)}
                aria-label={t("marker", { index: index + 1, text: first })}
                aria-pressed={selected === thread.id}
                className={cn(
                  "absolute flex items-start justify-start",
                  thread.kind === "rect" ? "rounded border-2" : "-translate-x-1/2 -translate-y-1/2",
                  thread.resolved ? "border-success" : "border-warning",
                )}
                style={
                  thread.kind === "rect" && w && h
                    ? { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }
                    : { left: `${x * 100}%`, top: `${y * 100}%` }
                }
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold shadow",
                    thread.resolved ? "bg-success text-success-fg" : "bg-warning text-warning-fg",
                    selected === thread.id && "ring-primary ring-2 ring-offset-2",
                  )}
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
          {box ? (
            <span
              aria-hidden
              className="border-primary absolute border-2 border-dashed"
              style={{
                left: `${Math.min(box.x0, box.x1) * 100}%`,
                top: `${Math.min(box.y0, box.y1) * 100}%`,
                width: `${Math.abs(box.x1 - box.x0) * 100}%`,
                height: `${Math.abs(box.y1 - box.y0) * 100}%`,
              }}
            />
          ) : null}
          {draft ? (
            <span
              aria-hidden
              className={cn(
                "border-primary absolute border-2",
                draft.kind === "pin" && "size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
              )}
              style={{
                left: `${(draft.geometry.x ?? 0.5) * 100}%`,
                top: `${(draft.geometry.y ?? 0.5) * 100}%`,
                ...(draft.kind === "rect"
                  ? { width: `${(draft.geometry.w ?? 0) * 100}%`, height: `${(draft.geometry.h ?? 0) * 100}%` }
                  : {}),
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The proof viewer (F3 3.5, design-system.md §3 "ProofViewer"): zoom and pan, the dieline on or
 * off, the box in 3D, any two versions side by side or under a slider, comments pinned or boxed
 * on the page in threads prepress answers, and — once every checklist item is confirmed — the
 * approval that sends the file to production, or a request for changes.
 *
 * Placing a comment by pointer is the quick way, never the only one: "comment on the whole page"
 * needs no pointing (WCAG 2.5.7), and every marker is a button in the tab order.
 */
export function ProofViewer({ initial, version }: { initial: Artwork; version: number | null }) {
  const t = useTranslations("proof");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const artwork = useQuery({
    queryKey: artworkKey(initial.orderId),
    queryFn: () =>
      browserRequests().call("GET /v1/store/orders/{orderId}/artwork", { path: { orderId: initial.orderId } }),
    initialData: initial,
  }).data;
  const proofs = artwork.proofs;
  const [versionNo, setVersionNo] = useState(version ?? proofs[0]?.versionNo ?? 1);
  const proof = proofs.find((candidate) => candidate.versionNo === versionNo) ?? proofs[0]!;
  const [view, setView] = useState<"proof" | "compare" | "3d">("proof");
  const [compareMode, setCompareMode] = useState<"side" | "slider">("side");
  const [against, setAgainst] = useState<number>(
    proofs.find((candidate) => candidate.versionNo !== proof.versionNo)?.versionNo ?? proof.versionNo,
  );
  const [slider, setSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [overlay, setOverlay] = useState(true);
  const [tool, setTool] = useState<Tool>("view");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const open = proof.status === "pending_customer";

  const threadsKey = queryKeys.related("customer", "proofs", proof.id, "annotations");
  const threads =
    useQuery({
      queryKey: threadsKey,
      queryFn: async () =>
        (
          await browserRequests().call("GET /v1/store/orders/{orderId}/proofs/{proofId}/annotations", {
            path: { orderId: artwork.orderId, proofId: proof.id },
          })
        ).data,
    }).data ?? [];

  const refetchThreads = () => queryClient.invalidateQueries({ queryKey: threadsKey });

  async function saveDraft() {
    if (!draft || !comment.trim()) return;
    setBusy(true);
    try {
      const thread = await browserRequests().call("POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations", {
        path: { orderId: artwork.orderId, proofId: proof.id },
        body: { page: 0, kind: draft.kind, geometry: draft.geometry, body: comment.trim() },
      });
      setDraft(null);
      setComment("");
      setTool("view");
      setSelected(thread.id);
      await refetchThreads();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(threadId: string) {
    const body = reply[threadId]?.trim();
    if (!body) return;
    try {
      await browserRequests().call(
        "POST /v1/store/orders/{orderId}/proofs/{proofId}/annotations/{annotationId}/messages",
        {
          path: { orderId: artwork.orderId, proofId: proof.id, annotationId: threadId },
          body: { body },
        },
      );
      setReply((current) => ({ ...current, [threadId]: "" }));
      await refetchThreads();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  async function decide(outcome: "approve" | "changes") {
    setBusy(true);
    try {
      const next =
        outcome === "approve"
          ? await browserRequests().call("POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/approve", {
              path: { orderId: artwork.orderId, proofId: proof.id },
              body: { checklist: [...checked] },
              idempotencyKey: key.current,
            })
          : await browserRequests().call("POST /v1/store/orders/{orderId}/proofs/{proofId}/actions/request-changes", {
              path: { orderId: artwork.orderId, proofId: proof.id },
              body: { note: changes.trim() },
            });
      key.current = newKey();
      queryClient.setQueryData(artworkKey(artwork.orderId), next);
      setConfirming(false);
      toast.success(outcome === "approve" ? t("approved") : t("changesSent"));
      router.refresh();
    } catch (error) {
      if (isApiError(error)) key.current = newKey();
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const style = resolveStyleId(artwork.dieline.dielineKey);
  const other = proofs.find((candidate) => candidate.versionNo === against) ?? proof;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {proofs.length > 1 ? (
          <div className="w-48">
            <Select
              aria-label={t("version")}
              value={String(proof.versionNo)}
              onValueChange={(value) => {
                setVersionNo(Number(value));
                setDraft(null);
                setSelected(null);
              }}
              options={proofs.map((candidate) => ({
                value: String(candidate.versionNo),
                label: t("versionLabel", { version: candidate.versionNo }),
              }))}
            />
          </div>
        ) : null}
        <StatusChip map={PROOF_STATUS} value={proof.status} size="md" />
        <SegmentedControl
          label={t("view")}
          value={view}
          onValueChange={(next) => {
            setView(next);
            setTool("view");
            setDraft(null);
          }}
          options={[
            { value: "proof", label: t("views.proof") },
            ...(proofs.length > 1 ? [{ value: "compare" as const, label: t("views.compare") }] : []),
            ...(style ? [{ value: "3d" as const, label: t("views.3d") }] : []),
          ]}
        />
        {view !== "3d" ? (
          <>
            <div className="flex items-center gap-1" role="group" aria-label={t("zoom")}>
              <IconButton
                name="minus"
                size="sm"
                variant="ghost"
                label={t("zoomOut")}
                disabled={zoom <= ZOOMS[0]!}
                onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)]!)}
              />
              <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
                {format.percent(String(zoom * 100), 0)}
              </span>
              <IconButton
                name="plus"
                size="sm"
                variant="ghost"
                label={t("zoomIn")}
                disabled={zoom >= ZOOMS.at(-1)!}
                onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)]!)}
              />
              <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>
                {t("fit")}
              </Button>
            </div>
            <Switch checked={overlay} onCheckedChange={setOverlay} label={t("dieline")} />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {view === "proof" ? (
            <>
              {open ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    label={t("tools")}
                    size="sm"
                    value={tool}
                    onValueChange={(next) => {
                      setTool(next);
                      setDraft(null);
                    }}
                    options={[
                      { value: "view", label: t("toolView"), icon: "grip" },
                      { value: "pin", label: t("toolPin"), icon: "map-pin" },
                      { value: "rect", label: t("toolRect"), icon: "rectangle" },
                    ]}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart="chat"
                    onClick={() => setDraft({ kind: "pin", geometry: { x: 0.5, y: 0.5 } })}
                  >
                    {t("pageComment")}
                  </Button>
                  <span className="text-muted text-xs" aria-live="polite">
                    {tool === "pin" ? t("pinHint") : tool === "rect" ? t("rectHint") : t("viewHint")}
                  </span>
                </div>
              ) : null}
              <Page
                proof={proof}
                overlay={overlay}
                zoom={zoom}
                threads={threads}
                selected={selected}
                onSelect={setSelected}
                tool={open ? tool : "view"}
                onDraft={setDraft}
                draft={draft}
                label={t("canvas", { version: proof.versionNo })}
              />
            </>
          ) : view === "compare" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-48">
                  <Select
                    aria-label={t("compareWith")}
                    value={String(other.versionNo)}
                    onValueChange={(value) => setAgainst(Number(value))}
                    options={proofs
                      .filter((candidate) => candidate.versionNo !== proof.versionNo)
                      .map((candidate) => ({
                        value: String(candidate.versionNo),
                        label: t("versionLabel", { version: candidate.versionNo }),
                      }))}
                  />
                </div>
                <SegmentedControl
                  label={t("compareMode")}
                  size="sm"
                  value={compareMode}
                  onValueChange={setCompareMode}
                  options={[
                    { value: "side", label: t("side") },
                    { value: "slider", label: t("slider") },
                  ]}
                />
              </div>
              {compareMode === "side" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("versionLabel", { version: other.versionNo })}</p>
                    <Page
                      proof={other}
                      overlay={overlay}
                      zoom={zoom}
                      threads={[]}
                      label={t("canvas", { version: other.versionNo })}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium">{t("versionLabel", { version: proof.versionNo })}</p>
                    <Page
                      proof={proof}
                      overlay={overlay}
                      zoom={zoom}
                      threads={[]}
                      label={t("canvas", { version: proof.versionNo })}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div
                    className="border-border relative overflow-hidden rounded-xl border"
                    role="img"
                    aria-label={t("sliderAlt", { a: other.versionNo, b: proof.versionNo, percent: slider })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- rasterised proof page */}
                    <img src={proof.pages[0]?.imageUrl} alt="" className="block w-full" draggable={false} />
                    {/* eslint-disable-next-line @next/next/no-img-element -- rasterised proof page */}
                    <img
                      src={other.pages[0]?.imageUrl}
                      alt=""
                      className="absolute inset-0 block w-full"
                      style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
                      draggable={false}
                    />
                    <span aria-hidden className="bg-primary absolute inset-y-0 w-0.5" style={{ left: `${slider}%` }} />
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <span className="shrink-0">{t("versionLabel", { version: other.versionNo })}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={slider}
                      onChange={(event) => setSlider(Number(event.target.value))}
                      aria-label={t("sliderLabel")}
                      className="flex-1"
                    />
                    <span className="shrink-0">{t("versionLabel", { version: proof.versionNo })}</span>
                  </label>
                </div>
              )}
            </>
          ) : style ? (
            <BoxPreview3D
              style={style}
              dims={{
                length: artwork.dieline.lengthMm ?? 100,
                width: artwork.dieline.widthMm ?? 100,
                height: artwork.dieline.heightMm ?? 50,
              }}
              colour="#e9e3d8"
              printed
              label={t("box3d", {
                l: artwork.dieline.lengthMm ?? 0,
                w: artwork.dieline.widthMm ?? 0,
                h: artwork.dieline.heightMm ?? 0,
              })}
              labels={{
                rotateLeft: t("rotateLeft"),
                rotateRight: t("rotateRight"),
                tiltUp: t("tiltUp"),
                tiltDown: t("tiltDown"),
                reset: t("reset"),
              }}
            />
          ) : null}
        </div>

        <aside aria-label={t("panel")} className="flex flex-col gap-6">
          {draft ? (
            <section aria-labelledby="proof-draft" className="border-primary rounded-xl border-2 p-3">
              <h2 id="proof-draft" className="text-sm font-semibold">
                {draft.kind === "rect"
                  ? t("newBox")
                  : draft.geometry.x === 0.5 && draft.geometry.y === 0.5
                    ? t("newPage")
                    : t("newPin")}
              </h2>
              <Field label={t("comment")} className="mt-2">
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  autoFocus
                />
              </Field>
              <div className="mt-2 flex gap-2">
                <Button size="sm" loading={busy} disabled={!comment.trim()} onClick={() => void saveDraft()}>
                  {t("saveComment")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="proof-threads">
            <h2 id="proof-threads" className="text-sm font-semibold">
              {t("threads", { count: threads.length })}
            </h2>
            {threads.length === 0 ? <p className="text-muted mt-2 text-sm">{t("noThreads")}</p> : null}
            <ol className="mt-2 flex flex-col gap-3">
              {threads.map((thread, index) => (
                <li
                  key={thread.id}
                  className={cn(
                    "border-border rounded-lg border p-3 text-sm",
                    selected === thread.id && "border-primary",
                  )}
                  aria-current={selected === thread.id ? "true" : undefined}
                >
                  <p className="flex items-center justify-between gap-2 font-medium">
                    {t("threadTitle", { index: index + 1 })}
                    <span className={cn("text-xs", thread.resolved ? "text-success-subtle-fg" : "text-muted")}>
                      {thread.resolved ? t("resolved") : t("open")}
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {thread.messages.map((message) => (
                      <li key={message.id}>
                        <p className="text-muted text-xs">
                          {t("by", { name: message.authorName, date: format.dateTime(message.createdAt) })}
                        </p>
                        <p className="whitespace-pre-line">{message.body}</p>
                      </li>
                    ))}
                  </ul>
                  {open && !thread.resolved ? (
                    <div className="mt-2 flex items-end gap-2">
                      <Field label={t("replyTo", { index: index + 1 })} labelHidden className="flex-1">
                        <Textarea
                          rows={1}
                          value={reply[thread.id] ?? ""}
                          placeholder={t("replyPlaceholder")}
                          onChange={(event) => setReply((current) => ({ ...current, [thread.id]: event.target.value }))}
                        />
                      </Field>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!reply[thread.id]?.trim()}
                        onClick={() => void sendReply(thread.id)}
                      >
                        {t("reply")}
                        <span className="sr-only"> {t("threadTitle", { index: index + 1 })}</span>
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          {open ? (
            <section
              aria-labelledby="proof-decision"
              className="border-border flex flex-col gap-3 rounded-xl border p-4"
            >
              <h2 id="proof-decision" className="font-semibold">
                {t("decide")}
              </h2>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm">{t("checklist")}</legend>
                {artwork.checklist.map((item) => (
                  <Checkbox
                    key={item.key}
                    checked={checked.has(item.key)}
                    onCheckedChange={(value) =>
                      setChecked((current) => {
                        const next = new Set(current);
                        if (value === true) next.add(item.key);
                        else next.delete(item.key);
                        return next;
                      })
                    }
                    label={item.label}
                  />
                ))}
              </fieldset>
              <Button
                disabled={checked.size < artwork.checklist.length}
                onClick={() => setConfirming(true)}
                iconStart="check"
              >
                {t("approve")}
              </Button>
              <Field label={t("changesLabel")} hint={t("changesHint")}>
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={changes}
                  onChange={(event) => setChanges(event.target.value)}
                />
              </Field>
              <Button
                variant="secondary"
                loading={busy}
                disabled={changes.trim().length < 3}
                onClick={() => void decide("changes")}
              >
                {t("requestChanges")}
              </Button>
            </section>
          ) : proof.decision ? (
            <Callout
              tone={proof.decision.outcome === "approved" ? "success" : "warning"}
              title={t(`decision.${proof.decision.outcome}`)}
            >
              {t("decisionRecord", { name: proof.decision.byName, date: format.dateTime(proof.decision.at) })}
              {proof.decision.fileSha256 ? (
                <span className="mt-1 block font-mono text-xs break-all">
                  {t("hash", { hash: proof.decision.fileSha256.slice(0, 16) })}
                </span>
              ) : null}
            </Callout>
          ) : null}
        </aside>
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("approveTitle", { version: proof.versionNo })}
        description={t("approveBody", { code: artwork.orderCode, version: proof.versionNo })}
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={busy}
        onConfirm={() => void decide("approve")}
      />
    </div>
  );
}
