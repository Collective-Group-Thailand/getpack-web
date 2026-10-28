import { useTranslations } from "next-intl";

import { Skeleton } from "@/ui/components/Skeleton";

/** The orders list while it loads (account pack Phase 2 item 6): the head, the tabs and three card shapes. */
export default function Loading() {
  const t = useTranslations("myOrders.list");
  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-11 w-full max-w-xl rounded-xl" />
      {[0, 1, 2].map((n) => (
        <div
          key={n}
          className="border-border bg-surface grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 rounded-[18px] border p-[1.125rem]"
        >
          <Skeleton className="size-[4.5rem] rounded-[14px]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
