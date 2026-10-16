"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { nanoid } from "nanoid";

import { getStyle } from "@getpack/dieline";
import { storeDesigns, type StoreDesign } from "@/features/designer/data/api";
import { useFileUrl } from "@/features/customer/files/files";
import { sizeOf } from "@/features/designer/document";
import { designRepo, importedLocalIds, markImported } from "@/features/designer/storage";
import type { SavedDesign } from "@/features/designer/types";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { studioHref } from "@/features/customer/studio/paths";

import { OrderedProducts } from "./OrderedProducts";

/** One card's worth, whichever store the design lives in. */
interface Row {
  id: string;
  name: string;
  /** A browser design's own PNG; an account design's is a file, signed for when shown. */
  thumbnail: string | null;
  thumbnailFileId?: string | null;
  spec: string | null;
  updatedAt: string | number;
  orderCode: string | null;
}

/** A card's picture: the browser's own PNG, or the account's thumbnail file through a signed URL. */
function Thumbnail({ src, fileId, empty }: { src: string | null; fileId: string | null; empty: string }) {
  const signed = useFileUrl(src ? null : fileId);
  const url = src ?? signed;
  return url ? (
    // A data URL from the canvas or a signed URL: next/image cannot optimise either, and the name
    // below is the accessible label.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-full w-full object-contain" />
  ) : (
    <span className="text-muted flex h-full items-center justify-center text-sm">{empty}</span>
  );
}

export default function MyDesigns({ account }: { account: StoreDesign[] | null }) {
  const t = useTranslations("designs");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const signedIn = account !== null;

  // Reading localStorage during render would break SSR, so the browser's list starts unknown and
  // the first effect fills it. `null` renders nothing rather than a wrong empty state.
  const [local, setLocal] = useState<SavedDesign[] | null>(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [importing, setImporting] = useState(false);

  const refreshLocal = useCallback(() => setLocal(designRepo.list()), []);
  useEffect(() => {
    // A one-off pull from an external store (localStorage) — the case this rule cannot express.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLocal();
  }, [refreshLocal]);

  const localRow = (design: SavedDesign): Row => ({
    id: design.id,
    name: design.name,
    thumbnail: design.thumbnail ?? null,
    spec: t("card.spec", {
      style: getStyle(design.spec.styleId).name[locale],
      size: sizeOf(design.spec).text,
      paper: design.spec.materialName ?? `${design.spec.material.caliperMm}`,
    }),
    updatedAt: design.updatedAt,
    orderCode: null,
  });
  // A listed design names its product, its size and the orders it was used in.
  const accountRow = (design: StoreDesign): Row => {
    const product = design.product.slug ? (locale === "en" ? design.product.nameEn : design.product.nameTh) : null;
    const size =
      design.lengthMm && design.widthMm && design.heightMm
        ? t("card.size", { l: design.lengthMm, w: design.widthMm, h: design.heightMm })
        : null;
    return {
      id: design.id,
      name: design.title,
      thumbnail: design.thumbnailUrl,
      thumbnailFileId: design.thumbnailFileId,
      spec: [product, size].filter(Boolean).join(" · ") || null,
      updatedAt: design.updatedAt,
      orderCode: design.orders[0]?.orderCode ?? null,
    };
  };

  // Designs kept in this browser that the account does not have yet.
  const imported = new Set(signedIn ? importedLocalIds() : []);
  const waiting = signedIn ? (local ?? []).filter((design) => !imported.has(design.id)) : [];
  const rows = signedIn ? (account ?? []).map(accountRow) : (local ?? []).map(localRow);
  const filtered = rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()));
  const ready = signedIn || local !== null;

  const importLocal = async () => {
    setImporting(true);
    try {
      const result = await storeDesigns.importLocal(
        waiting.map((design) => ({
          localId: design.id,
          name: design.name,
          spec: design.spec,
          content: design.content,
          catalogProductId: design.catalogProductId ?? null,
        })),
        crypto.randomUUID(),
      );
      markImported(result.imported.map((item) => item.localId));
      toast.success(t("import.done", { count: result.imported.length }));
      router.refresh();
      refreshLocal();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("import.failed"));
    } finally {
      setImporting(false);
    }
  };

  const duplicate = async (row: Row) => {
    if (!signedIn) {
      if (!designRepo.duplicate(row.id, nanoid(10))) toast.error(t("duplicateFailed"));
      refreshLocal();
      return;
    }
    try {
      await storeDesigns.duplicate(row.id, t("copyName", { name: row.name }), crypto.randomUUID());
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("duplicateFailed"));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setPendingDelete(null);
    if (!signedIn) {
      designRepo.remove(row.id);
      refreshLocal();
      return;
    }
    try {
      await storeDesigns.remove(row.id);
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("deleteFailed"));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted text-sm">{signedIn ? t("subtitleAccount") : t("subtitle")}</p>
        </div>
        <div className="flex items-end gap-2">
          <Field label={t("searchLabel")} labelHidden className="w-56">
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              inputSize="sm"
            />
          </Field>
          <Button asChild size="sm">
            <Link href="/studio/new">{t("new")}</Link>
          </Button>
        </div>
      </div>

      {signedIn && account ? <OrderedProducts designs={account} /> : null}

      {waiting.length > 0 ? (
        <Callout tone="info" title={t("import.title", { count: waiting.length })} className="mb-6">
          <p className="text-sm">{t("import.body")}</p>
          <Button size="sm" className="mt-3" loading={importing} onClick={() => void importLocal()}>
            {t("import.action")}
          </Button>
        </Callout>
      ) : null}

      {!ready ? null : filtered.length === 0 ? (
        <EmptyState
          icon="box"
          title={rows.length ? t("noResults.title") : t("empty.title")}
          description={rows.length ? t("noResults.body") : t("empty.body")}
          action={
            rows.length ? null : (
              <Button asChild>
                <Link href="/studio/new">{t("empty.action")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <Card as="li" key={row.id} padding="none" className="hover:shadow-overlay overflow-hidden transition">
              <Link
                href={studioHref({ designId: row.id })}
                className="bg-surface-subtle block aspect-[4/3] p-4"
                tabIndex={-1}
                aria-hidden={Boolean(row.thumbnail || row.thumbnailFileId)}
              >
                <Thumbnail src={row.thumbnail} fileId={row.thumbnailFileId ?? null} empty={t("card.noThumbnail")} />
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={studioHref({ designId: row.id })} className="hover:text-primary font-medium">
                    {row.name}
                  </Link>
                  {row.orderCode ? <Badge tone="info">{t("card.linked", { order: row.orderCode })}</Badge> : null}
                </div>
                {row.spec ? <p className="text-muted mt-1 text-xs">{row.spec}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-muted text-xs">
                    {t("card.updated", { date: formatDateTime(row.updatedAt, locale) })}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void duplicate(row)}>
                      {tCommon("actions.duplicate")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPendingDelete(row)}>
                      {tCommon("actions.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {/*
        Replaces window.confirm: a native dialog cannot be styled, cannot be translated, and
        cannot restate what is about to be deleted (design-system.md §4).
      */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        tone="destructive"
        title={t("delete.title")}
        description={t("delete.body", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
