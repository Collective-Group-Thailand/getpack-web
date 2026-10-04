/**
 * Orders two money amounts the API sent as decimal strings ("12.50", "9.8") without turning them
 * into numbers — a comparison, not arithmetic (CLAUDE.md: money is never computed in the UI).
 * Negative or malformed amounts compare as equal.
 */
export function compareDecimal(a: string, b: string): number {
  const parse = (s: string) => /^(\d+)(?:\.(\d+))?$/.exec(s.trim());
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 0;
  const [xi, yi] = [x[1]!.replace(/^0+(?=\d)/, ""), y[1]!.replace(/^0+(?=\d)/, "")];
  if (xi.length !== yi.length) return xi.length < yi.length ? -1 : 1;
  if (xi !== yi) return xi < yi ? -1 : 1;
  const width = Math.max(x[2]?.length ?? 0, y[2]?.length ?? 0);
  const [xf, yf] = [(x[2] ?? "").padEnd(width, "0"), (y[2] ?? "").padEnd(width, "0")];
  return xf === yf ? 0 : xf < yf ? -1 : 1;
}
