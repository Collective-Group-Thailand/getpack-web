"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/ui/components/EmptyState";
import { IconButton } from "@/ui/components/IconButton";
import { Popover } from "@/ui/components/Popover";

/**
 * The in-app notification centre, in every zone (D-143).
 *
 * F1 1.3 ships the control and its empty state; the feed arrives in slice 6 with
 * `GET /v1/{surface}/notifications`, which is a contract request. The count is a prop rather
 * than fetched here so a server component can pass the first value and the realtime client
 * can update it without this component knowing which zone it is in.
 */
export function NotificationBell({ unreadCount = 0 }: { unreadCount?: number }) {
  const t = useTranslations("common.notifications");

  return (
    /*
     * The positioning wrapper sits *outside* the trigger, not around it.
     *
     * Radix's `Popover.Trigger asChild` forwards `aria-expanded` and `aria-haspopup` onto
     * whatever element it is given. With the badge and the button wrapped in one `<span>`,
     * that span became the trigger — and those attributes are invalid on a generic element,
     * which axe reports as a critical `aria-allowed-attr` failure. The button is the trigger;
     * the badge is a sibling positioned against this wrapper.
     */
    <span className="relative inline-flex">
      <Popover
        align="end"
        aria-label={t("title")}
        trigger={
          <IconButton
            name="bell"
            variant="ghost"
            size="sm"
            // The count is in the accessible name, not only in the dot: a red dot says
            // "something" to a sighted user and nothing at all to a screen reader.
            label={unreadCount > 0 ? t("labelWithCount", { count: unreadCount }) : t("label")}
          />
        }
      >
        <div className="w-80 max-w-[calc(100vw-2rem)]">
          <h2 className="border-border border-b px-3 py-2 text-sm font-medium">{t("title")}</h2>
          <EmptyState icon="bell" title={t("empty.title")} description={t("empty.body")} />
        </div>
      </Popover>

      {unreadCount > 0 ? (
        <span
          aria-hidden
          className="bg-danger text-danger-fg pointer-events-none absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-medium"
        >
          {unreadCount > 99 ? t("overflow") : unreadCount}
        </span>
      ) : null}
    </span>
  );
}
