"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { nanoid } from "nanoid";

import { getStyle } from "@getpack/dieline";
import { storeDesigns, type StoreDesign } from "@/features/designer/data/api";
import { sizeOf } from "@/features/designer/document";
import { designRepo, importedLocalIds, markImported } from "@/features/designer/storage";
import type { SavedDesign } from "@/features/designer/types";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { DesignThumb } from "@/features/customer/account/DesignThumb";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { isApiError } from "@/lib/api/problem";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
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
      <AccountHeader
        className="mb-6"
        title={t("title")}
        lede={signedIn ? t("subtitleAccount") : t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/studio">{t("new")}</Link>
          </Button>
        }
      />
      {signedIn && account ? <OrderedProducts designs={account} /> : null}
      {/* Project B3: the search in a toolbar card over the grid of designs. */}
      {rows.length > 0 ? (
        <div className="border-border bg-surface rounded-card mb-4 flex flex-wrap items-center gap-3 border p-3">
          <Field label={t("searchLabel")} labelHidden className="w-full sm:w-[22.5rem]">
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </div>
      ) : null}

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
                <Link href="/studio">{t("empty.action")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="border-border bg-surface rounded-card hover:border-border-strong flex h-full min-w-0 flex-col overflow-hidden border transition-colors"
            >
              <Link
                href={studioHref({ designId: row.id })}
                className="bg-surface-subtle border-border block aspect-[4/3] border-b"
                tabIndex={-1}
                aria-hidden={Boolean(row.thumbnail || row.thumbnailFileId)}
              >
                <DesignThumb url={row.thumbnail} fileId={row.thumbnailFileId ?? null} empty={t("card.noThumbnail")} />
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <Link
                  href={studioHref({ designId: row.id })}
                  className="hover:text-primary focus-visible:ring-focus-ring line-clamp-2 rounded-sm font-semibold [overflow-wrap:break-word] break-keep outline-none focus-visible:ring-2"
                >
                  {row.name}
                </Link>
                {row.spec ? <p className="text-muted text-xs">{row.spec}</p> : null}
                {row.orderCode ? (
                  <p className="mt-1">
                    <Badge tone="info" size="sm">
                      {t("card.linked", { order: row.orderCode })}
                    </Badge>
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="text-muted text-xs">
                    {t("card.updated", { date: formatDateTime(row.updatedAt, locale) })}
                  </span>
                  <DropdownMenu
                    label={t("moreActions", { name: row.name })}
                    items={[
                      {
                        id: "duplicate",
                        label: tCommon("actions.duplicate"),
                        icon: "copy",
                        onSelect: () => void duplicate(row),
                      },
                      {
                        id: "delete",
                        label: tCommon("actions.delete"),
                        icon: "trash",
                        tone: "destructive",
                        separatorBefore: true,
                        onSelect: () => setPendingDelete(row),
                      },
                    ]}
                    trigger={
                      <IconButton name="more" size="sm" variant="ghost" label={t("moreActions", { name: row.name })} />
                    }
                  />
                </div>
              </div>
            </li>
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
