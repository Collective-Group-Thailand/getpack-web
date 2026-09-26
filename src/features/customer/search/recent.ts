/**
 * The last few searches, in this browser only — a per-viewer convenience, so `localStorage`,
 * wrapped because storage can be unavailable (private windows, blocked site data).
 */
const KEY = "pk_recent_searches";
const LIMIT = 5;

export function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string): string[] {
  const term = q.trim();
  if (term.length < 2) return readRecent();
  const next = [term, ...readRecent().filter((entry) => entry !== term)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembering is fine.
  }
  return next;
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
