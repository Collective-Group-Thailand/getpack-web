"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTaxId } from "@/features/customer/account/tax-id";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserApi } from "@/lib/api/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { addressLine, type Address, type TaxProfile } from "./address";
import { AddressForm } from "./AddressForm";
import { TaxProfileForm } from "./TaxProfileForm";

type Editing = { kind: "address"; item?: Address } | { kind: "tax"; item?: TaxProfile } | null;

/**
 * Saved addresses and tax-invoice profiles (F3 3.4, D-125): add, change, make the default,
 * remove. Orders keep their own snapshot, so removing one changes no order.
 */
export function AddressBook({ addresses, taxProfiles }: { addresses: Address[]; taxProfiles: TaxProfile[] }) {
  const t = useTranslations("account.book");
  const tAddress = useTranslations("account.addressForm");
  const tTax = useTranslations("account.taxForm");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<{ kind: "address" | "tax"; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const saved = () => {
    setEditing(null);
    router.refresh();
    toast.success(t("saved"));
  };

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      if (removing.kind === "address")
        await browserApi().DELETE("/v1/store/addresses/{addressId}", { params: { path: { addressId: removing.id } } });
      else
        await browserApi().DELETE("/v1/store/tax-profiles/{taxProfileId}", {
          params: { path: { taxProfileId: removing.id } },
        });
      setRemoving(null);
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  // Project B4: each kind of record a panel — its heading with how many and the add button, the records as cards
  // (the default one outlined in green, with an icon plate) and a dashed tile to add one at the end of the grid.
  const card = (props: {
    id: string;
    icon: "map-pin" | "receipt";
    title: string;
    isDefault: boolean;
    lines: React.ReactNode;
    onEdit: () => void;
    onRemove: () => void;
  }) => (
    <li
      key={props.id}
      className={cn(
        "bg-surface rounded-card flex min-w-0 flex-col gap-3 border p-4",
        props.isDefault ? "border-primary" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            props.isDefault ? "bg-primary-subtle text-primary-subtle-fg" : "bg-surface-subtle text-muted",
          )}
        >
          <Icon name={props.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="min-w-0 [overflow-wrap:break-word] break-keep">{props.title}</span>
            {props.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-sm">{props.lines}</div>
        </div>
      </div>
      <div className="border-border mt-auto flex gap-2 border-t pt-3">
        <Button size="sm" variant="secondary" iconStart="edit" onClick={props.onEdit}>
          {t("edit")}
          <span className="sr-only"> {props.title}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onRemove}>
          {t("remove")}
          <span className="sr-only"> {props.title}</span>
        </Button>
      </div>
    </li>
  );
  const addTile = (label: string, onClick: () => void) => (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="border-border-strong text-muted hover:border-primary hover:text-primary focus-visible:ring-focus-ring rounded-card flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 border border-dashed p-4 text-sm font-medium outline-none focus-visible:ring-2"
      >
        <Icon name="plus" size={20} aria-hidden="true" />
        {label}
      </button>
    </li>
  );
  const head = (id: string, title: string, count: number, label: string, onAdd: () => void) => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className="text-muted text-sm font-medium tabular-nums">{count}</span>
      </h2>
      {/* Empty, the empty state's own button is the way to add — not a second one here. */}
      {count > 0 ? (
        <Button size="sm" variant="secondary" iconStart="plus" onClick={onAdd}>
          {label}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="book-addresses" className="border-border bg-surface rounded-card border p-4 sm:p-5">
        {head("book-addresses", t("addresses"), addresses.length, t("addAddress"), () =>
          setEditing({ kind: "address" }),
        )}
        {addresses.length === 0 ? (
          <EmptyState
            icon="map-pin"
            title={t("noAddresses")}
            description={t("noAddressesBody")}
            action={
              <Button iconStart="plus" onClick={() => setEditing({ kind: "address" })}>
                {t("addAddress")}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {addresses.map((address) =>
              card({
                id: address.id,
                icon: "map-pin",
                title: address.label,
                isDefault: address.isDefault,
                lines: (
                  <>
                    <span>
                      {address.recipientName} · <span className="tabular-nums">{address.phone}</span>
                    </span>
                    <span className="text-muted">{addressLine(locale, address)}</span>
                  </>
                ),
                onEdit: () => setEditing({ kind: "address", item: address }),
                onRemove: () => setRemoving({ kind: "address", id: address.id, name: address.label }),
              }),
            )}
            {addTile(t("addAddress"), () => setEditing({ kind: "address" }))}
          </ul>
        )}
      </section>

      <section aria-labelledby="book-tax" className="border-border bg-surface rounded-card border p-4 sm:p-5">
        {head("book-tax", t("taxProfiles"), taxProfiles.length, t("addTax"), () => setEditing({ kind: "tax" }))}
        {taxProfiles.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={t("noTax")}
            action={
              <Button iconStart="plus" onClick={() => setEditing({ kind: "tax" })}>
                {t("addTax")}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {taxProfiles.map((profile) =>
              card({
                id: profile.id,
                icon: "receipt",
                title: profile.name,
                isDefault: profile.isDefault,
                lines: (
                  <>
                    <span className="tabular-nums">{formatTaxId(profile.taxId)}</span>
                    <span className="text-muted">
                      {profile.branchType === "head_office"
                        ? t("headOffice")
                        : t("branch", { code: profile.branchCode })}
                      {profile.withholdsTax ? ` · ${t("withholds")}` : ""}
                    </span>
                    <span className="text-muted">{addressLine(locale, profile)}</span>
                  </>
                ),
                onEdit: () => setEditing({ kind: "tax", item: profile }),
                onRemove: () => setRemoving({ kind: "tax", id: profile.id, name: profile.name }),
              }),
            )}
            {addTile(t("addTax"), () => setEditing({ kind: "tax" }))}
          </ul>
        )}
      </section>

      {/*
       * Add and edit happen in a side sheet that says which record it is, over the list that stays
       * where it was — an inline form that replaced the card had no title and the list jumped
       * (owner feedback 2026-10-14). Closing the sheet is the cancel.
       */}
      <Sheet
        open={editing?.kind === "address"}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing?.kind === "address" && editing.item
            ? tAddress("editTitle", { label: editing.item.label })
            : tAddress("newTitle")
        }
        description={editing?.kind === "address" && editing.item ? tAddress("editHint") : undefined}
        closeLabel={tAddress("cancel")}
        className="[&_[data-form-actions]]:border-border [&_[data-form-actions]]:bg-surface-raised w-[min(36rem,calc(100vw-2rem))] [&_[data-form-actions]]:sticky [&_[data-form-actions]]:bottom-0 [&_[data-form-actions]]:-mx-4 [&_[data-form-actions]]:-mb-4 [&_[data-form-actions]]:border-t [&_[data-form-actions]]:px-4 [&_[data-form-actions]]:py-3"
      >
        {editing?.kind === "address" ? (
          <AddressForm address={editing.item} onSaved={saved} onCancel={() => setEditing(null)} />
        ) : null}
      </Sheet>
      <Sheet
        open={editing?.kind === "tax"}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing?.kind === "tax" && editing.item ? tTax("editTitle", { name: editing.item.name }) : tTax("newTitle")
        }
        closeLabel={tTax("cancel")}
        className="[&_[data-form-actions]]:border-border [&_[data-form-actions]]:bg-surface-raised w-[min(36rem,calc(100vw-2rem))] [&_[data-form-actions]]:sticky [&_[data-form-actions]]:bottom-0 [&_[data-form-actions]]:-mx-4 [&_[data-form-actions]]:-mb-4 [&_[data-form-actions]]:border-t [&_[data-form-actions]]:px-4 [&_[data-form-actions]]:py-3"
      >
        {editing?.kind === "tax" ? (
          <TaxProfileForm profile={editing.item} onSaved={saved} onCancel={() => setEditing(null)} />
        ) : null}
      </Sheet>

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={removing ? t("removeBody", { name: removing.name }) : ""}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        tone="destructive"
        loading={busy}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
