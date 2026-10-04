"use client";

import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";

import { sizeKindOf } from "./model";
import { useDebounced } from "./pricing";
import { patternOf, type ConfiguratorState, type Configurator, type InternalSize } from "./state";

export type Converted = Schemas["ConvertedDimensionsDto"];

/** How long the customer must pause before the sizes are converted again. */
const CONVERT_DEBOUNCE_MS = 300;

/**
 * A box's size on every basis (D-182), from the API's one conversion service
 * (`store.specs.convertDimensions`): the entered size, its basis, the pattern's construction and
 * the material's caliper → inside, outside and over-crease sizes. Nothing is converted here.
 *
 * Only boxes have more than one basis; a flat item, a tag or a pouch is its own size. Without a
 * material the API may not know the caliper (`specs.caliper_missing`): then only an inside size
 * can be checked, and the step says so.
 */
export function useConversion(configurator: Configurator, state: ConfiguratorState) {
  const box = sizeKindOf(configurator) === "box";
  const { l, w, d } = state.dims;
  const pattern = patternOf(configurator, state);
  const materialId = state.choices.material?.[0];
  const body =
    box && state.basis && l && w && d
      ? {
          productTypeCode: configurator.productTypeCode,
          basis: state.basis,
          l,
          w,
          d,
          ...(pattern ? { patternId: pattern.id } : {}),
          ...(materialId ? { materialId } : {}),
        }
      : null;
  const key = body ? JSON.stringify(body) : null;
  const settled = useDebounced(key, CONVERT_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: [...queryKeys.zone("customer"), "convert-dimensions", settled],
    queryFn: async ({ signal }) =>
      (
        await browserApi().POST("/v1/store/specs/actions/convert-dimensions", {
          body: JSON.parse(settled!) as Schemas["ConvertDimensionsDto"],
          signal,
        })
      ).data!,
    enabled: settled !== null,
    staleTime: Infinity,
    retry: false,
  });
  const current = settled === key ? query.data : undefined;
  const internal: InternalSize = current?.sizes.internal ?? null;
  return {
    converted: current ?? null,
    internal,
    pending: key !== null && (key !== settled || query.isFetching),
    /** `specs.caliper_missing` and the like — the API's reason it could not convert. */
    problem: query.isError && settled === key ? (isApiError(query.error) ? query.error.code : "unknown") : null,
  };
}

/**
 * The bases a box pattern is measured on, as the API's conversion knows its construction (D-182):
 * a closed box, tray or sleeve on inside, outside and over the creases; a style the API builds
 * flat (an insert, a flat card) on its finished size only. Asked once per pattern with a probe
 * size — the family does not depend on it — and `null` until the answer is in, or for a product
 * that is not a box.
 */
export function usePatternBases(configurator: Configurator, patternId: string | null) {
  const box = sizeKindOf(configurator) === "box";
  const query = useQuery({
    queryKey: [...queryKeys.zone("customer"), "pattern-bases", configurator.productTypeCode, patternId],
    queryFn: async ({ signal }): Promise<Schemas["MeasurementBasis"][]> => {
      try {
        const { data } = await browserApi().POST("/v1/store/specs/actions/convert-dimensions", {
          body: {
            productTypeCode: configurator.productTypeCode,
            basis: "internal",
            l: 100,
            w: 100,
            d: 100,
            ...(patternId ? { patternId } : {}),
          },
          signal,
        });
        return data!.bases;
      } catch (error) {
        // Not measured on the inside: a style built flat, measured on its finished size.
        if (isApiError(error) && error.code === "specs.basis_not_accepted") return ["product"];
        throw error;
      }
    },
    enabled: box,
    staleTime: Infinity,
    retry: false,
  });
  return box ? (query.data ?? null) : null;
}
