import type { Localized } from "./types";

/**
 * Face names. The engine returns keys only (`Face.label`); these are the words for them, so the
 * designer, the configurator and the drawing service in packio-api all say the same thing.
 * Thai is the prepress wording used on Thai shop floors; English follows ECMA/FEFCO usage.
 */
export const FACE_LABELS = {
  front: { th: "ด้านหน้า", en: "Front" },
  back: { th: "ด้านหลัง", en: "Back" },
  side: { th: "ด้านข้าง", en: "Side" },
  left: { th: "ด้านซ้าย", en: "Left side" },
  right: { th: "ด้านขวา", en: "Right side" },
  top: { th: "ด้านบน", en: "Top" },
  bottom: { th: "ด้านล่าง", en: "Bottom" },
  glue_flap: { th: "ปีกกาว", en: "Glue flap" },
  top_flap: { th: "ฝาบน", en: "Top flap" },
  bottom_flap: { th: "ฝาล่าง", en: "Bottom flap" },
  outer_flap: { th: "ฝาปิดนอก", en: "Outer flap" },
  inner_flap: { th: "ฝาปิดใน", en: "Inner flap" },
  dust_flap: { th: "ปีกกันฝุ่น", en: "Dust flap" },
  lid: { th: "ฝา", en: "Lid" },
  tuck: { th: "ลิ้นเสียบ", en: "Tuck flap" },
  lock_flap: { th: "ปีกล็อกก้น", en: "Lock flap" },
  crash_flap: { th: "ปีกก้นล็อกอัตโนมัติ", en: "Crash-lock flap" },
  base: { th: "ฐาน", en: "Base" },
  wall: { th: "ผนัง", en: "Wall" },
  wall_front: { th: "ผนังหน้า", en: "Front wall" },
  wall_back: { th: "ผนังหลัง", en: "Back wall" },
  wall_left: { th: "ผนังซ้าย", en: "Left wall" },
  wall_right: { th: "ผนังขวา", en: "Right wall" },
  inner_wall: { th: "ผนังชั้นใน", en: "Inner wall" },
  corner_flap: { th: "ปีกมุม", en: "Corner flap" },
  lock_tab: { th: "ลิ้นล็อก", en: "Locking tab" },
  hanger: { th: "หูแขวน", en: "Hang tab" },
  handle: { th: "หูหิ้ว", en: "Handle" },
  roof: { th: "หลังคา", en: "Roof panel" },
  end_flap: { th: "ปีกปลายโค้ง", en: "Curved end flap" },
  label: { th: "พื้นที่ฉลาก", en: "Label" },
  tag: { th: "ป้าย", en: "Tag" },
  band: { th: "สายคาด", en: "Band" },
  panel: { th: "แผง", en: "Panel" },
  platform: { th: "แผ่นรองสินค้า", en: "Insert platform" },
  insert_leg: { th: "ขาตัวรอง", en: "Insert leg" },
} as const satisfies Record<string, Localized>;

export type FaceLabel = keyof typeof FACE_LABELS;

export const PIECE_LABELS = {
  blank: { th: "แผ่นคลี่", en: "Blank" },
  lid: { th: "ฝา", en: "Lid" },
  base: { th: "ตัวกล่อง", en: "Base" },
  sleeve: { th: "ปลอก", en: "Sleeve" },
  drawer: { th: "ลิ้นชัก", en: "Drawer" },
  insert: { th: "ตัวรองสินค้า", en: "Insert" },
} as const satisfies Record<string, Localized>;

export type PieceLabel = keyof typeof PIECE_LABELS;

/** The words for a face label key, falling back to the key itself for an unknown one. */
export function faceLabel(key: string): Localized {
  return (FACE_LABELS as Record<string, Localized>)[key] ?? { th: key, en: key };
}

export function pieceLabel(key: string): Localized {
  return (PIECE_LABELS as Record<string, Localized>)[key] ?? { th: key, en: key };
}
