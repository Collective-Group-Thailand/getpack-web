"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommentAnchor } from "@/features/designer/comments/anchor";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

export type Comment = Schemas["CommentDto"];

/** Whose comments: the customer's own (company's) design, or a design through a comment / edit link. */
export type CommentSource = { kind: "design"; designId: string } | { kind: "link"; token: string };

export interface NewComment {
  body: string;
  anchor?: CommentAnchor;
  parentId?: string;
  mentions?: string[];
  versionNo?: number;
}

/** The threads of a design (D-285) and the ways to add to them — through the account or a link. */
export function useComments(source: CommentSource) {
  const client = useQueryClient();
  const key = [
    ...queryKeys.zone("customer"),
    "studio-comments",
    source.kind === "design" ? source.designId : source.token,
  ];
  const list = useQuery({
    queryKey: key,
    queryFn: async () =>
      source.kind === "design"
        ? (
            await browserApi().GET("/v1/store/studio/{designId}/comments", {
              params: { path: { designId: source.designId } },
            })
          ).data!
        : (
            await browserApi().GET("/v1/store/studio/shared/{token}/comments", {
              params: { path: { token: source.token } },
            })
          ).data!,
    staleTime: 15_000,
  });

  const add = async (input: NewComment) => {
    const body = {
      body: input.body,
      ...(input.anchor ? { anchor: input.anchor as Schemas["FaceAnchorDto"] } : {}),
      ...(input.parentId ? { parentId: input.parentId } : {}),
      ...(input.mentions?.length ? { mentions: input.mentions } : {}),
      ...(input.versionNo ? { versionNo: input.versionNo } : {}),
    };
    if (source.kind === "design")
      await browserApi().POST("/v1/store/studio/{designId}/comments", {
        params: { path: { designId: source.designId } },
        body,
      });
    else
      await browserApi().POST("/v1/store/studio/shared/{token}/comments", {
        params: { path: { token: source.token } },
        body,
      });
    await client.invalidateQueries({ queryKey: key });
  };

  /** Resolving is the design's (its owner, a company member or the thread's author), not a link's. */
  const resolve =
    source.kind === "design"
      ? async (commentId: string) => {
          await browserApi().POST("/v1/store/studio/{designId}/comments/{commentId}/actions/resolve", {
            params: { path: { designId: source.designId, commentId } },
          });
          await client.invalidateQueries({ queryKey: key });
        }
      : null;

  return { list, add, resolve };
}

/** Threads: each root (oldest first) with its replies. */
export function threadsOf(comments: readonly Comment[]): { root: Comment; replies: Comment[] }[] {
  const roots = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return roots.map((root) => ({
    root,
    replies: comments.filter((c) => c.parentId === root.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}
