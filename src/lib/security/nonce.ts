import { headers } from "next/headers";

import { NONCE_HEADER } from "./index";

/**
 * The CSP nonce `src/proxy.ts` minted for this request, for any inline `<script>` or
 * `<style>` this app adds itself (GTM in 1.3, for instance). Next stamps its own bootstrap
 * scripts from the `Content-Security-Policy` request header without being asked.
 *
 * `undefined` means the request did not come through the proxy — a static asset, or a test
 * rendering a layout directly. Callers must skip the inline script rather than emit it
 * unnonced, which the CSP would block anyway.
 */
export async function getNonce(): Promise<string | undefined> {
  return (await headers()).get(NONCE_HEADER) ?? undefined;
}
