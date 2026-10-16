"use client";

import type { DesignContent, DesignSpec } from "../types";

/**
 * Unsaved work kept in this browser's IndexedDB (F4 C.1 "offline draft"): written a moment after
 * every change, removed once the API has the version. If the tab closes, the network drops or a
 * save fails, the next open offers it back. IndexedDB can be missing (private windows, blocked
 * storage) — every call then quietly does nothing, and the designer works as before.
 */

export interface Draft {
  /** The design id, or the editor's temporary id for a design not yet created. */
  key: string;
  name: string;
  spec: DesignSpec | null;
  content: DesignContent;
  /** The server version the draft was edited from; `null` for a design never saved. */
  baseVersionNo: number | null;
  savedAt: number;
}

const DB_NAME = "getpack-designer";
const STORE = "drafts";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export const drafts = {
  put: (draft: Draft) => run("readwrite", (store) => store.put(draft)),
  get: (key: string) => run<Draft>("readonly", (store) => store.get(key) as IDBRequest<Draft>),
  remove: (key: string) => run("readwrite", (store) => store.delete(key)),
};
