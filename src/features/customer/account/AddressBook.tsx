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

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="book-addresses">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="book-addresses" className="text-lg font-semibold">
            {t("addresses")}
          </h2>
          <Button size="sm" iconStart="plus" onClick={() => setEditing({ kind: "address" })}>
            {t("addAddress")}
          </Button>
        </div>
        {addresses.length === 0 ? (
          <EmptyState className="mt-4" icon="map-pin" title={t("noAddresses")} description={t("noAddressesBody")} />
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id} className="bg-surface border-border flex flex-col gap-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {address.label}
                  {address.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
                </p>
                <p className="text-sm">
                  {address.recipientName} · {address.phone}
                </p>
                <p className="text-muted text-sm">{addressLine(locale, address)}</p>
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "address", item: address })}>
                    {t("edit")}
                    <span className="sr-only"> {address.label}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoving({ kind: "address", id: address.id, name: address.label })}
                  >
                    {t("remove")}
                    <span className="sr-only"> {address.label}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="book-tax">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="book-tax" className="text-lg font-semibold">
            {t("taxProfiles")}
          </h2>
          <Button size="sm" iconStart="plus" onClick={() => setEditing({ kind: "tax" })}>
            {t("addTax")}
          </Button>
        </div>
        {taxProfiles.length === 0 ? (
          <p className="text-muted mt-4 text-sm">{t("noTax")}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {taxProfiles.map((profile) => (
              <li key={profile.id} className="bg-surface border-border flex flex-col gap-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {profile.name}
                  {profile.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
                </p>
                <p className="text-sm tabular-nums">{formatTaxId(profile.taxId)}</p>
                <p className="text-muted text-sm">
                  {profile.branchType === "head_office" ? t("headOffice") : t("branch", { code: profile.branchCode })}
                  {profile.withholdsTax ? ` · ${t("withholds")}` : ""}
                </p>
                <p className="text-muted text-sm">{addressLine(locale, profile)}</p>
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "tax", item: profile })}>
                    {t("edit")}
                    <span className="sr-only"> {profile.name}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoving({ kind: "tax", id: profile.id, name: profile.name })}
                  >
                    {t("remove")}
                    <span className="sr-only"> {profile.name}</span>
                  </Button>
                </div>
              </li>
            ))}
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
