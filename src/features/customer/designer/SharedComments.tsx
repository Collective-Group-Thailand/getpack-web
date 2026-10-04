"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { CommentsPanel } from "@/features/customer/studio/comments/CommentsPanel";
import { flatAnchorOf, pointFromBounds, type CommentAnchor } from "@/features/designer/comments/anchor";
import { useCommentPins, type PickedPlace } from "@/features/designer/comments/pins";

type Bounds = Record<string, { x: number; y: number; width: number; height: number }>;

/**
 * Comments through a comment or edit link (U4.7, D-285): the shared flat sheet (drawn by the server,
 * passed as `children`) under a layer of the same viewBox that places and shows the pins, beside the
 * threads. A click on the sheet while pinning is a point of the flat sheet, in mm.
 */
export function SharedComments({
  token,
  viewBox,
  faceBounds,
  faceLabels,
  children,
}: {
  token: string;
  viewBox: { x: number; y: number; width: number; height: number };
  faceBounds: Bounds;
  faceLabels: Record<string, string>;
  children: React.ReactNode;
}) {
  const t = useTranslations("studio.comments");
  const pins = useCommentPins((s) => s.pins);
  const active = useCommentPins((s) => s.active);
  const placing = useCommentPins((s) => s.placing);

  const toAnchor = useCallback((place: PickedPlace): CommentAnchor => flatAnchorOf(place.xMm, place.yMm), []);
  const toPoint = useCallback((anchor: CommentAnchor) => pointFromBounds(faceBounds, anchor), [faceBounds]);
  const placeOf = useCallback(
    (anchor: CommentAnchor) =>
      "faceId" in anchor ? t("onFace", { face: faceLabels[anchor.faceId] ?? anchor.faceId }) : t("onFlat"),
    [faceLabels, t],
  );
  const r = Math.max(viewBox.width, viewBox.height) * 0.018;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="bg-surface border-border relative aspect-[4/3] w-full rounded-xl border p-4">
        <div className="relative h-full w-full">
          {children}
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className={
              placing
                ? "absolute inset-0 h-full w-full cursor-crosshair"
                : "pointer-events-none absolute inset-0 h-full w-full"
            }
            aria-hidden="true"
            onClick={(event) => {
              if (!useCommentPins.getState().placing) return;
              const svg = event.currentTarget;
              const matrix = svg.getScreenCTM();
              if (!matrix) return;
              const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
              useCommentPins.getState().pick({ xMm: p.x, yMm: p.y, faceId: null });
            }}
          >
            {pins.map((pin) => (
              <g key={pin.id} transform={`translate(${pin.xMm} ${pin.yMm})`} opacity={pin.resolved ? 0.45 : 1}>
                <circle
                  r={r}
                  fill={pin.id === active ? "#2f80ed" : "#d9480f"}
                  stroke="#ffffff"
                  strokeWidth={r * 0.18}
                />
                <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} fontWeight={700} fill="#ffffff">
                  {pin.n}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
      <aside aria-label={t("panel")} className="space-y-3">
        <CommentsPanel source={{ kind: "link", token }} toAnchor={toAnchor} toPoint={toPoint} placeOf={placeOf} />
      </aside>
    </div>
  );
}
