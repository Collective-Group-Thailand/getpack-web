"use client";

import dynamic from "next/dynamic";

/**
 * The notification bell, for a signed-in customer only, in its own chunk.
 *
 * Next ships every client module a server component *imports*, rendered or not — so importing
 * `NotificationBell` into the (server) header put its Popover, its query and the shared shell
 * barrel's locale menu into every guest's page. Imported here, dynamically, it is fetched only
 * when there is a session to show it for.
 */
const NotificationBell = dynamic(() =>
  import("@/features/shared/shell/NotificationBell").then((module) => module.NotificationBell),
);

export function CustomerBell() {
  return <NotificationBell zone="customer" />;
}
