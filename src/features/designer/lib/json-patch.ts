/**
 * RFC 6902 operations that turn one JSON document into another — the studio's autosave sends
 * only what changed (`store.designs.patchDocument`, D-276) instead of the whole document.
 *
 * Objects are compared key by key; an array of the same length index by index; an array whose
 * length changed is replaced whole (an element added or removed shifts every index after it, and
 * one `replace` is smaller than a run of shifted ones). Pure, for tests.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PatchOperation =
  | { op: "add"; path: string; value: JsonValue }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: JsonValue };

/** A JSON Pointer segment (RFC 6901): `~` → `~0`, `/` → `~1`. */
const segment = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

const isObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function diff(before: JsonValue, after: JsonValue, path = ""): PatchOperation[] {
  if (before === after) return [];
  if (isObject(before) && isObject(after)) {
    const ops: PatchOperation[] = [];
    for (const key of Object.keys(before)) {
      if (!(key in after) || after[key] === undefined) ops.push({ op: "remove", path: `${path}/${segment(key)}` });
    }
    for (const [key, value] of Object.entries(after)) {
      if (value === undefined) continue;
      const at = `${path}/${segment(key)}`;
      if (!(key in before) || before[key] === undefined) ops.push({ op: "add", path: at, value });
      else ops.push(...diff(before[key]!, value, at));
    }
    return ops;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    return before.flatMap((item, index) => diff(item, after[index]!, `${path}/${index}`));
  }
  return [{ op: "replace", path, value: after }];
}

/** The operations' size as the API measures it (`JSON.stringify` bytes, D-276: ≤ 256 KiB). */
export function patchBytes(ops: PatchOperation[]): number {
  return new TextEncoder().encode(JSON.stringify(ops)).length;
}

/** The API's patch limit (D-276, technical). */
export const MAX_PATCH_BYTES = 256 * 1024;

/** Applies operations made by `diff` (tests prove a round trip; the server applies the real ones). */
export function apply(document: JsonValue, ops: PatchOperation[]): JsonValue {
  let root = structuredClone(document);
  for (const operation of ops) {
    const keys = operation.path
      .split("/")
      .slice(1)
      .map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (keys.length === 0) {
      if (operation.op === "remove") throw new Error("cannot remove the root");
      root = structuredClone(operation.value);
      continue;
    }
    let parent: JsonValue = root;
    for (const key of keys.slice(0, -1)) parent = (parent as Record<string, JsonValue>)[key]!;
    const last = keys[keys.length - 1]!;
    if (Array.isArray(parent)) {
      const index = last === "-" ? parent.length : Number(last);
      if (operation.op === "remove") parent.splice(index, 1);
      else if (operation.op === "add") parent.splice(index, 0, operation.value);
      else parent[index] = operation.value;
    } else {
      const object = parent as Record<string, JsonValue>;
      if (operation.op === "remove") delete object[last];
      else object[last] = operation.value;
    }
  }
  return root;
}

/** JSON with object keys sorted and `undefined` members left out, so equal values compare equal. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)),
        )
      : v,
  );
}

export const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
