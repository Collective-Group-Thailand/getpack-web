/**
 * The Thai 13-digit tax identification number: the last digit checks the first twelve
 * (Σ dᵢ × (13 − i), check = (11 − sum mod 11) mod 10). A typo is caught as it is typed; the API
 * validates it again (design-system.md §3 "TaxIdInput").
 */
export function isValidThaiTaxId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

/** `0105556000019` → `0-1055-56000-01-9`, the way it is printed on a certificate. */
export function formatTaxId(value: string): string {
  return /^\d{13}$/.test(value)
    ? `${value[0]}-${value.slice(1, 5)}-${value.slice(5, 10)}-${value.slice(10, 12)}-${value[12]}`
    : value;
}
