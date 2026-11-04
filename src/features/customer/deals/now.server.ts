import "server-only";

/**
 * The moment a deal page is read, once per request: the tickets' "เหลือ n วัน" is computed from it on the server and
 * in the browser alike, so the two renders agree.
 */
export async function readNow(): Promise<number> {
  return Date.now();
}
