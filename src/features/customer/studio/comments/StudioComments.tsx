"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Dieline } from "@packio/dieline";

import { faceAnchor, flatAnchor, sheetPoint, type CommentAnchor } from "@/features/designer/comments/anchors";
import type { PickedPlace } from "@/features/designer/comments/pins";
import { useFaceNames } from "@/features/designer/lib/useFaceNames";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";

import { CommentsPanel } from "./CommentsPanel";

/**
 * The studio's comments (U4.7): the design's threads, pinned on the outside's die — a 3D pick as
 * its face and the point on it, a flat pick as the point — with the company's members to @mention.
 */
export function StudioComments({
  designId,
  dieline,
  companyId,
  versionNo,
}: {
  designId: string;
  dieline: Dieline | null;
  companyId: string | null;
  versionNo: number | null;
}) {
  const t = useTranslations("studio.comments");
  const faces = useFaceNames(dieline);
  const company = useQuery({
    queryKey: [...queryKeys.zone("customer"), "company", companyId],
    queryFn: async () =>
      (await browserApi().GET("/v1/store/companies/{companyId}", { params: { path: { companyId: companyId! } } }))
        .data!,
    enabled: !!companyId,
    staleTime: 10 * 60_000,
  });
  const members = (company.data?.members ?? [])
    .filter((m) => m.status === "active")
    .map((m) => ({ id: m.user.id, displayName: m.user.displayName }));

  const toAnchor = useCallback(
    (place: PickedPlace): CommentAnchor | null => {
      if (!dieline) return null;
      return place.faceId
        ? faceAnchor(dieline, [place.xMm, place.yMm], place.faceId)
        : flatAnchor([place.xMm, place.yMm]);
    },
    [dieline],
  );
  const toPoint = useCallback((anchor: CommentAnchor) => (dieline ? sheetPoint(dieline, anchor) : null), [dieline]);
  const placeOf = useCallback(
    (anchor: CommentAnchor) =>
      "faceId" in anchor ? t("onFace", { face: faces.get(anchor.faceId) ?? anchor.faceId }) : t("onFlat"),
    [faces, t],
  );

  return (
    <CommentsPanel
      source={{ kind: "design", designId }}
      toAnchor={toAnchor}
      toPoint={toPoint}
      placeOf={placeOf}
      members={members}
      versionNo={versionNo}
    />
  );
}
