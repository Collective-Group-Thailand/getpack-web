import { t } from "../styles/_shared";
import type { BodyKind, ModuleDef, ModuleSlot, Process } from "./types";

/**
 * Modules the style library needs (U3 prompt, `style-library-program.md` §3) that no current
 * style uses yet. They are declared so recipes, the catalogue and the capability matrix can name
 * them; U3.4 implements each one before the first recipe that uses it ("missing modules first").
 * Building a recipe that uses one throws `module.not_implemented`.
 */
function planned(
  id: string,
  slot: ModuleSlot,
  label: ReturnType<typeof t>,
  processes: Process[],
  fits: BodyKind[] = ["tube"],
): ModuleDef {
  const base = { id, status: "planned" as const, label, params: [], processes, contributes: { kinds: [], roles: [] } };
  const fail = () => {
    throw new Error(`module.not_implemented: ${id}`);
  };
  switch (slot) {
    case "body":
      return { ...base, slot, kind: "special", folds: true, build: fail };
    case "pieceSet":
      return { ...base, slot, build: fail };
    case "closure":
      return { ...base, slot, fits, tube: fail, tray: fail };
    case "feature":
      return { ...base, slot, fits, tubeHoles: fail };
  }
}

export const PLANNED_MODULES: ModuleDef[] = [
  planned("ngonTube", "body", t("ตัวกล่องหลายเหลี่ยม (3, 8 ด้าน)", "n-sided tube (3, 8 sides)"), [
    "die_cut",
    "folder_gluer_straight",
  ]),
  planned("taperedPail", "body", t("ถังทรงสอบ", "Tapered pail"), ["die_cut", "folder_gluer_straight"]),
  planned("petal", "closure", t("ฝากลีบดอก", "Petal closure"), ["die_cut", "hand_assembly"]),
  planned("lockCorners", "feature", t("มุมล็อก (ไม่ใช้กาว)", "Lock corners (no glue)"), ["die_cut"], ["tray"]),
  planned("sombreroHeader", "feature", t("หูแขวนทรงหมวก", "Sombrero hang header"), ["die_cut"]),
  planned("tearStrip", "feature", t("แถบดึงฉีก", "Tear strip"), ["die_cut", "tear_strip_applicator"], ["tube", "tray"]),
  planned(
    "adhesiveStrip",
    "feature",
    t("แถบกาวปิดผนึก", "Adhesive strip (single / dual return)"),
    ["adhesive_strip_applicator"],
    ["tube", "tray"],
  ),
  planned("vents", "feature", t("รูระบายอากาศ", "Vent holes"), ["die_cut"], ["tube", "tray"]),
  planned("dispenser", "feature", t("ช่องดึงสินค้า", "Dispenser opening"), ["die_cut"]),
  planned("neckLock", "feature", t("ล็อกคอขวด", "Neck lock"), ["die_cut"]),
  planned("dustFlapLock", "feature", t("ล็อกปีกกันฝุ่น", "Dust-flap lock"), ["die_cut"]),
  planned("slitLock", "feature", t("ล็อกร่อง", "Slit lock"), ["die_cut"]),
  planned("bodyAndInsert", "pieceSet", t("ตัวกล่อง + ตัวรอง", "Body and insert"), ["die_cut", "hand_assembly"]),
  planned("partitionGrid", "pieceSet", t("ช่องกั้นตาราง", "Partition grid (rows × columns)"), [
    "die_cut",
    "slotter",
    "hand_assembly",
  ]),
];
