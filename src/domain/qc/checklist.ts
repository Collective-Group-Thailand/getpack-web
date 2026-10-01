import type { Schemas } from "@/lib/api/types";

/**
 * The QC checklist a factory answers before the QC step completes (D-076) — interim, owned here.
 *
 * CONTRACT-GAP partner.job-qc-checklist: `partner.production.recordQc` requires `checklist` and
 * `checklistVersion` and stores what it is sent ("which checklist the factory used"), but no
 * partner response carries the route's checklist, and packio-api will not invent one (triage,
 * v0.6.0). Until the job carries it, the factory answers this list, sent under its own version so
 * a record can always be traced to the questions asked (user decision, U-F0.4, 2026-10-01). The
 * items are the five the F5.2 floor showed; replace the list, not the form, when the API sends one.
 */
export const QC_CHECKLIST_VERSION = "packio-web-v1";

export const QC_CHECKLIST_ITEMS = ["colour", "registration", "diecut", "count", "clean"] as const;

export type QcChecklistItem = (typeof QC_CHECKLIST_ITEMS)[number];

/** A defect names the item it failed (`QcDefectDto.code`), so a record reads back without free text. */
export type QcDefectCode = QcChecklistItem;

/** Message key of an item's question, in the `partner.jobs` namespace. */
export function qcItemLabelKey(item: QcChecklistItem): `qc.items.${QcChecklistItem}` {
  return `qc.items.${item}`;
}

export const DEFECT_SEVERITIES: readonly Schemas["DefectSeverity"][] = ["critical", "major", "minor"];
