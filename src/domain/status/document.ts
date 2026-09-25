import { defineStatusMap } from "./types";
import type { DocumentStatus } from "./contract";

/** A customer document — tax invoice, receipt, credit note. A voided document keeps its number (accounting-design §5). */
export const DOCUMENT_STATUS = defineStatusMap<DocumentStatus>({
  issued: { tone: "success", icon: "file-check", labelKey: "document.issued" },
  void: { tone: "neutral", icon: "ban", labelKey: "document.void" },
});
