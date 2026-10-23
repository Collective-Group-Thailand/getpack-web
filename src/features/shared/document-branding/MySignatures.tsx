"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/features/shared/actions/ConfirmAction";
import { problemMessage } from "@/features/shared/actions/QueryError";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input } from "@/ui/components/Input";
import { SignaturePad } from "@/ui/components/SignaturePad";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

type Mine = Schemas["MySignatoryDto"];
type Zone = "admin" | "partner";

async function load(zone: Zone): Promise<Mine[]> {
  const api = browserApi();
  return zone === "admin"
    ? ((await api.GET("/v1/admin/me/signatures", {})).data ?? [])
    : ((await api.GET("/v1/partner/me/signatures", {})).data ?? []);
}

async function save(zone: Zone, signatoryId: string, body: Schemas["UpdateMySignatureDto"]): Promise<Mine[]> {
  const api = browserApi();
  const params = { path: { signatoryId } };
  return zone === "admin"
    ? ((await api.PUT("/v1/admin/me/signatures/{signatoryId}", { params, body })).data ?? [])
    : ((await api.PUT("/v1/partner/me/signatures/{signatoryId}", { params, body })).data ?? []);
}

/**
 * The signed-in person's own signature (D-429): only they set or withdraw it, for each owner (getpack or a
 * factory) that named them signatory. A photographed signature or one drawn on the screen; the API makes the
 * paper transparent. Shows which kinds of document print it.
 */
export function MySignatures({ zone }: { zone: Zone }) {
  const t = useTranslations("docBranding.mine");
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load(zone)
      .then((next) => alive && setRows(next))
      .catch((caught: unknown) => alive && setError(problemMessage(caught, t("noSignature"))));
    return () => {
      alive = false;
    };
  }, [zone, t]);

  if (error) return <Callout tone="danger" title={error} />;
  if (!rows) return <Skeleton className="h-48" />;
  if (rows.length === 0) return <Callout tone="neutral" title={t("none")} />;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Entry key={row.id} zone={zone} row={row} onSaved={setRows} />
      ))}
    </div>
  );
}

function Entry({ zone, row, onSaved }: { zone: Zone; row: Mine; onSaved: (rows: Mine[]) => void }) {
  const t = useTranslations("docBranding.mine");
  const tKinds = useTranslations("docBranding.rules.kinds");
  const format = useFormat();
  const [name, setName] = useState(row.displayName);
  const [position, setPosition] = useState(row.position);
  const [image, setImage] = useState<File | Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !position.trim()) return;
    setBusy(true);
    try {
      let fileId: string | undefined;
      if (image) {
        const file = image instanceof File ? image : new File([image], "signature.png", { type: "image/png" });
        fileId = (await uploadFile(zone, file, "signature")).id;
      }
      onSaved(
        await save(zone, row.id, {
          displayName: name.trim(),
          position: position.trim(),
          ...(fileId ? { fileId } : {}),
        }),
      );
      setImage(null);
      toast.success(t("saved"));
    } catch (caught) {
      toast.error(problemMessage(caught, t("save")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t("for", { owner: row.owner.name })}</h2>
        <p className="text-muted text-sm">
          {row.signs.length
            ? t("signs", { kinds: row.signs.map((kind) => tKinds(kind as "tax_invoice")).join(", ") })
            : t("signsNone")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("current")}</p>
        <div className="bg-surface-subtle grid h-24 w-64 max-w-full place-items-center rounded-md">
          {row.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL
            <img src={row.signatureUrl} alt={t("current")} className="max-h-20 max-w-60 object-contain" />
          ) : (
            <span className="text-muted text-sm">{t("noSignature")}</span>
          )}
        </div>
        {row.signatureUpdatedAt ? (
          <p className="text-muted text-xs">{format.dateTime(row.signatureUpdatedAt)}</p>
        ) : null}
      </div>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("displayName")} required>
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label={t("position")} required>
            <Input value={position} maxLength={120} onChange={(event) => setPosition(event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("newSignature")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <FilePickButton
              label={t("uploadImage")}
              accept="image/png,image/jpeg,image/webp"
              icon="image"
              onFiles={([file]) => {
                if (file) {
                  setImage(file);
                  toast.success(t("imageReady"));
                }
              }}
            />
            <span className="text-muted text-xs">{t("imageHint")}</span>
          </div>
          <p className="text-muted text-sm">{t("draw")}</p>
          <SignaturePad
            onChange={(blob) => setImage(blob)}
            labels={{
              label: t("pad.label"),
              hint: t("pad.hint"),
              clear: t("pad.clear"),
              draw: t("pad.draw"),
              type: t("pad.type"),
              typedName: t("pad.typedName"),
              mode: t("pad.mode"),
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} disabled={!name.trim() || !position.trim()}>
            {t("save")}
          </Button>
          {row.hasSignature ? (
            <Button type="button" variant="ghost" iconStart="trash" onClick={() => setWithdrawing(true)}>
              {t("withdraw")}
            </Button>
          ) : null}
        </div>
      </form>
      {withdrawing ? (
        <ConfirmAction
          open
          onOpenChange={setWithdrawing}
          title={t("withdrawTitle")}
          description={t("withdrawBody")}
          confirmLabel={t("withdraw")}
          tone="destructive"
          onConfirm={async () => {
            onSaved(
              await save(zone, row.id, {
                displayName: name.trim() || row.displayName,
                position: position.trim() || row.position,
                fileId: null,
              }),
            );
            toast.success(t("withdrawn"));
            setWithdrawing(false);
          }}
        />
      ) : null}
    </Card>
  );
}
