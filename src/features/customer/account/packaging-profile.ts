import {
  MONTHLY_BOX_VOLUMES,
  PRODUCT_CATEGORIES,
  SHIP_TO_REGIONS,
  type PackagingProfile,
  type PackagingProfileInput,
} from "@/lib/api/requests/store-loyalty";

export { MONTHLY_BOX_VOLUMES, PRODUCT_CATEGORIES, SHIP_TO_REGIONS };

export type Volume = (typeof MONTHLY_BOX_VOLUMES)[number];
export type Category = (typeof PRODUCT_CATEGORIES)[number];
export type Region = (typeof SHIP_TO_REGIONS)[number];

export interface PackagingDraft {
  monthlyBoxVolume: Volume | null;
  productCategories: Category[];
  shipToRegions: Region[];
  peakMonths: number[];
  purposeAccepted: boolean;
}

export type DraftErrors = Partial<
  Record<"monthlyBoxVolume" | "productCategories" | "shipToRegions" | "purposeAccepted", string>
>;

/** The form's starting point: what was saved, or nothing chosen. The acknowledgement is asked again on every save. */
export function draftFrom(profile: PackagingProfile | null | undefined): PackagingDraft {
  return {
    monthlyBoxVolume: profile?.monthlyBoxVolume ?? null,
    productCategories: [...(profile?.productCategories ?? [])],
    shipToRegions: [...(profile?.shipToRegions ?? [])],
    peakMonths: [...(profile?.peakMonths ?? [])].sort((a, b) => a - b),
    purposeAccepted: profile?.purposeAccepted === true,
  };
}

/**
 * The contract's rules (API-CHANGES-P1), checked before sending so the errors sit by their fields:
 * one volume, at least one product type and one region, and the PDPA purpose acknowledged. Months are optional.
 * Returns the message key per field — the form turns them into copy.
 */
export function validateDraft(draft: PackagingDraft): Partial<Record<keyof DraftErrors, string>> {
  const errors: Partial<Record<keyof DraftErrors, string>> = {};
  if (!draft.monthlyBoxVolume) errors.monthlyBoxVolume = "volumeRequired";
  if (draft.productCategories.length === 0) errors.productCategories = "categoriesRequired";
  if (draft.shipToRegions.length === 0) errors.shipToRegions = "regionsRequired";
  if (!draft.purposeAccepted) errors.purposeAccepted = "purposeRequired";
  return errors;
}

/** The PUT body, once `validateDraft` found nothing. */
export function toInput(draft: PackagingDraft): PackagingProfileInput {
  if (!draft.monthlyBoxVolume || !draft.purposeAccepted) throw new Error("toInput needs a valid draft");
  return {
    monthlyBoxVolume: draft.monthlyBoxVolume,
    productCategories: draft.productCategories,
    shipToRegions: draft.shipToRegions,
    peakMonths: [...draft.peakMonths].sort((a, b) => a - b),
    purposeAccepted: true,
  };
}
