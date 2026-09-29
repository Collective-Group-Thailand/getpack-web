/** Every `code` the BFF answers with itself (`./problem.ts`); each has th/en copy in `problems`. */
export const BFF_PROBLEM_CODES = [
  "bff.body_too_large",
  "bff.csrf_header_missing",
  "bff.origin_invalid",
  "bff.origin_mismatch",
  "bff.origin_missing",
  "bff.unknown_path",
  "bff.upstream_unreachable",
] as const;

export type BffProblemCode = (typeof BFF_PROBLEM_CODES)[number];
