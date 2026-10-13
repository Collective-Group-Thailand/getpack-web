import type { Schemas } from "@/lib/api/types";

/**
 * Every unit the factory's ERP knows (`ErpUnit`, D-320, D-384), in the order a picker lists them: weights, paper and
 * lengths, then counts and packaging, liquids, and service units. One list, so a new unit reaches every form.
 */
export const ERP_UNIT_VALUES = [
  "kg",
  "g",
  "ton",
  "sheet",
  "ream",
  "roll",
  "m",
  "m2",
  "pcs",
  "box",
  "pack",
  "set",
  "pouch",
  "tube",
  "l",
  "ml",
  "job",
  "round",
  "trip",
] as const satisfies readonly Schemas["ErpUnit"][];

/** A compile-time check that the list covers the contract's units (fails `tsc` when the API adds one). */
type Missing = Exclude<Schemas["ErpUnit"], (typeof ERP_UNIT_VALUES)[number]>;
export const ERP_UNITS_COMPLETE: Missing extends never ? true : Missing = true;
