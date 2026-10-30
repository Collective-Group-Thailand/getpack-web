/**
 * Reverse confidentiality for getpack jobs (P4-01, decision P4-D1): a factory sees where a carton goes only as the
 * destination's code within its job (D1, D2 …), the province and the postcode's first three digits — never the
 * getpack customer's name, phone or address lines. Everything a partner page shows of a destination goes through
 * here.
 *
 * The API now sends `code` and `postcodePrefix` (and a shipment item's `destinationCode`) instead of the recipient;
 * the generated types still describe the old shape until the next tagged API release, so the new fields are read
 * through the narrow runtime accessors below, and the old computation is only a fallback for an older API.
 */
type Shape = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** The code by position — the fallback when the API does not send one. */
export const destinationCode = (index: number) => `D${index + 1}`;

/** A destination's own code (`D1` …), else its place in the job's list. */
export const codeOf = (destination: object, index?: number) =>
  text((destination as Shape).code) ?? (index === undefined ? null : destinationCode(index));

/** A shipment's destination code: the destination's own, else its items' `destinationCode`. */
export const shipmentCodeOf = (shipment: { destination: object; items: readonly object[] }) =>
  codeOf(shipment.destination) ??
  shipment.items.map((item) => text((item as Shape).destinationCode)).find(Boolean) ??
  null;

/** `10110` or `101` → `101xx`: enough to price the freight, not to find the door. */
export const postcodePrefix = (postcode: string | null | undefined) =>
  postcode ? `${postcode.trim().slice(0, 3)}xx` : "";

/** The prefix the API sends (`postcodePrefix`), else one cut from an older API's full `postcode`. */
export const prefixOf = (destination: object) => {
  const shape = destination as Shape;
  return postcodePrefix(text(shape.postcodePrefix) ?? text(shape.postcode));
};

/** "กรุงเทพมหานคร · 101xx". */
export const destinationPlace = (province: string | null | undefined, postcode: string | null | undefined) =>
  [province, postcodePrefix(postcode)].filter(Boolean).join(" · ");

/** "กรุงเทพมหานคร · 101xx" from a destination as the API sends it, old shape or new. */
export const placeOf = (province: string | null | undefined, destination: object) =>
  [province, prefixOf(destination)].filter(Boolean).join(" · ");
