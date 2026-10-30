"use client";

import { resolveStyleId } from "@getpack/dieline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { FileLink } from "@/features/customer/files/FileLink";
import { BoxPreview3D } from "@/features/designer/components/BoxPreview3D";
import { useFileUrl } from "@/features/customer/files/files";
import { useFormat } from "@/features/shared/format/useFormat";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { PROOF_STATUS } from "@/domain/status";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Textarea } from "@/ui/components/Input";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { loadArtwork, placeOf, threadsOf, type Artwork, type Proof, type Thread } from "./artwork";
import { artworkKey } from "./keys";

type Tool = "view" | "pin" | "rect";
type Draft = { kind: "pin" | "rect"; geometry: Record<string, number> };

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
/** Comments sit on the proof's first page; the API numbers pages from 1. */
const FIRST_PAGE = 1;
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** A proof the browser can show as a picture to point at; any other file is opened instead. */
const isImage = (proof: Proof) => proof.proofFile.mimeType.startsWith("image/");

/** A proof page as an image with its dieline overlay; the markers and drawing layer sit on top. */
function Page({
  proof,
  overlay,
  fileHidden = false,
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
  /** Only the dieline: the file stays in place (it gives the page its size) but is not drawn. */
  fileHidden?: boolean;
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
  const imageUrl = useFileUrl(isImage(proof) ? proof.proofFile.id : null);
  // A PDF proof's file, signed as a download (the file host serves it as an attachment, so it cannot show inline).
  const fileUrl = useFileUrl(isImage(proof) ? null : proof.proofFile.id);
  const overlayUrl = useFileUrl(overlay ? proof.dielineFileId : null);
  const [overlayBroken, setOverlayBroken] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const point = (event: React.PointerEvent) => {
    const rect = layer.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  if (!isImage(proof)) {
    // CONTRACT-GAP store.proofs — no rasterised pages are published, and the file host serves the PDF as an
    // attachment (no inline view): a document card — the file, one primary download, and what to do next.
    return (
      <section className="border-border bg-surface rounded-panel flex min-h-80 flex-col items-center justify-center gap-4 border px-6 py-12 text-center">
        <span
          aria-hidden="true"
          className="border-border bg-surface-subtle text-primary grid size-20 place-items-center rounded-xl border"
        >
          <Icon name="document" size={40} />
        </span>
        <p className="m-0 max-w-[44ch] font-semibold break-words">
          {t("fileProof", { name: proof.proofFile.originalName })}
        </p>
        <p className="text-muted m-0 max-w-[48ch] text-sm">{t("fileReviewHint")}</p>
        {fileUrl ? (
          <Button asChild size="lg" iconStart="download">
            <a href={fileUrl} download={proof.proofFile.originalName}>
              {t("fileDownload")}
            </a>
          </Button>
        ) : (
          <FileLink
            fileId={proof.proofFile.id}
            label={t("fileDownload")}
            openLabel={t("fileOpen")}
            failed={t("failed")}
            size="md"
          />
        )}
      </section>
    );
  }
  if (!imageUrl) return <p className="text-muted text-sm">{t("loadingPage")}</p>;

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
        {/* eslint-disable-next-line @next/next/no-img-element -- the proof file, through a signed URL */}
        <img
          src={imageUrl}
          alt={t("pageAlt", { version: proof.versionNo })}
          className={cn("block w-full select-none", fileHidden && "invisible")}
          draggable={false}
        />
        {overlay && overlayUrl && !overlayBroken ? (
          // eslint-disable-next-line @next/next/no-img-element -- the dieline overlay, decorative (the toggle names it)
          <img
            src={overlayUrl}
            alt=""
            className="pointer-events-none absolute inset-0 block w-full select-none"
            draggable={false}
            onError={() => setOverlayBroken(true)}
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
          {threads.map(({ root }, index) => {
            const { x, y, w, h } = placeOf(root);
            const resolved = Boolean(root.resolvedAt);
            const boxed = root.kind === "rect" && w && h;
            return (
              <button
                key={root.id}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onSelect?.(root.id)}
                aria-label={t("marker", { index: index + 1, text: root.comment })}
                aria-pressed={selected === root.id}
                className={cn(
                  "absolute flex items-start justify-start",
                  boxed ? "rounded border-2" : "-translate-x-1/2 -translate-y-1/2",
                  resolved ? "border-success" : "border-warning",
                )}
                style={
                  boxed
                    ? { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }
                    : { left: `${x * 100}%`, top: `${y * 100}%` }
                }
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold shadow",
                    resolved ? "bg-success text-success-fg" : "bg-warning text-warning-fg",
                    selected === root.id && "ring-primary ring-2 ring-offset-2",
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

/** Two versions under one slider: the earlier one clipped over the later. */
function Slider({ proof, other, slider }: { proof: Proof; other: Proof; slider: number }) {
  const t = useTranslations("proof");
  const under = useFileUrl(isImage(proof) ? proof.proofFile.id : null);
  const over = useFileUrl(isImage(other) ? other.proofFile.id : null);
  if (!under || !over) return <p className="text-muted text-sm">{t("loadingPage")}</p>;
  return (
    <div
      className="bg-surface border-border relative overflow-hidden rounded-xl border"
      role="img"
      aria-label={t("sliderAlt", { a: other.versionNo, b: proof.versionNo, percent: slider })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the proof file, through a signed URL */}
      <img src={under} alt="" className="block w-full" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the proof file, through a signed URL */}
      <img
        src={over}
        alt=""
        className="absolute inset-0 block w-full"
        style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
        draggable={false}
      />
      <span aria-hidden className="bg-primary absolute inset-y-0 w-0.5" style={{ left: `${slider}%` }} />
    </div>
  );
}

/**
 * The proof viewer (F3 3.5, design-system.md §3 "ProofViewer"): zoom and pan, the dieline on or
 * off, any two versions side by side or under a slider, comments pinned or boxed on the page in
 * threads prepress answers, and the approval that sends the file to production, or a request for
 * changes.
 *
 * Placing a comment by pointer is the quick way, never the only one: "comment on the whole page"
 * needs no pointing (WCAG 2.5.7), and every marker is a button in the tab order.
 *
 * Approving confirms every item of the approval checklist the API sets (`artwork.approval_checklist`)
 * and may carry a note; the record names who decided and what they confirmed. The box can be seen
 * in 3D from the order's dieline and size.
 *
 * CONTRACT-GAP store.proofs — page rasterisation is deferred (A9): a PDF proof opens as a file.
 */
export function ProofViewer({ initial, version }: { initial: Artwork; version: number | null }) {
  const t = useTranslations("proof");
  const format = useFormat();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = initial.order.id;
  const artwork =
    useQuery({
      queryKey: artworkKey(orderId),
      queryFn: () => loadArtwork(browserApi(), orderId),
      initialData: initial,
    }).data ?? initial;
  const proofs = artwork.proofs;
  const [versionNo, setVersionNo] = useState(version ?? proofs[0]?.versionNo ?? 1);
  const proof = proofs.find((candidate) => candidate.versionNo === versionNo) ?? proofs[0]!;
  const [view, setView] = useState<"proof" | "compare" | "3d">("proof");
  // The box in 3D from the order's dieline and size (`store.artwork.getRules`, U-B0.1).
  const dieline = artwork.rules?.dieline ?? null;
  const style = resolveStyleId(dieline?.dielineKey ?? dieline?.patternCode);
  const checklist = artwork.rules?.approvalChecklist ?? [];
  const [checked, setChecked] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const complete = checklist.every((item) => checked.includes(item.key));
  const [compareMode, setCompareMode] = useState<"side" | "slider">("side");
  const [against, setAgainst] = useState<number>(
    proofs.find((candidate) => candidate.versionNo !== proof.versionNo)?.versionNo ?? proof.versionNo,
  );
  const [slider, setSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  // What shows (UX audit, proof review): the file, the dieline, or the dieline over the file.
  const [layers, setLayers] = useState<"file" | "dieline" | "both">("both");
  const overlay = layers !== "file";
  const [tool, setTool] = useState<Tool>("view");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [changes, setChanges] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const open = proof.status === "pending_customer";
  const pointable = isImage(proof);
  const threads = threadsOf(proof);

  const reload = () => queryClient.invalidateQueries({ queryKey: artworkKey(orderId) });

  /** `store.artwork.annotate`: a new comment, or a reply naming its thread (with the thread's place). */
  async function annotate(input: { comment: string; parent?: Thread["root"]; draft?: Draft }) {
    const place = input.parent ?? null;
    await browserApi().POST("/v1/store/proofs/{proofId}/annotations", {
      params: { path: { proofId: proof.id } },
      body: {
        comment: input.comment,
        page: place?.page ?? FIRST_PAGE,
        kind: place?.kind ?? input.draft!.kind,
        geometry: place?.geometry ?? input.draft!.geometry,
        ...(place ? { parentId: place.id } : {}),
      },
    });
    await reload();
  }

  async function saveDraft() {
    if (!draft || !comment.trim()) return;
    setBusy(true);
    try {
      await annotate({ comment: comment.trim(), draft });
      setDraft(null);
      setComment("");
      setTool("view");
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(thread: Thread) {
    const body = reply[thread.root.id]?.trim();
    if (!body) return;
    try {
      await annotate({ comment: body, parent: thread.root });
      setReply((current) => ({ ...current, [thread.root.id]: "" }));
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  async function decide(outcome: "approve" | "changes") {
    setBusy(true);
    try {
      if (outcome === "approve")
        await browserApi().POST("/v1/store/proofs/{proofId}/actions/approve", {
          params: { path: { proofId: proof.id }, header: { "Idempotency-Key": key.current } },
          body: {
            ...(checklist.length > 0 ? { checklist: checked } : {}),
            ...(approvalNote.trim() ? { note: approvalNote.trim() } : {}),
          },
        });
      else
        await browserApi().POST("/v1/store/proofs/{proofId}/actions/request-changes", {
          params: { path: { proofId: proof.id } },
          body: { comment: changes.trim() },
        });
      key.current = newKey();
      await reload();
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

  const other = proofs.find((candidate) => candidate.versionNo === against) ?? proof;
  const decided = proof.status === "approved" || proof.status === "changes_requested" ? proof.status : null;

  return (
    <div className="flex flex-col gap-4">
      {/* One tool bar: the version, its status, the view, the zoom and the layers. */}
      <div className="border-border bg-surface rounded-panel flex flex-wrap items-center gap-3 border p-2.5">
        {proofs.length > 1 && proofs.length <= 5 ? (
          // A few versions: every one in view, the current one chosen (a clear switch, not a hidden list).
          <SegmentedControl
            label={t("version")}
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
        ) : proofs.length > 5 ? (
          <div className="w-48">
            <SearchableSelect
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
        {(proofs.length > 1 && pointable) || style ? (
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
              ...(proofs.length > 1 && pointable ? [{ value: "compare" as const, label: t("views.compare") }] : []),
              ...(style ? [{ value: "3d" as const, label: t("views.3d") }] : []),
            ]}
          />
        ) : null}
        {pointable ? (
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
            {proof.dielineFileId ? (
              <SegmentedControl
                label={t("layers")}
                size="sm"
                value={layers}
                onValueChange={setLayers}
                options={[
                  { value: "file", label: t("layerFile") },
                  { value: "dieline", label: t("layerDieline") },
                  { value: "both", label: t("layerBoth") },
                ]}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {/* The proof takes the room; the panel stays beside it while it scrolls (Project B). */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {view === "proof" ? (
            <>
              {open ? (
                <div className="flex flex-wrap items-center gap-2">
                  {pointable ? (
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
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    iconStart="chat"
                    onClick={() => setDraft({ kind: "pin", geometry: { x: 0.5, y: 0.5 } })}
                  >
                    {t("pageComment")}
                  </Button>
                  {pointable ? (
                    <span className="text-muted text-xs" aria-live="polite">
                      {tool === "pin" ? t("pinHint") : tool === "rect" ? t("rectHint") : t("viewHint")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <Page
                proof={proof}
                overlay={overlay}
                fileHidden={layers === "dieline"}
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
                  <SearchableSelect
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
                  {[other, proof].map((entry) => (
                    <div key={entry.id}>
                      <p className="mb-1 text-sm font-medium">{t("versionLabel", { version: entry.versionNo })}</p>
                      <Page
                        proof={entry}
                        overlay={overlay}
                        fileHidden={layers === "dieline"}
                        zoom={zoom}
                        threads={[]}
                        label={t("canvas", { version: entry.versionNo })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Slider proof={proof} other={other} slider={slider} />
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
          ) : style && dieline ? (
            <BoxPreview3D
              style={style}
              dims={{ length: dieline.lengthMm, width: dieline.widthMm, height: dieline.depthMm }}
              colour="#e9e3d8"
              printed
              label={t("box3d", { l: dieline.lengthMm, w: dieline.widthMm, h: dieline.depthMm })}
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

        <aside
          aria-label={t("panel")}
          className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--site-sticky-top)+1.25rem)] lg:max-h-[calc(100dvh-var(--site-sticky-top)-2.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pe-1"
        >
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
                  maxLength={4000}
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

          {/* Project B: the decision first in the panel — approve or ask for changes — then the comments. */}
          {open ? (
            <section
              aria-labelledby="proof-decision"
              className="border-primary/30 bg-primary-subtle flex scroll-mt-28 flex-col gap-3 rounded-xl border p-4"
            >
              <h2 id="proof-decision" className="text-[1.0625rem] font-semibold">
                {t("decide")}
              </h2>
              <p className="text-muted text-sm">{t("approveIntro")}</p>
              {checklist.length > 0 ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{t("checklist")}</legend>
                  {checklist.map((item) => (
                    <Checkbox
                      key={item.key}
                      checked={checked.includes(item.key)}
                      onCheckedChange={(value) =>
                        setChecked((current) =>
                          value === true ? [...current, item.key] : current.filter((key) => key !== item.key),
                        )
                      }
                      label={pick(locale, item.labelTh, item.labelEn)}
                    />
                  ))}
                </fieldset>
              ) : null}
              <Field label={t("approvalNote")}>
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                />
              </Field>
              <Button size="lg" onClick={() => setConfirming(true)} iconStart="check" disabled={!complete}>
                {t("approve")}
              </Button>
              {!complete ? <p className="text-muted text-xs">{t("checklistHint")}</p> : null}
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
          ) : decided && proof.decidedAt ? (
            <Callout tone={decided === "approved" ? "success" : "warning"} title={t(`decision.${decided}`)}>
              {proof.decidedByName
                ? t("decisionBy", { date: format.dateTime(proof.decidedAt), name: proof.decidedByName })
                : t("decisionAt", { date: format.dateTime(proof.decidedAt) })}
              {proof.decisionChecklist.length > 0 ? (
                <ul className="mt-1 list-disc ps-5 text-xs">
                  {proof.decisionChecklist.map((key) => {
                    const item = checklist.find((entry) => entry.key === key);
                    return <li key={key}>{item ? pick(locale, item.labelTh, item.labelEn) : key}</li>;
                  })}
                </ul>
              ) : null}
              {proof.decisionComment ? <span className="mt-1 block">{proof.decisionComment}</span> : null}
              {proof.approvedFileSha256 ? (
                <span className="mt-1 block text-xs break-all tabular-nums">
                  {t("hash", { hash: proof.approvedFileSha256.slice(0, 16) })}
                </span>
              ) : null}
            </Callout>
          ) : null}

          <section aria-labelledby="proof-threads">
            <h2 id="proof-threads" className="text-sm font-semibold">
              {t("threads", { count: threads.length })}
            </h2>
            {threads.length === 0 ? <p className="text-muted mt-2 text-sm">{t("noThreads")}</p> : null}
            <ol className="mt-2 flex flex-col gap-3">
              {threads.map((thread, index) => {
                const resolved = Boolean(thread.root.resolvedAt);
                return (
                  <li
                    key={thread.root.id}
                    className={cn(
                      "border-border rounded-lg border p-3 text-sm",
                      selected === thread.root.id && "border-primary",
                    )}
                    aria-current={selected === thread.root.id ? "true" : undefined}
                  >
                    <p className="flex items-center justify-between gap-2 font-medium">
                      {t("threadTitle", { index: index + 1 })}
                      <span className={cn("text-xs", resolved ? "text-success-subtle-fg" : "text-muted")}>
                        {resolved ? t("resolved") : t("open")}
                      </span>
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {[thread.root, ...thread.replies].map((message) => (
                        <li key={message.id}>
                          <p className="text-muted text-xs">
                            {t("by", { name: message.author.displayName, date: format.dateTime(message.createdAt) })}
                          </p>
                          <p className="whitespace-pre-line">{message.comment}</p>
                        </li>
                      ))}
                    </ul>
                    {open && !resolved ? (
                      <div className="mt-2 flex items-end gap-2">
                        <Field label={t("replyTo", { index: index + 1 })} labelHidden className="flex-1">
                          <Textarea
                            rows={1}
                            value={reply[thread.root.id] ?? ""}
                            placeholder={t("replyPlaceholder")}
                            onChange={(event) =>
                              setReply((current) => ({ ...current, [thread.root.id]: event.target.value }))
                            }
                          />
                        </Field>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!reply[thread.root.id]?.trim()}
                          onClick={() => void sendReply(thread)}
                        >
                          {t("reply")}
                          <span className="sr-only"> {t("threadTitle", { index: index + 1 })}</span>
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>

      {open ? (
        // A phone keeps the way to the decision at the foot of the screen.
        <MobileActionBar className="lg:hidden">
          <Button asChild iconStart="check">
            <a href="#proof-decision">{t("decide")}</a>
          </Button>
        </MobileActionBar>
      ) : null}

      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("approveTitle", { version: proof.versionNo })}
        description={t("approveBody", { code: artwork.order.orderCode, version: proof.versionNo })}
        confirmLabel={t("approve")}
        cancelLabel={t("cancel")}
        loading={busy}
        confirmationPhrase={artwork.order.orderCode}
        confirmationLabel={t("approveType", { code: artwork.order.orderCode })}
        onConfirm={() => void decide("approve")}
      />
    </div>
  );
}
