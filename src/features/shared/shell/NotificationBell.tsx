"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { queryKeys } from "@/lib/api/query-keys";
import type { Zone } from "@/lib/zones";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconButton } from "@/ui/components/IconButton";
import { Popover } from "@/ui/components/Popover";
import { Spinner } from "@/ui/components/Spinner";

import { markAllRead, useNotifications } from "./notifications";

/**
 * The in-app notification centre, in every zone (D-143).
 *
 * The feed is a contract request (`notifications.feed`), so what ships is the control, the
 * count, the empty state and the read action — against a mock. Realtime invalidates the same
 * query key, so when a driver is configured the badge updates without polling.
 */
export function NotificationBell({ zone }: { zone: Zone }) {
  const t = useTranslations("common.notifications");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isPending } = useNotifications(zone);
  const items = data?.data ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;

  async function onMarkAllRead() {
    await markAllRead(zone);
    await queryClient.invalidateQueries({ queryKey: queryKeys.list(zone, "notifications") });
  }

  return (
    /*
     * The positioning wrapper sits *outside* the trigger, not around it.
     *
     * Radix's `Popover.Trigger asChild` forwards `aria-expanded` and `aria-haspopup` onto
     * whatever element it is given. With the badge and the button wrapped in one `<span>`,
     * that span became the trigger — and those attributes are invalid on a generic element,
     * which axe reports as a critical `aria-allowed-attr` failure.
     */
    <span className="relative inline-flex">
      <Popover
        open={open}
        onOpenChange={setOpen}
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
          <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
            <h2 className="text-sm font-medium">{t("title")}</h2>
            {unreadCount > 0 ? (
              <Button variant="link" size="sm" onClick={onMarkAllRead}>
                {t("markAllRead")}
              </Button>
            ) : null}
          </div>

          {isPending ? (
            <div className="flex justify-center py-8">
              <Spinner label={t("loading")} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon="bell" title={t("empty.title")} description={t("empty.body")} />
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="border-border border-b last:border-0">
                  <a
                    href={item.url ?? "#"}
                    className="hover:bg-surface-subtle flex gap-2 px-3 py-2.5"
                    onClick={() => setOpen(false)}
                  >
                    {/* Unread is a dot *and* a bolder title: never colour alone. */}
                    <span
                      aria-hidden
                      className={
                        item.readAt ? "mt-1.5 size-2 shrink-0" : "bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                      }
                    />
                    <span className="min-w-0">
                      <span className={item.readAt ? "block text-sm" : "block text-sm font-medium"}>
                        {item.title}
                        {item.readAt ? null : <span className="sr-only"> {t("unread")}</span>}
                      </span>
                      <span className="text-muted block text-xs">{item.body}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
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
