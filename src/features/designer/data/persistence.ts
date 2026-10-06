"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isApiError } from "@/lib/api/problem";

import { readDesign } from "../document";
import { designRepo } from "../storage";
import { useEditor } from "../store/editor";
import type { DesignContent, DesignSpec } from "../types";
import type { JsonValue } from "../lib/json-patch";
import { adminDocuments, documentOf, storeDesigns, type BoxFields, type CreateInput } from "./api";
import { drafts, type Draft } from "./drafts";

/**
 * Where a design is kept and how it is saved.
 *
 * - `local` — a guest's design in this browser (as BoxStudio did); autosaved a moment after each
 *   change, like the others (the browser's storage is its home, so there is no separate draft).
 * - `store` — a signed-in customer's design in the account (`store.designs`): autosaved a
 *   moment after each change under `If-Match`; a save another tab beat answers 412 and opens the
 *   conflict choice instead of overwriting; unsaved work is kept in IndexedDB meanwhile.
 * - `admin` — prepress's own copy of a design (`admin.design-documents`), same rules; a
 *   customer's document opens read-only and is never saved from here.
 */
export type PersistenceMode = "local" | "store" | "admin" | "shared";

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
   * store design cannot be created — the product is required; a guest's design keeps the product
   * id too, for its import.
   */
  create?: Omit<CreateInput, "name" | "spec" | "content">;
  /** Called once a new design has its server (or local) id — the page swaps `/design/new` for it. */
  onCreated?: (id: string) => void;
  /** Called after every save the server (or browser) confirmed — the storefront measures the first. */
  onSaved?: () => void;
  /** A PNG data URL of the sheet for the design's card, or `null` while the canvas is not ready. */
  thumbnail: () => string | null;
  /**
   * The studio (U4.1): the box fields and calculator spec saved with each version (D-275), or
   * `null` while they cannot be told (the product's configurator is loading). With it, an
   * autosave that changes neither the box nor the name goes as JSON Patch (D-276).
   */
  box?: () => BoxFields | null;
  /** The box fields the server's current version has, as the page read them. */
  initialBox?: BoxFields | null;
  /**
   * An edit link (U4.7, D-285, mode `shared`): its token, and the document as packio-api answered it
   * — every save is a JSON Patch from that document, under the link's ETag.
   */
  shared?: { token: string; document: { spec: unknown; content: unknown } };
}

/** What the server's current version was saved with: its number and box (the studio prices it). */
export interface SavedBox {
  versionNo: number | null;
  box: BoxFields | null;
}

/** Autosave waits this long after the last change (ms). */
export const AUTOSAVE_DELAY_MS = 2500;
/** A change of the box itself is saved sooner: the studio's price waits for it (ms). */
export const BOX_SAVE_DELAY_MS = 400;
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
  /** The document and name the server's current version has — what the next patch is made against. */
  const sent = useRef<{ document: JsonValue; name: string } | null>(null);
  const [savedBox, setSavedBox] = useState<SavedBox>({
    versionNo: config.versionNo,
    box: config.initialBox ?? null,
  });
  const boxRef = useRef<BoxFields | null>(config.initialBox ?? null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const again = useRef<"autosave" | "manual" | null>(null);
  const followUp = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  const draftKey = () => serverId.current ?? useEditor.getState().designId;
  // The queued save after an in-flight one calls back through this, not through itself.
  const rerun = useRef<((kind: "autosave" | "manual") => Promise<boolean>) | null>(null);

  /** Saves the editor's current document; resolves `true` when the server (or browser) has it. */
  const saveNow = useCallback(
    async (kind: "autosave" | "manual", label?: string): Promise<boolean> => {
      const cfg = configRef.current;
      if (!cfg.editable) return false;
      if (inFlight.current) {
        again.current = kind === "manual" || again.current === "manual" ? "manual" : "autosave";
        // Resolve when the queued save has run, not the one in flight: a "บันทึก" pressed during an
        // autosave must not report saved before the change it carries is stored.
        if (!followUp.current) {
          let resolve!: (ok: boolean) => void;
          followUp.current = { promise: new Promise<boolean>((done) => (resolve = done)), resolve };
        }
        return followUp.current.promise;
      }
      const snapshot = useEditor.getState();
      if (!snapshot.spec) return false;
      const { spec, content, name } = snapshot;
      const run = (async () => {
        // Yield first: a guest's save is synchronous, and without this its `finally` cleared
        // `inFlight` before `inFlight.current = run` below set it — leaving it set for good, so
        // every later save was taken for one "already in flight" and never ran.
        await Promise.resolve();
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
              // The product it was opened with, so importing it into an account can name it.
              catalogProductId: cfg.create?.catalogProductId ?? previous?.catalogProductId,
              createdAt: previous?.createdAt ?? now,
              updatedAt: now,
            });
            if (!ok) throw new Error("storage.full");
            setLastSavedAt(new Date(now).toISOString());
            if (!previous) cfg.onCreated?.(snapshot.designId);
          } else if (cfg.mode === "store") {
            const box = cfg.box?.() ?? null;
            // Only the studio patches (U4.1): the plain designer never loads the diff.
            const patching = cfg.box ? await import("../lib/json-patch") : null;
            const boxChanged = !!box && !!patching && !patching.sameJson(box, boxRef.current);
            const document = { spec, content } as unknown as JsonValue;
            let saved;
            if (!serverId.current) {
              if (!cfg.create) throw new Error("design.product_unknown");
              saved = await storeDesigns.create({ ...cfg.create, name, spec, content, box });
              await drafts.remove(snapshot.designId);
              serverId.current = saved.data.id;
              cfg.onCreated?.(saved.data.id);
            } else {
              const operations =
                patching && kind === "autosave" && !boxChanged && sent.current?.name === name
                  ? patching.diff(sent.current.document, document)
                  : null;
              if (
                operations &&
                operations.length > 0 &&
                patching!.patchBytes(operations) <= patching!.MAX_PATCH_BYTES
              ) {
                saved = await storeDesigns.patch(serverId.current, { kind, operations }, etag.current);
              } else if (operations && operations.length === 0) {
                saved = null;
              } else {
                let thumbnailFileId: string | undefined;
                const png = kind === "manual" ? cfg.thumbnail() : null;
                if (png) thumbnailFileId = await storeDesigns.uploadThumbnail(png, name).catch(() => undefined);
                saved = await storeDesigns.save(
                  serverId.current,
                  {
                    name,
                    kind,
                    spec,
                    content,
                    thumbnailFileId,
                    box: boxChanged ? box : null,
                    ...(label ? { label } : {}),
                  },
                  etag.current,
                );
              }
            }
            sent.current = { document, name };
            if (saved) {
              etag.current = saved.etag;
              versionNo.current = saved.data.versionNo;
              setLastSavedAt(saved.data.updatedAt);
            }
            if (boxChanged) boxRef.current = box;
            const savedVersion = saved?.data.versionNo ?? null;
            if (savedVersion !== null)
              setSavedBox((previous) =>
                boxChanged || previous.versionNo === null ? { versionNo: savedVersion, box: boxRef.current } : previous,
              );
          } else if (cfg.mode === "shared" && cfg.shared) {
            const patching = await import("../lib/json-patch");
            const document = { spec, content } as unknown as JsonValue;
            const from = sent.current?.document ?? (cfg.shared.document as unknown as JsonValue);
            const operations = patching.diff(from, document);
            if (operations.length > 0) {
              if (patching.patchBytes(operations) > patching.MAX_PATCH_BYTES)
                throw new Error("designs.patch_too_large");
              const saved = await storeDesigns.patchShared(
                cfg.shared.token,
                { kind, operations, ...(label ? { label } : {}) },
                etag.current,
              );
              etag.current = saved.etag;
              versionNo.current = saved.data.versionNo;
              setLastSavedAt(saved.data.updatedAt);
            }
            sent.current = { document, name };
          } else if (serverId.current) {
            const saved = await adminDocuments.save(
              serverId.current,
              { title: name, kind, spec, content },
              etag.current,
            );
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
      const waiting = followUp.current;
      followUp.current = null;
      if (next && useEditor.getState().dirty) {
        const queued = rerun.current?.(next) ?? Promise.resolve(false);
        if (waiting) void queued.then(waiting.resolve);
      } else waiting?.resolve(ok);
      return ok;
    },
    [setState],
  );
  useEffect(() => {
    rerun.current = saveNow;
  }, [saveNow]);

  // Autosave a moment after each change, and for an account's design an IndexedDB draft too (a
  // guest's local design needs none: the browser *is* its storage). This replaces the browser's
  // `beforeunload` prompt (UX audit, studio).
  useEffect(() => {
    if (!config.editable) return;
    const local = config.mode === "local";
    let autosave: ReturnType<typeof setTimeout> | undefined;
    let draft: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.content === prev.content && s.spec === prev.spec && s.name === prev.name) return;
      if (!s.dirty) return;
      const delay = s.spec !== prev.spec ? BOX_SAVE_DELAY_MS : AUTOSAVE_DELAY_MS;
      if (stateRef.current !== "conflict") setState("dirty");
      clearTimeout(draft);
      if (!local)
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
      }, delay);
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
      const cfg = configRef.current;
      if (cfg.mode === "shared" && cfg.shared) {
        // An edit link: the latest through the link (no copy — the design is not this user's).
        const latest = await storeDesigns.getShared(cfg.shared.token);
        etag.current = latest.etag;
        if (choice === "theirs") {
          const document = latest.data.document as { spec?: unknown; content?: unknown } | null;
          const read = document ? readDesign(document.spec, document.content) : null;
          const editor = useEditor.getState();
          if (read)
            editor.load({ id: editor.designId, name: latest.data.title, spec: read.spec, content: read.content });
          sent.current = document ? { document: document as JsonValue, name: latest.data.title } : null;
          setState("saved");
          return;
        }
        // Mine over theirs: patched from their document, so the patch applies.
        sent.current = { document: latest.data.document as JsonValue, name: latest.data.title };
        setState("dirty");
        await saveNow("manual");
        return;
      }
      const id = serverId.current;
      if (!id) return;
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
        // Their version: the next save is made whole, with the box as it is then.
        sent.current = null;
        boxRef.current = null;
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
        const restoredDocument = documentOf(restored.data);
        const read = restoredDocument ? readDesign(restoredDocument.spec, restoredDocument.content) : null;
        const editor = useEditor.getState();
        if (read)
          editor.load({ id: editor.designId, name: restored.data.title, spec: read.spec, content: read.content });
        etag.current = restored.etag;
        versionNo.current = restored.data.versionNo;
        sent.current = null;
        boxRef.current = null;
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
    /** The server's current version number (U4.5: the checks run on it). */
    versionNo: () => versionNo.current,
    /** The version the studio prices and the box it was saved with (U4.1). */
    savedBox,
  };
}

export type Persistence = ReturnType<typeof usePersistence>;

/** The editor's document as the API's `{ spec, content }` pair, for a caller that needs it once. */
export function currentDocument(): { spec: DesignSpec; content: DesignContent } | null {
  const { spec, content } = useEditor.getState();
  return spec ? { spec, content } : null;
}
