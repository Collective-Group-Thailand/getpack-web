/**
 * What a visitor typed into /contact's tracking box (business pack Phase 2 item 1). An order code is `PK-` plus the
 * Buddhist year and a number (PK-2569-00100, sometimes with a group suffix); a request number is the API's support
 * ticket number (`CS-YYMM-NNNNN`, D-440 — no `CT-`). Case and spaces are forgiven.
 */
export function classifyReference(raw: string): { type: "order" | "ticket"; code: string } | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^PK-\d{4}-\d{3,}(-\d{1,3})?$/.test(code)) return { type: "order", code };
  if (/^[A-Z]{2,8}-\d{4}-\d{3,8}$/.test(code) && !code.startsWith("PK-")) return { type: "ticket", code };
  return null;
}

/** A guest's proof for a request: a mobile number (digits) or an e-mail; null when it is neither. */
export function verifierOf(raw: string): { phone: string } | { email: string } | null {
  const text = raw.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return { email: text };
  const digits = text.replace(/[\s-]/g, "");
  if (/^(\+66|0)\d{8,9}$/.test(digits)) return { phone: digits.startsWith("+66") ? `0${digits.slice(3)}` : digits };
  return null;
}
