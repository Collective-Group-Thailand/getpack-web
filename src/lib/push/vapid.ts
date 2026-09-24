/**
 * VAPID key handling and the rules about *when* a browser may be asked for permission.
 *
 * Pure functions, no browser APIs, so the rule that matters most — never prompt on page load —
 * is a unit test rather than something to remember.
 */

/**
 * `applicationServerKey` must be a `Uint8Array`; the key ships as base64url in an env
 * variable. `atob` wants standard base64, so the URL-safe alphabet is translated and the
 * padding put back.
 */
export function decodeVapidKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);

  // Backed by an explicit `ArrayBuffer`, not the default `ArrayBufferLike`: `subscribe()`
  // wants a `BufferSource` over a real `ArrayBuffer`, and a plain `new Uint8Array(n)` is typed
  // loosely enough to include `SharedArrayBuffer`, which it will not accept.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushPermissionState = "unsupported" | "unconfigured" | "granted" | "denied" | "askable";

export interface PushEnvironment {
  hasVapidKey: boolean;
  supportsServiceWorker: boolean;
  supportsPush: boolean;
  permission: NotificationPermission | undefined;
}

/**
 * What, if anything, this browser can be asked.
 *
 * `denied` is terminal and worth distinguishing from `askable`: once someone has refused,
 * `requestPermission()` resolves immediately with `denied` and no prompt appears, so a UI that
 * keeps offering a button is offering something that cannot work. The honest answer there is
 * to tell them to change it in site settings.
 */
export function pushPermissionState(env: PushEnvironment): PushPermissionState {
  if (!env.supportsServiceWorker || !env.supportsPush || env.permission === undefined) return "unsupported";
  if (!env.hasVapidKey) return "unconfigured";
  if (env.permission === "granted") return "granted";
  if (env.permission === "denied") return "denied";
  return "askable";
}

/**
 * Whether the app may raise the browser's permission prompt right now.
 *
 * F1 1.3 asks for the prompt "only after a meaningful action", and the reason is practical
 * rather than decorative: a prompt on page load is refused by most people, and a refusal is
 * permanent — `denied` cannot be undone by the site, only by the person, in a settings screen
 * they will never open. Asking once, after someone has placed an order or accepted a job, is
 * the only chance the feature gets.
 */
export function mayPrompt(state: PushPermissionState, afterMeaningfulAction: boolean): boolean {
  return state === "askable" && afterMeaningfulAction;
}
