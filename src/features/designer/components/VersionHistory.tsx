"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { storeDesigns, type DesignVersion } from "@/features/designer/data/api";
import { readDesign } from "@/features/designer/document";
import { formatDateTime } from "@/i18n/format";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { Slider } from "@/ui/components/Slider";

import { DesignViewer } from "./DesignViewer";

export interface VersionHistoryProps {
  designId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (versionNo: number) => Promise<void>;
  /** Saves what is on screen as a named version (U4.7); `false` when the save failed. */
  onName?: (label: string) => Promise<boolean>;
}

type Read = NonNullable<ReturnType<typeof readDesign>>;

/**
 * The design's saved versions, newest first (`store.designs.listVersions`). Restoring makes an old
 * version current again as a new version — nothing in the history is overwritten. Each version
 * says what made it (an autosave, a save, a restore, an import) and carries its label; the current
 * state can be saved under a name (U4.7), and two versions compared side by side or one over the
 * other.
 */
export function VersionHistory({ designId, open, onClose, onRestore, onName }: VersionHistoryProps) {
  const t = useTranslations("designer.history");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const [versions, setVersions] = useState<DesignVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [naming, setNaming] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    storeDesigns
      .versions(designId)
      .then((list) => !cancelled && setVersions(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [designId, reload]);

  const name = async () => {
    if (!onName || !label.trim()) return;
    setNaming(true);
    const ok = await onName(label.trim());
    setNaming(false);
    if (ok) {
      setLabel("");
      setReload((n) => n + 1);
    }
  };

  // Two at most: picking a third lets the earliest pick go.
  const toggle = (versionNo: number, on: boolean) =>
    setPicked((list) =>
      on ? [...list.filter((n) => n !== versionNo), versionNo].slice(-2) : list.filter((n) => n !== versionNo),
    );
  const [older, newer] = [...picked].sort((a, b) => a - b);

  return (
    <>
      <Dialog
        open={open && !comparing}
        onOpenChange={(next) => !next && onClose()}
        title={t("title")}
        description={t("body")}
        closeLabel={tCommon("actions.close")}
      >
        {onName ? (
          <form
            className="mb-4 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void name();
            }}
          >
            <Field label={t("nameLabel")} className="flex-1">
              <Input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} />
            </Field>
            <Button type="submit" loading={naming} disabled={!label.trim()}>
              {t("name")}
            </Button>
          </form>
        ) : null}
        {failed ? (
          <p className="text-danger text-sm">{t("failed")}</p>
        ) : versions === null ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <>
            <ol className="divide-border divide-y">
              {versions.map((version, index) => (
                <li key={version.versionNo} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      label={<span className="sr-only">{t("pick", { version: version.versionNo })}</span>}
                      checked={picked.includes(version.versionNo)}
                      onCheckedChange={(on) => toggle(version.versionNo, on === true)}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {t("version", { version: version.versionNo })}
                        {version.label ? <span className="text-muted ms-2 font-normal">{version.label}</span> : null}
                      </p>
                      <p className="text-muted text-xs">
                        {t(`kinds.${version.kind}`)} · {formatDateTime(version.createdAt, locale)}
                      </p>
                    </div>
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
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-muted text-xs" role="status">
                {older !== undefined && newer !== undefined ? t("picked", { older, newer }) : t("pickTwo")}
              </p>
              <Button size="sm" disabled={picked.length !== 2} onClick={() => setComparing(true)}>
                {t("compare")}
              </Button>
            </div>
          </>
        )}
      </Dialog>
      {comparing && older !== undefined && newer !== undefined ? (
        <CompareVersions designId={designId} older={older} newer={newer} onClose={() => setComparing(false)} />
      ) : null}
    </>
  );
}

/** Two versions of the design, side by side or one over the other with a fader (U4.7). */
function CompareVersions({
  designId,
  older,
  newer,
  onClose,
}: {
  designId: string;
  older: number;
  newer: number;
  onClose: () => void;
}) {
  const t = useTranslations("designer.history");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [fade, setFade] = useState(50);
  const [read, setRead] = useState<[Read | null, Read | null] | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (versionNo: number) => {
      const version = await storeDesigns.version(designId, versionNo);
      const document = version.document as { spec?: unknown; content?: unknown } | null;
      return document ? readDesign(document.spec, document.content) : null;
    };
    Promise.all([load(older), load(newer)])
      .then((pair) => !cancelled && setRead(pair))
      .catch(() => !cancelled && setRead("failed"));
    return () => {
      cancelled = true;
    };
  }, [designId, older, newer]);

  const view = (r: Read | null, versionNo: number, prefix: string) =>
    r ? (
      <DesignViewer spec={r.spec} content={r.content} label={t("version", { version: versionNo })} idPrefix={prefix} />
    ) : (
      <p className="text-muted text-sm">{t("unreadable")}</p>
    );

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("compareTitle", { older, newer })}
      closeLabel={tCommon("actions.close")}
      size="xl"
    >
      <div className="space-y-3">
        <SegmentedControl
          label={t("compareMode")}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "side", label: t("sideBySide") },
            { value: "overlay", label: t("overlay") },
          ]}
        />
        {read === null ? <Skeleton className="h-64 w-full" /> : null}
        {read === "failed" ? <p className="text-danger text-sm">{t("failed")}</p> : null}
        {Array.isArray(read) && mode === "side" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <figure className="space-y-1">
              <div className="bg-surface-subtle aspect-[4/3] rounded-lg p-2">{view(read[0], older, "v-old")}</div>
              <figcaption className="text-muted text-center text-xs">{t("version", { version: older })}</figcaption>
            </figure>
            <figure className="space-y-1">
              <div className="bg-surface-subtle aspect-[4/3] rounded-lg p-2">{view(read[1], newer, "v-new")}</div>
              <figcaption className="text-muted text-center text-xs">{t("version", { version: newer })}</figcaption>
            </figure>
          </div>
        ) : null}
        {Array.isArray(read) && mode === "overlay" ? (
          <div className="space-y-2">
            <div className="bg-surface-subtle relative aspect-[4/3] rounded-lg p-2">
              <div className="absolute inset-2">{view(read[0], older, "o-old")}</div>
              <div className="absolute inset-2" style={{ opacity: fade / 100 }}>
                {view(read[1], newer, "o-new")}
              </div>
            </div>
            <Field label={t("fade", { older, newer })}>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[fade]}
                onValueChange={([v]) => setFade(v ?? 50)}
                valueText={t("fadeValue", { percent: fade })}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
