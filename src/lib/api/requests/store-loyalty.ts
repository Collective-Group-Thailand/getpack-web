/**
 * Points P1 (loyalty earn expansion): the earn checklist and the packaging profile.
 *
 * CONTRACT: API-CHANGES-P1 — `docs/design/loyalty-earn-expansion/API-CHANGES-P1.md` is the contract getpack-api
 * builds on `feat/loyalty-p1-activity-rewards`. Until that release is adopted (`pnpm gen:api --adopt`), the web
 * calls these three operations through their request definitions; `registry.test.ts` then names them for deletion.
 *
 * The API sends no copy and no links: titles, descriptions and routes per task code are the web's
 * (`account.points.tasks.<code>.*`, `src/features/customer/account/earn-tasks.ts`).
 */

import { z } from "zod";

import { dateTime, money, request } from "./define";

export const LOYALTY_TASK_CODES = [
  "signup",
  "line_link",
  "google_link",
  "apple_link",
  "phone_verified",
  "profile_completed",
  "tax_profile",
  "address",
  "brand_kit",
  "first_design",
  "team_invite",
  "packaging_profile",
  "line_oa_friend",
] as const;

export const loyaltyTask = z
  .object({
    code: z.enum(LOYALTY_TASK_CODES).meta({ id: "LoyaltyTaskCode" }),
    /** Integer points the task earns, from `loyalty.activity_rewards` at `loyalty.point_value`. */
    points: z.number().int().min(1),
    status: z.enum(["todo", "held", "done"]).meta({ id: "LoyaltyTaskStatus" }),
    doneAt: dateTime().nullable(),
    /** Only on `held` (DEC-5). The customer is never told why; the UI shows "รอตรวจสอบ". */
    heldReason: z.enum(["duplicate_identity"]).nullable(),
    /** Exactly one todo task, or none. */
    recommended: z.boolean(),
  })
  .meta({ id: "LoyaltyTaskDto" });

export const loyaltyTasks = z
  .object({
    /** Sorted for display: todo and held by points desc, then done by `doneAt` desc. */
    tasks: z.array(loyaltyTask),
    earnedPoints: z.number().int().min(0),
    /** Sum of todo points, capped by `capRemainingPoints`. */
    remainingPoints: z.number().int().min(0),
    capPoints: z.number().int().min(0),
    capRemainingPoints: z.number().int().min(0),
    pointValue: money(),
  })
  .meta({ id: "LoyaltyTasksDto" });

export const MONTHLY_BOX_VOLUMES = ["lt_500", "500_2000", "2000_10000", "gt_10000"] as const;
export const PRODUCT_CATEGORIES = [
  "food",
  "beverage",
  "cosmetics",
  "apparel",
  "electronics",
  "ecommerce",
  "industrial",
  "other",
] as const;
export const SHIP_TO_REGIONS = ["bangkok_metro", "central", "north", "northeast", "east", "west", "south"] as const;

const month = z.number().int().min(1).max(12);

export const packagingProfileInput = z
  .object({
    monthlyBoxVolume: z.enum(MONTHLY_BOX_VOLUMES).meta({ id: "MonthlyBoxVolume" }),
    productCategories: z
      .array(z.enum(PRODUCT_CATEGORIES).meta({ id: "PackagingProductCategory" }))
      .min(1)
      .max(8),
    shipToRegions: z
      .array(z.enum(SHIP_TO_REGIONS).meta({ id: "ShipToRegion" }))
      .min(1)
      .max(7),
    peakMonths: z.array(month).max(12),
    /** The PDPA purpose shown on the form was acknowledged. */
    purposeAccepted: z.literal(true),
  })
  .meta({ id: "PutPackagingProfileDto" });

export const packagingProfile = z
  .object({
    monthlyBoxVolume: z.enum(MONTHLY_BOX_VOLUMES).nullable(),
    productCategories: z.array(z.enum(PRODUCT_CATEGORIES)).nullable(),
    shipToRegions: z.array(z.enum(SHIP_TO_REGIONS)).nullable(),
    peakMonths: z.array(month).nullable(),
    purposeAccepted: z.boolean().nullable(),
    /** Set by the first complete save, which earns `earn_packaging_profile` once. */
    completedAt: dateTime().nullable(),
    updatedAt: dateTime().nullable(),
  })
  .meta({ id: "PackagingProfileDto" });

export const storeLoyaltyRequests = {
  "GET /v1/store/loyalty/tasks": request({
    request: "store.loyalty.tasks",
    summary: "The earn checklist: one-off activity rewards, their status, and the 12-month activity cap",
    decisions: ["D-130", "D-136"],
    response: loyaltyTasks,
  }),
  "GET /v1/store/loyalty/packaging-profile": request({
    request: "store.loyalty.packaging-profile",
    summary: "My packaging profile (null fields until first saved; never 404)",
    response: packagingProfile,
  }),
  "PUT /v1/store/loyalty/packaging-profile": request({
    request: "store.loyalty.packaging-profile",
    summary: "Save my packaging profile; the first complete save earns earn_packaging_profile once",
    body: packagingProfileInput,
    response: packagingProfile,
  }),
} as const;

export type LoyaltyTasks = z.infer<typeof loyaltyTasks>;
export type LoyaltyTask = z.infer<typeof loyaltyTask>;
export type LoyaltyTaskCode = LoyaltyTask["code"];
export type PackagingProfile = z.infer<typeof packagingProfile>;
export type PackagingProfileInput = z.infer<typeof packagingProfileInput>;
