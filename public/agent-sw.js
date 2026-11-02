/*
 * getpack Agent's service worker (D-467) — the agent host only (`src/proxy.ts` serves this file there and nowhere
 * else). Three jobs, nothing more:
 *
 *   1. an offline shell: a page that fails to load because the device is offline gets `/offline` — a calm screen
 *      with a way to try again — instead of the browser's error. Navigations only, network first: getpack Agent's
 *      figures (leads, commission, statements) are never served from a cache, because acting on a stale commission
 *      or a lead whose protection has run out is worse than waiting for the network;
 *   2. web push for agent events (`store.agentPush.*`), as `/sw.js` does for the other zones;
 *   3. the hook for Phase 3's lead draft queue (below) — a background sync tag with nothing queued yet.
 */

const SHELL_CACHE = "getpack-agent-shell-v1";
const OFFLINE_URL = "/offline";
const SHELL_FILES = [OFFLINE_URL, "/agent-app/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_FILES);
      // The offline page's own stylesheets, so it renders as itself without the network.
      try {
        const html = await (await cache.match(OFFLINE_URL)).text();
        const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1]);
        await cache.addAll(sheets.filter((href) => href.startsWith("/_next/static/")));
      } catch {
        // Unstyled is still better than the browser's offline error.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== SHELL_CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }
  // The offline page's stylesheets, when the network is gone; everything else goes straight to the network.
  if (request.method === "GET" && new URL(request.url).pathname.startsWith("/_next/static/")) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) ?? Response.error()));
  }
});

/*
 * Phase 3 hook — the lead draft queue. A lead registered without a connection will be kept on the device and sent
 * when it returns, under this background-sync tag. Nothing is queued in Phase 2, so there is nothing to send.
 */
const LEAD_DRAFT_SYNC_TAG = "agent-lead-drafts";
async function flushLeadDrafts() {
  return undefined;
}
self.addEventListener("sync", (event) => {
  if (event.tag === LEAD_DRAFT_SYNC_TAG) event.waitUntil(flushLeadDrafts());
});

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
      icon: "/agent-app/icon-192.png",
      badge: "/agent-app/icon-192.png",
      tag,
      // Agent events carry no deep link yet (API-CHANGES-P2: `url` is null); the app opens on ภาพรวม.
      data: { url: url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus().then((focused) => focused.navigate(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});
