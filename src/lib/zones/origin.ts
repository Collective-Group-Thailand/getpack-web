/**
 * The origin a zone is reached at, for a link from one zone to another (D-467: the storefront ↔ getpack Agent).
 *
 * Hosts are host-only values (`agent.getpack.co`, `agent.localhost:3000`); the scheme is the one the current request
 * arrived over — `x-forwarded-proto` behind the load balancer — and plain http only for `localhost` names, so a
 * production link is never downgraded.
 */
export function zoneOriginFor(host: string, forwardedProto: string | null | undefined): string {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  const local = /^([a-z0-9-]+\.)*localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host);
  const scheme = proto === "https" || proto === "http" ? (local ? proto : "https") : local ? "http" : "https";
  return `${scheme}://${host}`;
}
