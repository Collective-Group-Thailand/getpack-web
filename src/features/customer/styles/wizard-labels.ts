import type { WizardAnswers, WizardItem, WizardPlace } from "./query";

/** The `styles` message key of a wizard answer (C0): items reuse the use-case labels where one fits. */
export const wizardItemKey = (item: WizardItem) =>
  item === "*" ? "library.wizardItemAny" : item === "snack" ? "library.wizardItemSnack" : `useCases.${item}`;

const PLACE_KEY: Record<WizardPlace, string> = {
  ship: "library.wizardPlaceShip",
  shelf: "library.wizardPlaceShelf",
  gift: "library.wizardPlaceGift",
  serve: "library.wizardPlaceServe",
};
export const wizardPlaceKey = (place: WizardPlace) => PLACE_KEY[place];

/** "อาหาร · ส่งพัสดุ / ขายออนไลน์" — the chip's words, in the order asked. */
export function wizardSummary(answers: WizardAnswers, t: (key: string) => string): string {
  return [...answers.items.map((i) => t(wizardItemKey(i))), ...answers.place.map((p) => t(wizardPlaceKey(p)))].join(
    " · ",
  );
}
