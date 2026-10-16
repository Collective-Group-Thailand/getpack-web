/**
 * Who a partner request is from, and the rules every partner handler applies before answering:
 *
 * - no token → 401; a staff or customer token → 403 `auth.wrong_audience` (api-conventions §2);
 * - **another factory's id → 404**, never 403: a factory is not told that another factory exists
 *   (D-044, the IDOR rule B4's e2e names);
 * - a permission the factory role lacks → 403 (getpack-api `docs/rbac.md`, factory scope).
 *
 * And the idempotency replay the real API promises (api-conventions §3): the same
 * `Idempotency-Key` within the process returns the first answer instead of acting twice.
 */

import { HttpResponse } from "msw";

import { partnerPersonaOf } from "../auth";
import { stores, type Store } from "../admin/partners";
import { principalOf, problem } from "../support";
import { canPartner, type PartnerPersona } from "./personas";

export const forbidden = () => problem(403, "auth.forbidden", "บทบาทของคุณในโรงงานทำรายการนี้ไม่ได้");
export const notFound = () => problem(404, "partners.factory_not_found", "ไม่พบโรงงานนี้");

export interface Own {
  who: PartnerPersona;
  store: Store;
}

/** The signed-in factory user acting on their own factory, or the problem that stops them. */
export function own(request: Request, factoryId: unknown, permission?: string): Response | Own {
  const principal = principalOf(request);
  if (!principal) return problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");
  if (principal.audience !== "partner") return problem(403, "auth.wrong_audience", "โทเคนนี้ใช้กับส่วนนี้ไม่ได้");
  const who = partnerPersonaOf(request);
  const store = stores.get(String(factoryId));
  if (!who || !store || who.factoryId !== String(factoryId)) return notFound();
  if (permission && !canPartner(who, permission)) return forbidden();
  return { who, store };
}

/**
 * The signed-in factory user on a **token-scoped** path (`/v1/partner/billing-statements`,
 * `/v1/partner/claims`, D-044): the factory is the token's; an optional `?factoryId` that is not one
 * of the token's scopes answers 404, like any other factory's id.
 */
export function ownScope(request: Request, permission?: string): Response | Own {
  const asked = new URL(request.url).searchParams.get("factoryId");
  return own(request, asked ?? partnerPersonaOf(request)?.factoryId, permission);
}

/** The factory edits its own data only while it is `applied` or `under_review` (B2.2). */
export function locked(store: Store): Response | null {
  return ["applied", "under_review"].includes(store.factory.status)
    ? null
    : problem(
        409,
        "partners.profile_locked",
        "ข้อมูลบริษัทแก้ไขได้ระหว่างสมัครเท่านั้น หากต้องแก้ กรุณาแจ้งทีมพาร์ตเนอร์",
      );
}

const replays = new Map<string, { status: number; body: unknown }>();

/**
 * Runs an irreversible action once per `Idempotency-Key`. A replay answers with the first
 * response; a missing key is the 400 the API returns.
 */
export async function once(
  request: Request,
  scope: string,
  act: () => Response | Promise<Response>,
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (!key) return problem(400, "idempotency.key_required", "ต้องส่ง Idempotency-Key สำหรับคำสั่งนี้");
  const seen = replays.get(`${scope}:${key}`);
  if (seen) return HttpResponse.json(seen.body as never, { status: seen.status });
  const response = await act();
  if (response.ok) replays.set(`${scope}:${key}`, { status: response.status, body: await response.clone().json() });
  return response;
}

/** A timestamp in the Bangkok offset, a second after `previous` at least — so an ETag always moves. */
export function later(previous: string): string {
  const next = Math.max(Date.now(), Date.parse(previous) + 1000);
  return `${new Date(next + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;
}
