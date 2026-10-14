"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { toast } from "@/ui/components/Toast";

type Asset = Schemas["CompanyAssetDto"];
type Kind = Asset["kind"];
const KINDS: Kind[] = ["logo", "guideline", "font", "artwork", "other"];

/**
 * Brand assets every member shares (F3 3.7, `store.companyAssets.*`): logos, guidelines, fonts and
 * approved artwork to reuse. The Company Admin adds and removes them (D-227); everyone downloads.
 */
export function BrandAssets({
  companyId,
  assets,
  canManage,
}: {
  companyId: string;
  assets: Asset[];
  canManage: boolean;
}) {
  const t = useTranslations("business.assets");
  const format = useFormat();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("logo");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadFile("customer", file, "artwork", { companyId });
      await browserApi().POST("/v1/store/companies/{companyId}/brand-assets", {
        params: { path: { companyId }, header: { "Idempotency-Key": crypto.randomUUID() } },
        body: { fileId: uploaded.id, kind, name: name.trim() || file.name },
      });
      toast.success(t("added", { name: name.trim() || file.name }));
      setName("");
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: Asset) {
    try {
      await browserApi().DELETE("/v1/store/companies/{companyId}/brand-assets/{assetId}", {
        params: { path: { companyId, assetId: asset.id } },
      });
      toast.success(t("removed", { name: asset.name }));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {assets.length === 0 ? <p className="text-muted">{t("empty")}</p> : null}
      <ul className="flex flex-col gap-2">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="bg-surface border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {asset.name} <Badge tone="neutral">{t(`kinds.${asset.kind}`)}</Badge>
              </p>
              <p className="text-muted text-xs">
                {t("meta", {
                  file: asset.fileName,
                  by: asset.addedBy.displayName,
                  date: format.date(asset.addedAt),
                })}
              </p>
            </div>
            <div className="flex gap-2">
              {asset.url ? (
                <Button asChild size="sm" variant="secondary" iconStart="download">
                  <a href={asset.url} target="_blank" rel="noopener noreferrer">
                    {t("download")}
                    <span className="sr-only"> {asset.name}</span>
                  </a>
                </Button>
              ) : null}
              {canManage ? (
                <Button size="sm" variant="ghost" onClick={() => void remove(asset)}>
                  {t("remove")}
                  <span className="sr-only"> {asset.name}</span>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {canManage ? (
        <section
          aria-labelledby="asset-add"
          className="bg-surface border-border flex max-w-xl flex-col gap-4 rounded-xl border p-5"
        >
          <h2 id="asset-add" className="text-lg font-semibold">
            {t("addTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("kind")}>
              <SearchableSelect
                value={kind}
                onValueChange={setKind}
                options={KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
              />
            </Field>
            <Field label={t("name")} hint={t("nameHint")}>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          </div>
          <FileDropzone
            disabled={busy}
            maxBytes={100_000_000}
            onFiles={(files) => files[0] && void add(files[0])}
            labels={{
              prompt: t("drop"),
              browse: t("browse"),
              hint: t("hint"),
              tooLarge: (file) => t("tooLarge", { name: file }),
              wrongType: (file) => t("wrongType", { name: file }),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
