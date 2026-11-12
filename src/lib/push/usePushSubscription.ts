"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { clientEnv } from "@/lib/env";
import type { Zone } from "@/lib/zones";

import { decodeVapidKey, mayPrompt, pushPermissionState, type PushPermissionState } from "./vapid";

/**
 * Where the browser is served; a root file so its scope is the whole origin. getpack Agent has its own worker
 * (offline shell + push, D-467); every other zone's is push only.
 */
export function serviceWorkerPath(zone: Zone): string {
  return zone === "agent" ? "/agent-sw.js" : "/sw.js";
}

/** The agent zone's subscription id on this device, so it can be removed again (`store.agentPush.unsubscribe`). */
const AGENT_SUBSCRIPTION_KEY = "getpack.agent.push.subscription";

/**
 * Web push for the customer, partner and agent zones (D-143, D-467).
 *
 * The shape of this hook is the policy: it returns `enable`, and `enable` is only ever called
 * from a handler on something a person deliberately did. There is no effect that prompts, and
 * `state` tells a caller whether asking is even possible — so "prompt only after a meaningful
 * action" is enforced by there being no other way to do it, rather than by a comment.
 *
 * On the contract getpack-api B1.3 published: `GET /v1/{surface}/web-push/vapid-public-key` and
 * `POST /v1/{surface}/web-push/subscriptions`.
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
      // The env key is the switch that says web push is configured for this deployment at
      // all; the key actually subscribed with is the API's, because it is the API that signs
      // every push. Two keys that drift apart fail silently — the browser accepts the
      // subscription and every message is then rejected by the push service.
      if (!clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !mayPrompt(state, afterMeaningfulAction)) return false;

      setBusy(true);
      try {
        const key = await serverVapidKey(zone);
        if (!key) return false;

        const registration = await navigator.serviceWorker.register(serviceWorkerPath(zone));
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

        // Through the BFF, so the session cookie authenticates it and no token reaches the
        // browser. `toJSON()` is the push protocol's own `{ endpoint, keys }` shape; only the
        // fields `SubscribeWebPushDto` names are sent.
        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
        await registerSubscription(zone, {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent,
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

  /**
   * Stops push on this device: unsubscribes in the browser and, in the agent zone, removes the subscription the
   * API holds. Best-effort like `enable` — a failure leaves the screen as it was.
   */
  const disable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration(serviceWorkerPath(zone));
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      if (zone === "agent") {
        const id = readStoredSubscription();
        if (id) {
          await browserApi().DELETE("/v1/store/agent/push/subscriptions/{subscriptionId}", {
            params: { path: { subscriptionId: id } },
          });
          storeSubscription(null);
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [zone]);

  return { state, busy, enable, disable };
}

function readStoredSubscription(): string | null {
  try {
    return window.localStorage.getItem(AGENT_SUBSCRIPTION_KEY);
  } catch {
    return null;
  }
}

function storeSubscription(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(AGENT_SUBSCRIPTION_KEY, id);
    else window.localStorage.removeItem(AGENT_SUBSCRIPTION_KEY);
  } catch {
    // Private mode: the subscription still works; it just cannot be removed from this device's settings later.
  }
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

/* ---------------------------------------------------------------------------------------- *
 * The API calls, one per surface: openapi-fetch types a request by its literal path.
 * ---------------------------------------------------------------------------------------- */

async function serverVapidKey(zone: Zone): Promise<string | null> {
  const api = browserApi();
  const response =
    zone === "admin"
      ? await api.GET("/v1/admin/web-push/vapid-public-key")
      : zone === "partner"
        ? await api.GET("/v1/partner/web-push/vapid-public-key")
        : zone === "agent"
          ? await api.GET("/v1/store/agent/push/vapid-public-key")
          : await api.GET("/v1/store/web-push/vapid-public-key");
  return response.data?.vapidPublicKey ?? null;
}

async function registerSubscription(zone: Zone, body: Schemas["SubscribeWebPushDto"]): Promise<void> {
  const api = browserApi();
  if (zone === "admin") await api.POST("/v1/admin/web-push/subscriptions", { body });
  else if (zone === "partner") await api.POST("/v1/partner/web-push/subscriptions", { body });
  else if (zone === "agent") {
    // Agent events push to agent-zone subscriptions only (D-467); the id is kept to remove it again.
    const { data } = await api.POST("/v1/store/agent/push/subscriptions", { body });
    if (data) storeSubscription(data.id);
  } else await api.POST("/v1/store/web-push/subscriptions", { body });
}
