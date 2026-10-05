import type { Localized } from "../../types";

/* The words for the axes the style library's waves add (U3.4) — pending review (D-212). */

/** A pouch's features, one phrase each; a multi-select axis value is the sorted set joined by `+` (packio-api). */
const POUCH_FEATURES: Record<string, Localized> = {
  hang_hole: { th: "รูแขวน", en: "hang hole" },
  tear_notch: { th: "รอยบากฉีก", en: "tear notch" },
  window: { th: "หน้าต่าง", en: "window" },
  zipper: { th: "ซิปล็อก", en: "zipper" },
};

function pouchFeatPhrases(): Record<string, Localized | null> {
  const keys = Object.keys(POUCH_FEATURES).sort();
  const out: Record<string, Localized | null> = { none: null };
  for (let mask = 1; mask < 1 << keys.length; mask++) {
    const set = keys.filter((_k, i) => mask & (1 << i));
    out[set.join("+")] = {
      th: `มี${set.map((k) => POUCH_FEATURES[k].th).join(" ")}`,
      en: set.map((k) => POUCH_FEATURES[k].en).join(", "),
    };
  }
  return out;
}

export const WAVE_AXIS_PHRASES: Record<string, Record<string, Localized | null>> = {
  tuck_top: {
    straight_tuck: { th: "ฝาเสียบ", en: "straight tuck top" },
    reverse_tuck: { th: "ฝาเสียบสลับ", en: "reverse tuck top" },
    airplane_tuck: { th: "ฝาเสียบแบบเครื่องบิน", en: "airplane tuck top" },
    seal: { th: "ฝาปิดกาว", en: "seal top" },
  },
  tuck_bottom: {
    tuck: { th: "ก้นเสียบ", en: "tuck bottom" },
    snap_lock_123: { th: "ก้นล็อก 1-2-3", en: "snap-lock (1-2-3) bottom" },
    crash_lock: { th: "ก้นล็อกอัตโนมัติ", en: "crash-lock bottom" },
    seal: { th: "ก้นปิดกาว", en: "seal bottom" },
    four_flap_lock: { th: "ก้นล็อก 4 ปีก", en: "four-flap lock bottom" },
  },
  lock: {
    friction: { th: "ล็อกด้วยแรงเสียดทาน", en: "friction lock" },
    slit_lock: { th: "ล็อกร่อง", en: "slit lock" },
  },
  tuck_corner: {
    square: { th: "มุมเหลี่ยม", en: "square corners" },
    rounded: { th: "มุมมน", en: "rounded corners" },
  },
  insert: { none: null, die_cut_insert: { th: "มีตัวรองไดคัท", en: "die-cut insert" } },
  corner: {
    glued: { th: "มุมทากาว", en: "glued corners" },
    lock_corner: { th: "มุมล็อก ไม่ใช้กาว", en: "lock corners, no glue" },
  },
  handle: {
    none: null,
    die_cut_handle: { th: "หูหิ้วไดคัท", en: "die-cut handle" },
    insert_handle: { th: "หูหิ้วแบบสอด", en: "insert handle" },
  },
  joint: {
    glue_flap: { th: "ต่อด้วยปีกกาว", en: "glued joint" },
    stitch_flap: { th: "ต่อด้วยลวดเย็บ", en: "stitched joint" },
    tape_joint: { th: "ต่อด้วยเทป", en: "taped joint" },
  },
  vents: {
    none: null,
    round: { th: "รูระบายอากาศกลม", en: "round vents" },
    oblong: { th: "รูระบายอากาศยาว", en: "oblong vents" },
  },
  mailer_front: {
    tuck: { th: "หน้าเสียบ", en: "tuck front" },
    tab_lock: { th: "หน้าล็อกลิ้น", en: "tab-lock front" },
  },
  tear_strip: { none: null, zip_tear_strip: { th: "มีแถบดึงฉีก", en: "zip tear strip" } },
  header: { none: null, header_card: { th: "มีป้ายหัว", en: "header card" } },
  shelves: {
    "1": { th: "1 ชั้น", en: "one shelf" },
    "2": { th: "2 ชั้น", en: "two shelves" },
    "3": { th: "3 ชั้น", en: "three shelves" },
    "4": { th: "4 ชั้น", en: "four shelves" },
  },

  closure_rigid: {
    none: null,
    magnetic: { th: "ปิดด้วยแม่เหล็ก", en: "magnetic closure" },
    ribbon: { th: "ผูกริบบิ้น", en: "ribbon closure" },
  },
  adhesive: {
    none: null,
    single_strip: { th: "แถบกาวปิดผนึก", en: "adhesive strip" },
    dual_strip_return: { th: "แถบกาวสองเส้น (ส่งคืนได้)", en: "dual adhesive strips (returnable)" },
  },
  shape_flat: {
    rectangle: { th: "สี่เหลี่ยม", en: "rectangle" },
    rounded_rectangle: { th: "สี่เหลี่ยมมุมมน", en: "rounded rectangle" },
    circle: { th: "วงกลม", en: "circle" },
    oval: { th: "วงรี", en: "oval" },
    custom_path: { th: "รูปทรงอิสระ", en: "custom shape" },
  },
  pouch_feat: pouchFeatPhrases(),
  bag_gusset: {
    gusseted: { th: "มีขยายข้าง", en: "gusseted" },
    flat: { th: "แบบแบน", en: "flat" },
  },
  bag_handle: {
    twisted_paper: { th: "หูเชือกกระดาษเกลียว", en: "twisted paper handles" },
    flat_paper: { th: "หูกระดาษแบน", en: "flat paper handles" },
    rope: { th: "หูเชือก", en: "rope handles" },
    die_cut: { th: "หูไดคัท", en: "die-cut handles" },
    none: null,
  },
  partition: Object.fromEntries(
    ["2x2", "2x3", "3x3", "3x4", "4x4", "4x6"].map((g) => {
      const [r, c] = g.split("x");
      return [g, { th: `ช่องกั้น ${r} × ${c}`, en: `${r} × ${c} cells` }];
    }),
  ),
};
