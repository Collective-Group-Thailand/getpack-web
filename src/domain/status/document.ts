import { defineStatusMap } from "./types";
import type { DocumentStatus } from "./contract";

/**
 * An accounting document (source: `docs/accounting-design.md` §5 — see `./contract.ts`).
 *
 * `void` keeps its number rather than deleting it: the series is gapless, and a missing number
 * is an audit finding. `replaced` is the other half of that rule — a replacement invoice points
 * back at the document it supersedes.
 */
export const DOCUMENT_STATUS = defineStatusMap<DocumentStatus>({
  draft: { tone: "neutral", icon: "edit", labelKey: "document.draft" },
  issued: { tone: "info", icon: "document", labelKey: "document.issued" },
  sent: { tone: "primary", icon: "send", labelKey: "document.sent" },
  void: { tone: "danger", icon: "ban", labelKey: "document.void" },
  replaced: { tone: "neutral", icon: "refresh", labelKey: "document.replaced" },
});
