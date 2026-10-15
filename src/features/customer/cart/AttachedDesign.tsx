"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * The Studio design a cart line orders (`designDocumentId`, B4.1), named so the customer sees which
 * design — and which pinned version (D-276) — goes to print, with a way back into the studio.
 */
export function AttachedDesign({ designId, versionNo }: { designId: string; versionNo: number | null }) {
  const t = useTranslations("cart.attachedDesign");
  const design = useQuery({
    queryKey: [...queryKeys.zone("customer"), "design-brief", designId],
    queryFn: async ({ signal }) =>
      (await browserApi().GET("/v1/store/designs/{designId}", { params: { path: { designId } }, signal })).data!,
    staleTime: 60_000,
  });
  return (
    <p className="text-muted mt-1 text-xs">
      {design.data
        ? t("named", { title: design.data.title, version: versionNo ?? design.data.versionNo ?? 1 })
        : t("loading")}{" "}
      <Link href={`/studio/${designId}`} className="text-primary underline underline-offset-4">
        {t("open")}
      </Link>
    </p>
  );
}
