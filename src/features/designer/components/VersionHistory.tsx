"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { storeDesigns, type DesignVersion } from "@/features/designer/data/api";
import { formatDateTime } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Skeleton } from "@/ui/components/Skeleton";

export interface VersionHistoryProps {
  designId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (versionNo: number) => Promise<void>;
}

/**
 * The design's saved versions, newest first (`store.designs.listVersions`). Restoring makes an old
 * version current again as a new version — nothing in the history is overwritten. Each version
 * says what made it (an autosave, a save, a restore, an import) and carries its label.
 */
export function VersionHistory({ designId, open, onClose, onRestore }: VersionHistoryProps) {
  const t = useTranslations("designer.history");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const [versions, setVersions] = useState<DesignVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    storeDesigns
      .versions(designId)
      .then((list) => !cancelled && setVersions(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [designId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
    >
      {failed ? (
        <p className="text-danger text-sm">{t("failed")}</p>
      ) : versions === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <ol className="divide-border divide-y">
          {versions.map((version, index) => (
            <li key={version.versionNo} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {t("version", { version: version.versionNo })}
                  {version.label ? <span className="text-muted ms-2 font-normal">{version.label}</span> : null}
                </p>
                <p className="text-muted text-xs">
                  {t(`kinds.${version.kind}`)} · {formatDateTime(version.createdAt, locale)}
                </p>
              </div>
              {index === 0 ? (
                <span className="text-muted text-xs">{t("current")}</span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === version.versionNo}
                  onClick={async () => {
                    setBusy(version.versionNo);
                    await onRestore(version.versionNo);
                    setBusy(null);
                  }}
                >
                  {t("restore")}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
