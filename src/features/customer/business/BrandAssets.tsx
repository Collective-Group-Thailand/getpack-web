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
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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

  // Project C: the files as cards in a grid (an icon plate by kind, the name, its kind and who added it, the
  // download), and adding one as a side card beside them on a wide screen.
  return (
    <div className={cn("grid items-start gap-6", canManage && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
      <div className="min-w-0">
        {assets.length === 0 ? (
          <div className="border-border bg-surface rounded-card text-muted flex flex-col items-center gap-2 border px-6 py-12 text-center">
            <Icon name="image" size={26} aria-hidden="true" />
            <p>{t("empty")}</p>
          </div>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => (
            <li key={asset.id} className="bg-surface border-border rounded-card flex min-w-0 flex-col gap-3 border p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-surface-subtle text-muted grid size-10 shrink-0 place-items-center rounded-lg"
                >
                  <Icon name={asset.kind === "logo" ? "image" : "document"} size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:break-word] break-keep">{asset.name}</p>
                  <p className="mt-0.5">
                    <Badge tone="neutral" size="sm">
                      {t(`kinds.${asset.kind}`)}
                    </Badge>
                  </p>
                  <p className="text-muted text-xs">
                    {t("meta", {
                      file: asset.fileName,
                      by: asset.addedBy.displayName,
                      date: format.date(asset.addedAt),
                    })}
                  </p>
                </div>
              </div>
              <div className="border-border mt-auto flex gap-2 border-t pt-3">
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
      </div>
      {canManage ? (
        <section
          aria-labelledby="asset-add"
          className="bg-surface border-border rounded-card flex flex-col gap-4 border p-4 sm:p-5 lg:sticky lg:top-[calc(var(--site-sticky-top,0px)+1rem)]"
        >
          <h2 id="asset-add" className="text-lg font-semibold">
            {t("addTitle")}
          </h2>
          <div className="grid gap-4">
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
