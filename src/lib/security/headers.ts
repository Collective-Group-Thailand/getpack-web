import { ZONE_CONFIG, type Zone } from "@/lib/zones";

export interface SecurityHeaderOptions {
  /** HSTS is only meaningful, and only safe, over TLS — never on `http://*.localhost`. */
  isHttps: boolean;
}

/**
 * The response headers every zone gets, and the three that differ (F1 1.1).
 *
 * `X-Robots-Tag` and `Permissions-Policy` are the per-zone ones: only the storefront is
 * indexed (00-master-plan.md §2), and only the partner PWA may open the camera — that is
 * the QC and delivery-proof scanner in F5, and there is no reason for a storefront or a
 * back-office tab to be able to ask for it.
 */
export function securityHeaders(zone: Zone, { isHttps }: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": permissionsPolicy(zone),
  };

  if (!ZONE_CONFIG[zone].indexable) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }

  if (isHttps) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

function permissionsPolicy(zone: Zone): string {
  const camera = zone === "partner" ? "(self)" : "()";
  return [`camera=${camera}`, "microphone=()", "geolocation=()", "payment=()", "usb=()", "interest-cohort=()"].join(
    ", ",
  );
}

/** Whether the request reached us over TLS, honouring the proxy in front of the app. */
export function isHttpsRequest(headers: Headers, protocol: string): boolean {
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return protocol === "https:";
}
