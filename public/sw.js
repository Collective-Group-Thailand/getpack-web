/*
 * getpack service worker — web push only (D-143).
 *
 * Deliberately not an offline cache. Caching a storefront that shows live prices and lead
 * times, or a shop-floor app whose job states must be current, is how people end up acting on
 * stale information; partner offline sync is explicitly R2 (D-111). So this file handles
 * exactly two events and installs no fetch handler at all — with no `fetch` listener the
 * browser bypasses the worker entirely for navigation, which is also the fastest option.
 *
 * Served from the app root so its scope is the whole origin. `src/proxy.ts` passes it through
 * unrewritten (`ROOT_ASSETS`), so it still carries the zone's security headers.
 */

// Take over as soon as a new version is installed, rather than waiting for every tab holding
// the old one to close. A push worker has no state to migrate, and a stale one silently keeps
// showing the old notification shape.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, url, tag } = payload;
  if (!title) return;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      // `tag` collapses repeats: three updates on one order replace each other rather than
      // stacking up three notifications for the same thing.
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = event.notification.data && event.notification.data.url;
  if (!target) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus a tab already on this origin instead of opening a fourth copy of the app —
      // which is what happens on a phone otherwise, and it loses whatever was in progress.
      for (const client of clients) {
        if ("focus" in client) return client.focus().then((focused) => focused.navigate(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});
