/**
 * A stable idempotency key for an operation named by `name` (api-conventions §3 wants a uuid): a
 * name-based UUID (v5 layout over SHA-1), so a retry of the same operation sends the same key.
 */
export async function stableIdempotencyKey(name: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`packio:${name}`)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
