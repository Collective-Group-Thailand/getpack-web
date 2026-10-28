/**
 * The outside / inside print choices of a corrugate product as the configurator's cards show them, and
 * the keys they are priced under (`option-prices.ts`, `calculateBatch`). Pure — no hooks — so the product
 * page's server sections (pdp redesign) read the same choices as the cards; `option-prices.ts` re-exports
 * everything here for its client callers.
 */

import { groupsOf, optionsById, type Configurator } from "./model";
import { choiceOf, choiceValues, idsOfChoice, isCorrugate, sideModelOf, type PrintKind } from "./print-model";
import { partsOf, printOfPart, type ConfiguratorState } from "./state";

export const printSideOf = (kind: PrintKind) => (kind === "print_front" ? "outside" : "inside");
export const printKey = (kind: PrintKind, choice: string) => `print:${printSideOf(kind)}:${choice}`;

/** The radio value of a corrugate side without a print model: ไม่พิมพ์ or `ink:<id>`. */
export const NO_MODEL_NONE = "none";
export const inkChoice = (id: string) => `ink:${id}`;

export interface Candidate {
  key: string;
  state: ConfiguratorState;
}
export interface Family {
  /** The key of the option the state holds now, if one of this family's cards is it. */
  currentKey: string | null;
  candidates: Candidate[];
}

const withChoice = (state: ConfiguratorState, kind: PrintKind, ids: string[]): ConfiguratorState => ({
  ...state,
  choices: { ...state.choices, [kind]: ids },
});

/**
 * One corrugate side as the cards show it (`PrintSideChoice`): the model's methods, else the ink list.
 * Exported for the product page's print picker (pdp redesign item 3): the same choices, the same keys,
 * so a picker and its price never disagree with the configurator's cards.
 */
export function printFamily(configurator: Configurator, state: ConfiguratorState, kind: PrintKind): Family | null {
  if (!isCorrugate(configurator)) return null;
  const group = groupsOf(configurator).find((entry) => entry.kind === kind);
  if (!group) return null;
  // A box printed otherwise per part has no single side to compare.
  const parts = partsOf(configurator, state);
  if (parts.length > 1 && parts.some((part) => state.partPrints[part.subPatternId])) return null;
  const current = printOfPart(state, undefined)[kind];
  const side = sideModelOf(configurator, kind);
  const byId = optionsById(configurator);
  if (side) {
    return {
      currentKey: printKey(kind, choiceOf(side, current)),
      candidates: choiceValues(side, (id) => byId.has(id)).map((choice) => ({
        key: printKey(kind, choice),
        state: withChoice(state, kind, idsOfChoice(side, choice, current)),
      })),
    };
  }
  return {
    currentKey: printKey(kind, current[0] ? inkChoice(current[0]) : NO_MODEL_NONE),
    candidates: [
      { key: printKey(kind, NO_MODEL_NONE), state: withChoice(state, kind, []) },
      ...group.options.map((option) => ({
        key: printKey(kind, inkChoice(option.id)),
        state: withChoice(state, kind, [option.id]),
      })),
    ],
  };
}
