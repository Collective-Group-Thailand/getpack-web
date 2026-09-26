"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { formatTaxId } from "@/features/customer/account/tax-id";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { toast } from "@/ui/components/Toast";

import { AddressForm, type Address } from "./AddressForm";
import { TaxProfileForm, type TaxProfile } from "./TaxProfileForm";

type Editing = { kind: "address"; item?: Address } | { kind: "tax"; item?: TaxProfile } | null;

/**
 * Saved addresses and tax-invoice profiles (F3 3.4, D-125): add, change, make the default,
 * remove. Orders keep their own snapshot, so removing one changes no order.
 */
export function AddressBook({ addresses, taxProfiles }: { addresses: Address[]; taxProfiles: TaxProfile[] }) {
  const t = useTranslations("account.book");
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
        await browserRequests().call("DELETE /v1/store/me/addresses/{addressId}", { path: { addressId: removing.id } });
      else
        await browserRequests().call("DELETE /v1/store/me/tax-profiles/{profileId}", {
          path: { profileId: removing.id },
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
          {editing?.kind !== "address" ? (
            <Button size="sm" iconStart="plus" onClick={() => setEditing({ kind: "address" })}>
              {t("addAddress")}
            </Button>
          ) : null}
        </div>
        {editing?.kind === "address" ? (
          <div className="border-border mt-4 rounded-xl border p-4">
            <AddressForm address={editing.item} onSaved={saved} onCancel={() => setEditing(null)} />
          </div>
        ) : null}
        {addresses.length === 0 && editing?.kind !== "address" ? (
          <EmptyState className="mt-4" icon="map-pin" title={t("noAddresses")} description={t("noAddressesBody")} />
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id} className="border-border flex flex-col gap-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {address.label}
                  {address.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
                </p>
                <p className="text-sm">
                  {address.recipientName} · {address.phone}
                </p>
                <p className="text-muted text-sm">
                  {[
                    address.line1,
                    address.line2,
                    address.subdistrict,
                    address.district,
                    address.province,
                    address.postcode,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
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
          {editing?.kind !== "tax" ? (
            <Button size="sm" iconStart="plus" onClick={() => setEditing({ kind: "tax" })}>
              {t("addTax")}
            </Button>
          ) : null}
        </div>
        {editing?.kind === "tax" ? (
          <div className="border-border mt-4 rounded-xl border p-4">
            <TaxProfileForm profile={editing.item} onSaved={saved} onCancel={() => setEditing(null)} />
          </div>
        ) : null}
        {taxProfiles.length === 0 && editing?.kind !== "tax" ? (
          <p className="text-muted mt-4 text-sm">{t("noTax")}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {taxProfiles.map((profile) => (
              <li key={profile.id} className="border-border flex flex-col gap-2 rounded-xl border p-4">
                <p className="flex items-center gap-2 font-semibold">
                  {profile.name}
                  {profile.isDefault ? <Badge tone="primary">{t("default")}</Badge> : null}
                </p>
                <p className="text-sm tabular-nums">{formatTaxId(profile.taxId)}</p>
                <p className="text-muted text-sm">
                  {profile.branchType === "head_office" ? t("headOffice") : t("branch", { code: profile.branchCode })}
                  {profile.withholdsTax ? ` · ${t("withholds")}` : ""}
                </p>
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
