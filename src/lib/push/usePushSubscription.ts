"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { CSRF_HEADER } from "@/lib/api/client";
import { clientEnv } from "@/lib/env";
import { browserBffUrl, type Zone } from "@/lib/zones";

import { decodeVapidKey, mayPrompt, pushPermissionState, type PushPermissionState } from "./vapid";

/** Where the browser is served; `/sw.js` so its scope is the whole origin. */
const SERVICE_WORKER_PATH = "/sw.js";

/**
 * Web push for the customer and partner zones (D-143).
 *
 * The shape of this hook is the policy: it returns `enable`, and `enable` is only ever called
 * from a handler on something a person deliberately did. There is no effect that prompts, and
 * `state` tells a caller whether asking is even possible — so "prompt only after a meaningful
 * action" is enforced by there being no other way to do it, rather than by a comment.
 *
 * CONTRACT-REQUEST `push.subscriptions`.
 */
export function usePushSubscription(zone: Zone) {
  // `useSyncExternalStore` rather than state-plus-effect: permission is browser state this
  // component reads, not state it owns. It also means a change made in the browser's own site
  // settings updates the UI, instead of leaving a "turn on notifications" button offering
  // something that was turned on in another tab.
  const state = useSyncExternalStore(subscribeToPermission, readPermissionState, readServerState);
  const [busy, setBusy] = useState(false);

  /**
   * Registers the worker, asks for permission, subscribes, and tells the API.
   *
   * Call it from a click, and only after something worth being notified about has happened —
   * an order placed, a job accepted. `mayPrompt` refuses otherwise.
   */
  const enable = useCallback(
    async (afterMeaningfulAction = true): Promise<boolean> => {
      const key = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key || !mayPrompt(state, afterMeaningfulAction)) return false;

      setBusy(true);
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
        const permission = await Notification.requestPermission();
        // No `setState`: the permission store below is notified by the browser, and forcing a
        // value here could disagree with it.
        notifyPermissionChanged();
        if (permission !== "granted") return false;

        const subscription = await registration.pushManager.subscribe({
          // Required by Chrome: a subscription that can send silent pushes is refused.
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(key),
        });

        /*
         * A plain `fetch`, not `browserApi()`.
         *
         * The typed client only knows paths that are in `schema.d.ts`, and this endpoint is a
         * contract request — it is not in the contract yet. Forcing it through with `as never`
         * would defeat the one mechanism that stops response types being invented (ADR-0006),
         * and would silently keep compiling on the day the real endpoint lands with a
         * different shape. This call goes back through `browserApi` as soon as it is real.
         *
         * Still through the BFF, so the session cookie authenticates it and no token reaches
         * the browser. `toJSON()` gives the `{ endpoint, keys: { p256dh, auth } }` shape the
         * push protocol defines and any server library expects.
         */
        await fetch(browserBffUrl(zone, "/push/subscriptions"), {
          method: "POST",
          headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
          body: JSON.stringify(subscription.toJSON()),
        });
        return true;
      } catch {
        // A refused prompt, a blocked worker, an API that is down: none of them should throw
        // out of a notification opt-in and break the screen the person was using.
        return false;
      } finally {
        setBusy(false);
      }
    },
    [state, zone],
  );

  return { state, busy, enable };
}

/* ---------------------------------------------------------------------------------------- *
 * The permission store.
 *
 * Browsers fire no event on `Notification.permission` itself, but the Permissions API exposes
 * the same value as a `PermissionStatus` that does emit `change` — so a person granting or
 * revoking notifications in site settings reaches the UI. Where that API is missing (Safari),
 * the value is still read correctly; it just will not update on its own, which is why `enable`
 * nudges the store after asking.
 * ---------------------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

function notifyPermissionChanged(): void {
  for (const listener of listeners) listener();
}

function subscribeToPermission(onChange: () => void): () => void {
  listeners.add(onChange);

  let status: PermissionStatus | undefined;
  void navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((result) => {
      status = result;
      result.addEventListener("change", notifyPermissionChanged);
    })
    .catch(() => {
      // Firefox refuses this query in a private window, and Safari has no such name. Neither
      // is a problem: the value is still readable, it just does not push updates.
    });

  return () => {
    listeners.delete(onChange);
    status?.removeEventListener("change", notifyPermissionChanged);
  };
}

function readPermissionState(): PushPermissionState {
  return pushPermissionState({
    hasVapidKey: Boolean(clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    supportsServiceWorker: "serviceWorker" in navigator,
    supportsPush: "PushManager" in window,
    permission: typeof Notification === "undefined" ? undefined : Notification.permission,
  });
}

/** Server render: no browser, so nothing is offered until the client says otherwise. */
function readServerState(): PushPermissionState {
  return "unsupported";
}
