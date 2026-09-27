"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { nanoid } from "nanoid";

import { getStyle } from "@packio/dieline";
import { getPaper } from "@/features/designer/catalog";
import { insideSize } from "@/features/designer/document";
import { designRepo } from "@/features/designer/storage";
import type { SavedDesign } from "@/features/designer/types";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/i18n/format";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

export default function MyDesigns() {
  const t = useTranslations("designs");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";

  // Reading localStorage during render would break SSR, so the list starts unknown and the
  // first effect fills it. `null` renders nothing rather than a wrong empty state.
  const [items, setItems] = useState<SavedDesign[] | null>(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedDesign | null>(null);

  const refresh = useCallback(() => setItems(designRepo.list()), []);

  useEffect(() => {
    /*
     * Reading localStorage on mount is a one-off pull from an external store — the case this
     * rule cannot express. Doing it during render would break SSR, and designs move to the
     * API in F4 Part B, which removes the effect entirely.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const filtered = (items ?? []).filter((design) => design.name.toLowerCase().includes(query.toLowerCase()));

  const duplicate = (design: SavedDesign) => {
    if (!designRepo.duplicate(design.id, nanoid(10))) {
      toast.error(t("duplicateFailed"));
      return;
    }
    refresh();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    designRepo.remove(pendingDelete.id);
    setPendingDelete(null);
    refresh();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted text-sm">{t("subtitle")}</p>
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
            <Link href="/design/new">{t("new")}</Link>
          </Button>
        </div>
      </div>

      {items === null ? null : filtered.length === 0 ? (
        <EmptyState
          icon="box"
          title={items.length ? t("noResults.title") : t("empty.title")}
          description={items.length ? t("noResults.body") : t("empty.body")}
          action={
            items.length ? null : (
              <Button asChild>
                <Link href="/design/new">{t("empty.action")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((design) => (
            <Card as="li" key={design.id} padding="none" className="overflow-hidden transition hover:shadow-lg">
              <Link
                href={`/design/${design.id}`}
                className="bg-surface-subtle block aspect-[4/3] p-4"
                tabIndex={-1}
                aria-hidden={Boolean(design.thumbnail)}
              >
                {design.thumbnail ? (
                  // The thumbnail is a data URL generated from the canvas, so next/image
                  // cannot optimise it and the name below is the accessible label.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={design.thumbnail} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-subtle flex h-full items-center justify-center text-sm">
                    {t("card.noThumbnail")}
                  </span>
                )}
              </Link>
              <div className="p-4">
                <Link href={`/design/${design.id}`} className="hover:text-primary font-medium">
                  {design.name}
                </Link>
                <p className="text-muted mt-1 text-xs">
                  {t("card.spec", {
                    style: getStyle(design.spec.styleId).name[locale],
                    ...insideSize(design.spec),
                    paper: getPaper(design.spec.materialId)?.name ?? `${design.spec.material.caliperMm}`,
                  })}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-subtle text-xs">
                    {t("card.updated", { date: formatDateTime(design.updatedAt, locale) })}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => duplicate(design)}>
                      {tCommon("actions.duplicate")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPendingDelete(design)}>
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
        onConfirm={confirmDelete}
      />
    </div>
  );
}
