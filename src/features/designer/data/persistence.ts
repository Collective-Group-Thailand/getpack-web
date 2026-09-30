"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isApiError } from "@/lib/api/problem";

import { readDesign } from "../document";
import { designRepo } from "../storage";
import { useEditor } from "../store/editor";
import type { DesignContent, DesignSpec } from "../types";
import { adminDocuments, documentOf, storeDesigns, type CreateInput } from "./api";
import { drafts, type Draft } from "./drafts";

/**
 * Where a design is kept and how it is saved.
 *
 * - `local` — a guest's design in this browser (as BoxStudio did); saved when asked.
 * - `store` — a signed-in customer's design in the account (`store.designs`): autosaved a
 *   moment after each change under `If-Match`; a save another tab beat answers 412 and opens the
 *   conflict choice instead of overwriting; unsaved work is kept in IndexedDB meanwhile.
 * - `admin` — prepress's own copy of a design (`admin.design-documents`), same rules; a
 *   customer's document opens read-only and is never saved from here.
 */
export type PersistenceMode = "local" | "store" | "admin";

export type SaveState = "saved" | "dirty" | "saving" | "offline" | "conflict" | "error" | "readonly";

export interface PersistenceConfig {
  mode: PersistenceMode;
  editable: boolean;
  /** The design's id on the server; `null` for a new store design not created yet. */
  serverId: string | null;
  etag: string | null;
  versionNo: number | null;
  /** When the server copy was last saved (ISO), to tell whether a local draft is newer. */
  updatedAt: string | null;
  /**
   * How a new store design is created (its product, pattern, material, template). Without it a
   * store design cannot be created — the product is required (CONTRACT-GAP store.catalog-product-ref).
   */
  create?: Omit<CreateInput, "name" | "spec" | "content">;
  /** Called once a new design has its server (or local) id — the page swaps `/design/new` for it. */
  onCreated?: (id: string) => void;
  /** Called after every save the server (or browser) confirmed — the storefront measures the first. */
  onSaved?: () => void;
  /** A PNG data URL of the sheet for the design's card, or `null` while the canvas is not ready. */
  thumbnail: () => string | null;
}

/** Autosave waits this long after the last change (ms). */
export const AUTOSAVE_DELAY_MS = 2500;
/** A draft is written this long after the last change (ms). */
const DRAFT_DELAY_MS = 800;

const isOffline = (error: unknown) =>
  (typeof navigator !== "undefined" && navigator.onLine === false) ||
  (error instanceof TypeError && /fetch|network/i.test(error.message));

export function usePersistence(config: PersistenceConfig) {
  const [state, setStateValue] = useState<SaveState>(config.editable ? "saved" : "readonly");
  // Read by timers and callbacks, which must not wait for a render to see the latest state.
  const stateRef = useRef<SaveState>(config.editable ? "saved" : "readonly");
  const setState = useCallback((next: SaveState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(config.updatedAt);
  const [draftOffer, setDraftOffer] = useState<Draft | null>(null);

  const serverId = useRef(config.serverId);
  const etag = useRef(config.etag);
  const versionNo = useRef(config.versionNo);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const again = useRef<"autosave" | "manual" | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  const draftKey = () => serverId.current ?? useEditor.getState().designId;
  // The queued save after an in-flight one calls back through this, not through itself.
  const rerun = useRef<((kind: "autosave" | "manual") => Promise<boolean>) | null>(null);

  /** Saves the editor's current document; resolves `true` when the server (or browser) has it. */
  const saveNow = useCallback(
    async (kind: "autosave" | "manual"): Promise<boolean> => {
      const cfg = configRef.current;
      if (!cfg.editable) return false;
      if (inFlight.current) {
        again.current = kind === "manual" || again.current === "manual" ? "manual" : "autosave";
        return inFlight.current;
      }
      const snapshot = useEditor.getState();
      if (!snapshot.spec) return false;
      const { spec, content, name } = snapshot;
      const run = (async () => {
        setState("saving");
        try {
          if (cfg.mode === "local") {
            const now = Date.now();
            const previous = designRepo.get(snapshot.designId);
            const ok = designRepo.save({
              id: snapshot.designId,
              name,
              spec,
              content,
              thumbnail: cfg.thumbnail() ?? previous?.thumbnail,
              createdAt: previous?.createdAt ?? now,
              updatedAt: now,
            });
            if (!ok) throw new Error("storage.full");
            if (!previous) cfg.onCreated?.(snapshot.designId);
          } else if (cfg.mode === "store") {
            if (!serverId.current) {
              if (!cfg.create) throw new Error("design.product_unknown");
              const created = await storeDesigns.create({ ...cfg.create, name, spec, content });
              await drafts.remove(snapshot.designId);
              serverId.current = created.data.id;
              etag.current = created.etag;
              versionNo.current = created.data.versionNo;
              setLastSavedAt(created.data.updatedAt);
              cfg.onCreated?.(created.data.id);
            } else {
              let thumbnailFileId: string | undefined;
              const png = kind === "manual" ? cfg.thumbnail() : null;
              if (png) thumbnailFileId = await storeDesigns.uploadThumbnail(png, name).catch(() => undefined);
              const saved = await storeDesigns.save(
                serverId.current,
                { name, spec, content, thumbnailFileId },
                etag.current,
              );
              etag.current = saved.etag;
              versionNo.current = saved.data.versionNo;
              setLastSavedAt(saved.data.updatedAt);
            }
          } else if (serverId.current) {
            const saved = await adminDocuments.save(serverId.current, { title: name, spec, content }, etag.current);
            etag.current = saved.etag;
            versionNo.current = saved.data.versionNo;
            setLastSavedAt(saved.data.updatedAt);
          }
          // Saved what was on screen when the save started; a change made meanwhile stays dirty.
          const now = useEditor.getState();
          if (now.content === content && now.spec === spec && now.name === name) now.markSaved();
          if (cfg.mode !== "local") await drafts.remove(draftKey());
          setState(useEditor.getState().dirty ? "dirty" : "saved");
          cfg.onSaved?.();
          return true;
        } catch (error) {
          if (isApiError(error) && error.status === 412) setState("conflict");
          else if (isOffline(error)) setState("offline");
          else setState("error");
          return false;
        } finally {
          inFlight.current = null;
        }
      })();
      inFlight.current = run;
      const ok = await run;
      const next = again.current;
      again.current = null;
      if (next && useEditor.getState().dirty) void rerun.current?.(next);
      return ok;
    },
    [setState],
  );
  useEffect(() => {
    rerun.current = saveNow;
  }, [saveNow]);

  // Autosave, and the IndexedDB draft, a moment after each change (not for a guest's local design:
  // the browser *is* its storage, and the e2e flow saves it by hand).
  useEffect(() => {
    if (!config.editable || config.mode === "local") return;
    let autosave: ReturnType<typeof setTimeout> | undefined;
    let draft: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.content === prev.content && s.spec === prev.spec && s.name === prev.name) return;
      if (!s.dirty) return;
      if (stateRef.current !== "conflict") setState("dirty");
      clearTimeout(draft);
      draft = setTimeout(() => {
        void drafts.put({
          key: draftKey(),
          name: s.name,
          spec: s.spec,
          content: s.content,
          baseVersionNo: versionNo.current,
          savedAt: Date.now(),
        });
      }, DRAFT_DELAY_MS);
      clearTimeout(autosave);
      autosave = setTimeout(() => {
        if (stateRef.current !== "conflict") void saveNow("autosave");
      }, AUTOSAVE_DELAY_MS);
    });
    const onOnline = () => {
      if (useEditor.getState().dirty) void saveNow("autosave");
    };
    window.addEventListener("online", onOnline);
    return () => {
      unsubscribe();
      clearTimeout(autosave);
      clearTimeout(draft);
      window.removeEventListener("online", onOnline);
    };
  }, [config.editable, config.mode, saveNow, setState]);

  // A draft newer than the server's copy is offered back once, on open.
  useEffect(() => {
    if (!config.editable || config.mode === "local") return;
    let cancelled = false;
    void drafts.get(draftKey()).then((found) => {
      if (cancelled || !found) return;
      const server = config.updatedAt ? Date.parse(config.updatedAt) : 0;
      if (found.savedAt > server) setDraftOffer(found);
      else void drafts.remove(found.key);
    });
    return () => {
      cancelled = true;
    };
    // Once per opened design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.serverId]);

  const restoreDraft = useCallback(() => {
    if (!draftOffer) return;
    const editor = useEditor.getState();
    editor.load({ id: editor.designId, name: draftOffer.name, spec: draftOffer.spec, content: draftOffer.content });
    useEditor.setState({ dirty: true });
    setDraftOffer(null);
    setState("dirty");
    void saveNow("autosave");
  }, [draftOffer, saveNow, setState]);

  const discardDraft = useCallback(() => {
    if (draftOffer) void drafts.remove(draftOffer.key);
    setDraftOffer(null);
  }, [draftOffer]);

  /**
   * After a 412: keep mine (saved over theirs, as a new version — theirs stays in the history),
   * take theirs (reload the latest), or save mine as a separate copy.
   */
  const resolveConflict = useCallback(
    async (choice: "mine" | "theirs" | "copy") => {
      const id = serverId.current;
      if (!id) return;
      const cfg = configRef.current;
      const latest = cfg.mode === "admin" ? await adminDocuments.get(id) : await storeDesigns.get(id);
      if (choice === "mine") {
        etag.current = latest.etag;
        setState("dirty");
        await saveNow("manual");
        return;
      }
      if (choice === "theirs") {
        const document = documentOf(latest.data);
        const read = document ? readDesign(document.spec, document.content) : null;
        const editor = useEditor.getState();
        const name = latest.data.title;
        if (read) editor.load({ id: editor.designId, name, spec: read.spec, content: read.content });
        etag.current = latest.etag;
        versionNo.current = latest.data.versionNo ?? versionNo.current;
        await drafts.remove(draftKey());
        setState("saved");
        return;
      }
      if (cfg.mode === "store" && cfg.create) {
        const editor = useEditor.getState();
        if (!editor.spec) return;
        const copy = await storeDesigns.create({
          ...cfg.create,
          name: editor.name,
          spec: editor.spec,
          content: editor.content,
        });
        editor.markSaved();
        setState("saved");
        cfg.onCreated?.(copy.data.id);
      }
    },
    [saveNow, setState],
  );

  /** Restores a saved version (store designs), as a new version, and loads it. */
  const restoreVersion = useCallback(
    async (version: number) => {
      const id = serverId.current;
      if (!id) return false;
      try {
        const restored = await storeDesigns.restore(id, version, etag.current);
        const read = readDesign(restored.data.document.spec, restored.data.document.content);
        const editor = useEditor.getState();
        if (read)
          editor.load({ id: editor.designId, name: restored.data.name, spec: read.spec, content: read.content });
        etag.current = restored.etag;
        versionNo.current = restored.data.versionNo;
        setLastSavedAt(restored.data.updatedAt);
        setState("saved");
        return true;
      } catch (error) {
        if (isApiError(error) && error.status === 412) setState("conflict");
        return false;
      }
    },
    [setState],
  );

  return {
    state,
    lastSavedAt,
    save: saveNow,
    draftOffer,
    restoreDraft,
    discardDraft,
    resolveConflict,
    restoreVersion,
    serverId: () => serverId.current,
  };
}

export type Persistence = ReturnType<typeof usePersistence>;

/** The editor's document as the API's `{ spec, content }` pair, for a caller that needs it once. */
export function currentDocument(): { spec: DesignSpec; content: DesignContent } | null {
  const { spec, content } = useEditor.getState();
  return spec ? { spec, content } : null;
}
