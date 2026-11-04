/**
 * Points P1: the earn checklist (`store.loyalty.tasks`) and the packaging profile
 * (`store.loyalty.getPackagingProfile` / `updatePackagingProfile`), from the generated contract.
 *
 * The API sends no copy and no links: titles, descriptions and routes per task code are the web's
 * (`account.points.tasks.<code>.*`, `./earn-tasks.ts`).
 */

import type { Schemas } from "@/lib/api/types";

/** Loyalty P2's codes (`data_refresh`, `showcase_consent`, `first_sample`) are in the contract's enum. */
export type LoyaltyTaskCode = Schemas["LoyaltyTaskCode"];
/** `nextDueAt` is set only for a done `data_refresh`: when the next confirmation is due. */
export type LoyaltyTask = Schemas["EarnTaskDto"];
export type LoyaltyTasks = Schemas["EarnTasksDto"];
export type PackagingProfile = Schemas["PackagingProfileDto"];
export type PackagingProfileInput = Schemas["PutPackagingProfileDto"];

/** The form's choices, in the order it lists them (the contract's enums). */
export const MONTHLY_BOX_VOLUMES = [
  "lt_500",
  "500_2000",
  "2000_10000",
  "gt_10000",
] as const satisfies readonly Schemas["PackagingMonthlyBoxVolume"][];
export const PRODUCT_CATEGORIES = [
  "food",
  "beverage",
  "cosmetics",
  "apparel",
  "electronics",
  "ecommerce",
  "industrial",
  "other",
] as const satisfies readonly Schemas["PackagingProductCategory"][];
export const SHIP_TO_REGIONS = [
  "bangkok_metro",
  "central",
  "north",
  "northeast",
  "east",
  "west",
  "south",
] as const satisfies readonly Schemas["PackagingShipToRegion"][];
