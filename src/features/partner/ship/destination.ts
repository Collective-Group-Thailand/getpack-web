/**
 * Reverse confidentiality for getpack jobs (P4-01, decision P4-D1): a factory sees where a carton goes only as the
 * destination's code within its job (D1, D2 …), the province and the postcode's first three digits — never the
 * getpack customer's name, phone or address lines. Everything a partner page shows of a destination goes through
 * here.
 *
 * CONTRACT-GAP partner jobs/shipments — the API still sends `recipientName`, `phone`, `line1`, `line2` and the full
 * `postcode`; the web drops them. The API should send a `code` and `postcodePrefix` instead.
 */
export const destinationCode = (index: number) => `D${index + 1}`;

/** `10110` → `101xx`: enough to price the freight, not to find the door. */
export const postcodePrefix = (postcode: string | null | undefined) => (postcode ? `${postcode.slice(0, 3)}xx` : "");

/** "กรุงเทพมหานคร · 101xx". */
export const destinationPlace = (province: string | null | undefined, postcode: string | null | undefined) =>
  [province, postcodePrefix(postcode)].filter(Boolean).join(" · ");
