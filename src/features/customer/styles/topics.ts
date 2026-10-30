/**
 * Option topics (D-410): the features customers search a box by — "กล่องฝาเสียบมีหน้าต่าง",
 * "กล่องลูกฟูกมีหูจับ" — each a set of the API's option values. A topic is a card's chip, the
 * option page of a style that offers it (`/styles/<style>/<topic>`) and a filter of the variants
 * grid. Values that differ only in a detail (a round or a euro hang hole, a front or a top window)
 * share one topic: one page, the details shown as its variant cards, never pages of their own.
 */
export interface Topic {
  /** The URL segment, the same in every language. */
  id: string;
  /** The API option values (`axis` → values) that make a variant part of the topic. */
  options: Readonly<Record<string, readonly string[]>>;
}

export const TOPICS: readonly Topic[] = [
  { id: "with-window", options: { window: ["front_window", "top_window"], pouch_feat: ["window"] } },
  {
    id: "with-hang-tab",
    options: { hang: ["euro_slot", "round_hole", "sombrero_header"], pouch_feat: ["hang_hole"] },
  },
  { id: "lock-bottom", options: { tuck_bottom: ["crash_lock", "snap_lock_123", "four_flap_lock"] } },
  {
    id: "with-handle",
    options: {
      handle: ["die_cut_handle", "insert_handle"],
      bag_handle: ["twisted_paper", "flat_paper", "rope", "die_cut"],
    },
  },
  { id: "with-hand-holes", options: { hand_holes: ["end_panels", "side_panels"] } },
  { id: "with-insert", options: { insert: ["die_cut_insert"] } },
  { id: "magnetic-closure", options: { closure_rigid: ["magnetic"] } },
  { id: "ribbon-closure", options: { closure_rigid: ["ribbon"] } },
  { id: "with-zipper", options: { pouch_feat: ["zipper"] } },
  { id: "with-tear-strip", options: { tear_strip: ["zip_tear_strip"] } },
  { id: "self-seal", options: { adhesive: ["single_strip", "dual_strip_return"] } },
  { id: "with-vents", options: { vents: ["round", "oblong"] } },
  { id: "with-thumb-notch", options: { thumb: ["thumb_notch"] } },
  { id: "airplane-tuck", options: { tuck_top: ["airplane_tuck"] } },
  { id: "with-header-card", options: { header: ["header_card"] } },
  { id: "lock-corner", options: { corner: ["lock_corner"] } },
];

export const topicById = (id: string): Topic | undefined => TOPICS.find((t) => t.id === id);

/** The topics a style offers, from its options (`axis:value`, as the API's card lists them). */
export function topicsOf(options: readonly string[]): Topic[] {
  const have = new Set(options);
  return TOPICS.filter((topic) =>
    Object.entries(topic.options).some(([axis, values]) => values.some((v) => have.has(`${axis}:${v}`))),
  );
}

/**
 * The variants-grid filter of a topic on one style: only the axes the style has — values of one
 * axis are alternatives for the API, different axes would all have to apply.
 */
export function topicFilter(topic: Topic, options: readonly string[]): string[] {
  const have = new Set(options);
  for (const [axis, values] of Object.entries(topic.options)) {
    const mine = values.filter((v) => have.has(`${axis}:${v}`));
    if (mine.length) return mine.map((v) => `${axis}:${v}`);
  }
  return [];
}

/** Whether a variant's options (`axis` → value or set) are part of a topic. */
export function variantIn(topic: Topic, options: Record<string, unknown>): boolean {
  return Object.entries(topic.options).some(([axis, values]) => {
    const value = options[axis];
    return (Array.isArray(value) ? value : [value]).some((v) => values.includes(String(v)));
  });
}

/** A style's short name for a page title: without its parenthesised gloss ("กล่องฝาเสียบ (ปรับฝาบน-ล่างได้)"). */
export const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*/g, " ").trim();

/**
 * "กล่องฝาเสียบมีหน้าต่าง" / "Tuck-end carton with a window": the style's short name and the feature's phrase —
 * once. A style whose own name already says the feature ("กล่องเมลเลอร์ปิดด้วยเทปกาวในตัว") keeps its name as is,
 * rather than repeating the phrase ("…ปิดด้วยเทปกาวในตัวปิดด้วยเทปกาวในตัว", live review R1).
 */
export function topicHeading(name: string, phrase: string, locale: string): string {
  const short = shortName(name);
  const fold = (text: string) => text.replace(/\s+/g, "").toLowerCase();
  if (phrase && fold(short).includes(fold(phrase))) return short;
  return `${short}${locale === "en" ? " " : ""}${phrase}`;
}

/** Where a style's option page lives: under its own page. */
export const topicHref = (styleHref: string, topic: string) => `${styleHref}/${topic}`;
