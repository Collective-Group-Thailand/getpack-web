import { defineStatusMap } from "./types";
import type { SampleKind, SampleStatus } from "./contract";

/**
 * A physical sample (U2.F3, D-253–D-257): asked for, quoted by CS, bought, made by the factory with
 * its evidence, delivered, then decided by the customer. A rejected or changed sample may lead to a
 * new one (`previousSampleId`).
 */
export const SAMPLE_STATUS = defineStatusMap<SampleStatus>({
  requested: { tone: "neutral", icon: "hourglass", labelKey: "sample.requested" },
  quoted: { tone: "primary", icon: "receipt", labelKey: "sample.quoted" },
  paid: { tone: "info", icon: "wallet", labelKey: "sample.paid" },
  in_production: { tone: "info", icon: "factory", labelKey: "sample.inProduction" },
  shipped: { tone: "info", icon: "truck", labelKey: "sample.shipped" },
  delivered: { tone: "warning", icon: "package-check", labelKey: "sample.delivered" },
  approved: { tone: "success", icon: "check", labelKey: "sample.approved" },
  changes_requested: { tone: "warning", icon: "edit", labelKey: "sample.changesRequested" },
  rejected: { tone: "danger", icon: "ban", labelKey: "sample.rejected" },
  cancelled: { tone: "neutral", icon: "ban", labelKey: "sample.cancelled" },
  expired: { tone: "neutral", icon: "clock", labelKey: "sample.expired" },
});

/** Attached to a bulk order (it waits for the approval), or asked for before ordering. */
export const SAMPLE_KIND = defineStatusMap<SampleKind>({
  attached: { tone: "info", icon: "link", labelKey: "sampleKind.attached" },
  standalone: { tone: "neutral", icon: "package", labelKey: "sampleKind.standalone" },
});
