/**
 * The lead draft queue (D-468, PROMPT P3 Web 2): a lead registered without a connection is kept on this device in
 * IndexedDB and sent when the connection returns — by the service worker's background sync where the browser has it
 * (`public/agent-sw.js`, tag `agent-lead-drafts`), else by the page on the `online` event and on the next visit.
 *
 * The database and store names, the record shape and the request are shared with the service worker, which cannot
 * import this module: keep them in step with `flushLeadDrafts` there. Only this device's agent sees these drafts;
 * a sent or refused draft is removed (a refusal stays visible with its reason until the agent dismisses it).
 */

export const DRAFT_DB = "getpack-agent";
export const DRAFT_STORE = "lead-drafts";
export const DRAFT_SYNC_TAG = "agent-lead-drafts";
/** The BFF path the queue posts to — `store.agent.registerLead` through the agent zone's own BFF. */
export const DRAFT_ENDPOINT = "/bff/v1/store/agent/leads";

export interface LeadDraft {
  id: string;
  /** `RegisterAgentLeadDto`, exactly as it will be sent. */
  body: Record<string, unknown> & { contactName: string };
  createdAt: string;
  /** Set when the API refused the draft (a duplicate, say): the problem's code and sentence. */
  refused?: { code: string; detail: string } | null;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) {
        request.result.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(DRAFT_STORE, mode);
      const request = work(transaction.objectStore(DRAFT_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const available = () => typeof indexedDB !== "undefined";

export async function listDrafts(): Promise<LeadDraft[]> {
  if (!available()) return [];
  const all = await run<LeadDraft[]>("readonly", (store) => store.getAll() as IDBRequest<LeadDraft[]>);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveDraft(body: LeadDraft["body"]): Promise<LeadDraft> {
  const draft: LeadDraft = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    body,
    createdAt: new Date().toISOString(),
    refused: null,
  };
  await run("readwrite", (store) => store.put(draft));
  return draft;
}

export async function putDraft(draft: LeadDraft): Promise<void> {
  await run("readwrite", (store) => store.put(draft));
}

export async function removeDraft(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}

/** What sending one draft came to: sent, refused for good (kept with the reason), or try again later. */
export type SendOutcome = "sent" | "refused" | "retry";

/**
 * Sends every queued draft once, oldest first. A 2xx removes it; a 4xx other than 401 / 408 / 429 keeps it as
 * refused with the problem's words; anything else (offline, 5xx, signed out) stops and waits for the next chance.
 */
export async function flushDrafts(
  send: (draft: LeadDraft) => Promise<{ ok: boolean; status: number; problem?: { code: string; detail: string } }>,
): Promise<{ sent: number; refused: number; waiting: number }> {
  // The service worker sends the same queue: one Web Lock (`DRAFT_LOCK`, taken there too) keeps the two from sending
  // one draft twice. Without the Locks API the page sends on its own.
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks) return locks.request(DRAFT_LOCK, () => flushUnlocked(send));
  return flushUnlocked(send);
}

/** The Web Lock both senders take (`public/agent-sw.js` too). */
export const DRAFT_LOCK = "getpack-agent-lead-drafts";

async function flushUnlocked(
  send: (draft: LeadDraft) => Promise<{ ok: boolean; status: number; problem?: { code: string; detail: string } }>,
): Promise<{ sent: number; refused: number; waiting: number }> {
  const result = { sent: 0, refused: 0, waiting: 0 };
  for (const draft of await listDrafts()) {
    if (draft.refused) continue;
    let outcome: SendOutcome = "retry";
    try {
      const response = await send(draft);
      if (response.ok) outcome = "sent";
      else if (response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status)) {
        outcome = "refused";
        await putDraft({ ...draft, refused: response.problem ?? { code: "http.conflict", detail: "" } });
      }
    } catch {
      outcome = "retry";
    }
    if (outcome === "sent") {
      await removeDraft(draft.id);
      result.sent += 1;
    } else if (outcome === "refused") result.refused += 1;
    else {
      result.waiting += 1;
      break;
    }
  }
  return result;
}

/** The page's sender: the same request the service worker makes, through this zone's BFF. */
export async function sendThroughBff(draft: LeadDraft) {
  const response = await fetch(DRAFT_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-getpack-csrf": "1" },
    body: JSON.stringify(draft.body),
  });
  let problem: { code: string; detail: string } | undefined;
  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as { code?: string; detail?: string } | null;
    if (json?.code) problem = { code: json.code, detail: json.detail ?? "" };
  }
  return { ok: response.ok, status: response.status, ...(problem ? { problem } : {}) };
}

/** Asks the service worker to send the queue when the connection is back (Chromium); a no-op elsewhere. */
export async function requestBackgroundSync(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker?.ready;
    const sync = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
      ?.sync;
    if (!sync) return false;
    await sync.register(DRAFT_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

/** The event the page listens to so the "รอส่ง" list refreshes when a draft is added or sent. */
export const DRAFTS_CHANGED = "getpack-agent:drafts-changed";
export const announceDraftsChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DRAFTS_CHANGED));
};
