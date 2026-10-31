"use client";

import { useTranslations } from "next-intl";

import { DetailLayout } from "@/ui/components/DetailLayout";
import { Skeleton } from "@/ui/components/Skeleton";

/**
 * A record page while it loads: the shape of what is coming — the way back, the title, the record's blocks and the
 * side panel — instead of a blank page (UX checklist: skeletons, stable layout). `form` swaps the side panel for a
 * form's summary column.
 */
export function DetailSkeleton() {
  const t = useTranslations("common.state");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6 md:gap-7">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <DetailLayout aside={<Skeleton className="rounded-card h-56" />}>
        <Skeleton className="rounded-card h-28" />
        <Skeleton className="rounded-card h-64" />
      </DetailLayout>
    </div>
  );
}
