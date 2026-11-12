/*
 * getpack Agent's service worker (D-467) — the agent host only (`src/proxy.ts` serves this file there and nowhere
 * else). Three jobs, nothing more:
 *
 *   1. an offline shell: a page that fails to load because the device is offline gets `/offline` — a calm screen
 *      with a way to try again — instead of the browser's error. Navigations only, network first: getpack Agent's
 *      figures (leads, commission, statements) are never served from a cache, because acting on a stale commission
 *      or a lead whose protection has run out is worse than waiting for the network;
 *   2. web push for agent events (`store.agentPush.*`), as `/sw.js` does for the other zones;
 *   3. the lead draft queue (D-468, below): leads saved on the device while offline, sent by background sync.
 */

const SHELL_CACHE = "getpack-agent-shell-v2";
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
 * The lead draft queue (D-468): a lead registered without a connection is kept on the device in IndexedDB by the page
 * (`src/features/agent/drafts/drafts.ts` — keep the names and the request in step) and sent here, under this
 * background-sync tag, once the browser is back online. A sent draft is removed; a refusal (a duplicate, say) is kept
 * with its reason for the agent to see; anything else waits for the next sync. Open pages are told to refresh.
 */
const LEAD_DRAFT_SYNC_TAG = "agent-lead-drafts";
const DRAFT_DB = "getpack-agent";
const DRAFT_STORE = "lead-drafts";

function openDrafts() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) request.result.createObjectStore(DRAFT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function draftStore(db, mode, work) {
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(DRAFT_STORE, mode).objectStore(DRAFT_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The page sends the same queue on its `online` event: one Web Lock keeps a draft from being sent twice. */
const DRAFT_LOCK = "getpack-agent-lead-drafts";
function flushLeadDrafts() {
  return self.navigator.locks ? self.navigator.locks.request(DRAFT_LOCK, flushLeadDraftsUnlocked) : flushLeadDraftsUnlocked();
}

async function flushLeadDraftsUnlocked() {
  const db = await openDrafts();
  let changed = false;
  try {
    const drafts = (await draftStore(db, "readonly", (store) => store.getAll())).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    for (const draft of drafts) {
      if (draft.refused) continue;
      const response = await fetch("/bff/v1/store/agent/leads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-getpack-csrf": "1" },
        body: JSON.stringify(draft.body),
      });
      if (response.ok) {
        await draftStore(db, "readwrite", (store) => store.delete(draft.id));
        changed = true;
      } else if (response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status)) {
        const problem = await response.json().catch(() => null);
        await draftStore(db, "readwrite", (store) =>
          store.put({ ...draft, refused: { code: (problem && problem.code) || "http.conflict", detail: (problem && problem.detail) || "" } }),
        );
        changed = true;
      } else {
        // Offline again, signed out or a server error: throw so the browser retries this sync later.
        throw new Error(`lead draft not sent (${response.status})`);
      }
    }
  } finally {
    db.close();
    if (changed) {
      for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "lead-drafts-flushed" });
    }
  }
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
      // An event with a deep link (a lead, a quote) opens it; one without opens on ภาพรวม.
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
