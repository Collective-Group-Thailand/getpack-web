/** Thai phone numbers between what an agent types (0812345678, 081-234-5678) and what the API takes (E.164). */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^0-9+]/g, "");
  if (/^\+66\d{8,9}$/.test(digits)) return digits;
  const local = digits.replace(/^\+/, "");
  if (/^0\d{8,9}$/.test(local)) return `+66${local.slice(1)}`;
  if (/^66\d{8,9}$/.test(local)) return `+${local}`;
  return null;
}

/** `+66812345678` → `0812345678`, for a field the agent edits and for `tel:` on a Thai phone. */
export function toLocalPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  return e164.startsWith("+66") ? `0${e164.slice(3)}` : e164;
}

/** `0812345678` → `081-234-5678` for reading (mobile 10 digits; a 9-digit landline as 02-123-4567). */
export function displayPhone(e164: string | null | undefined): string {
  const local = toLocalPhone(e164);
  if (/^0\d{9}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (/^0\d{8}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  return local;
}

/** A money amount the agent typed ("86,000" / "86000.5") as the API's decimal string, or null when it is not one. */
export function toMoneyInput(input: string): string | null {
  const clean = input.replace(/[,\s฿]/g, "");
  if (!clean) return null;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(clean)) return null;
  return clean;
}
