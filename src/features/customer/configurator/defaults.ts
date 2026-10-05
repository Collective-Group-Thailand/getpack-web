import { groupsOf } from "./model";
import { initialState, type Configurator, type ConfiguratorState } from "./state";

/**
 * The material of the customer's latest quotation of this product type (U5.1 §1, D-298), when this
 * configurator offers it — the start of a new configuration and nothing else: a draft, a quote or
 * a material asked for in the URL always wins.
 */
export function seedFromDefaults(
  configurator: Configurator,
  defaults: { productTypeCode: string; materialId: string | null }[],
): Partial<ConfiguratorState> | undefined {
  const last = defaults.find((row) => row.productTypeCode === configurator.productTypeCode)?.materialId;
  const offered = groupsOf(configurator)
    .find((group) => group.kind === "material")
    ?.options.some((option) => option.id === last);
  if (!last || !offered) return undefined;
  return { choices: { ...initialState(configurator).choices, material: [last] } };
}
