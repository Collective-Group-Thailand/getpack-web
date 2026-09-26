/**
 * The route **pattern** of the current page — `/track/[token]`, never `/track/9f2c…`.
 *
 * `useSelectedLayoutSegments()` returns the segments' *values* (Next's `getSegmentValue` takes
 * the value out of a dynamic segment), so on its own it would put an order code or a tracking
 * token into analytics and RUM (PDPA, D-144). Each segment that equals a route parameter's
 * value is put back as the parameter's name; route groups are dropped.
 */
export function routePattern(
  segments: readonly string[],
  params: Record<string, string | string[] | undefined> | null,
): string {
  const names = new Map<string, string>();
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === "string") names.set(value, `[${name}]`);
    else if (Array.isArray(value)) for (const part of value) names.set(part, `[...${name}]`);
  }
  const pattern: string[] = [];
  for (const segment of segments) {
    if (segment.startsWith("(")) continue;
    const decoded = safeDecode(segment);
    const name = names.get(segment) ?? names.get(decoded);
    // A catch-all's parts collapse into one `[...name]`.
    if (name && name.startsWith("[...") && pattern.at(-1) === name) continue;
    pattern.push(name ?? segment);
  }
  return `/${pattern.join("/")}`;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
