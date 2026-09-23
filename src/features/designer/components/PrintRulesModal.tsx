"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";

const RULES = ["safeZone", "bleed", "resolution", "typeSize", "colour", "corrugated"] as const;

/**
 * The print rules a customer needs before committing artwork. Contextual help, in the
 * customer's words, kept in one place so the same wording reaches the proof email (F3).
 */
export function PrintRulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("designer.printRules");
  const tCommon = useTranslations("common");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      closeLabel={tCommon("actions.close")}
      footer={<Button onClick={onClose}>{t("understood")}</Button>}
    >
      <dl className="space-y-3 text-sm">
        {RULES.map((rule) => (
          <div key={rule}>
            <dt className="font-medium">{t(`${rule}Title`)}</dt>
            <dd className="text-muted">{t(`${rule}Body`)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
