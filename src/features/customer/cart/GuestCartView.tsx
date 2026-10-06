"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { IconTile } from "@/ui/components/Decor";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconButton } from "@/ui/components/IconButton";
import { Icon } from "@/ui/icons";

import { removeGuestLine, useGuestCart } from "./guest-cart";

/**
 * The cart for someone not signed in (UX audit Flow 1, bug #3): what they kept in this browser,
 * removable and editable, and a checkout button that asks them to sign in — the only step that
 * needs an account. Prices are the ones the API showed when each line was added; signing in turns
 * each line into a quotation at today's price, which the signed-in cart then shows.
 */
export function GuestCartView({ signInHref }: { signInHref: string }) {
  const t = useTranslations("cart");
  const format = useFormat();
  const lines = useGuestCart();

  if (lines.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon="cart"
        title={t("emptyTitle")}
        description={t("guest.emptyBody")}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/products">{t("browse")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={signInHref}>{t("guest.signInForSaved")}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <ul className="flex flex-col gap-4" aria-label={t("itemsLabel")}>
        {lines.map((line) => (
          <li key={line.id} className="border-border bg-surface rounded-card border p-5">
            <article aria-labelledby={`guest-line-${line.id}`} className="flex items-start gap-4">
              <IconTile name="box" tone="kraft" size="lg" />
              <div className="min-w-0 flex-1">
                <h2 id={`guest-line-${line.id}`} className="text-base font-semibold">
                  <Link href={`/configure/${line.slug}`} className="hover:text-primary">
                    {line.productName}
                  </Link>
                </h2>
                <ul className="text-muted mt-1 flex flex-col gap-0.5 text-sm">
                  {line.specs.slice(0, 3).map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  {t("guest.quantity", { quantity: format.number(line.quantity), unit: line.unit })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {line.grossAmount ? (
                  <p className="text-lg font-semibold tabular-nums">{format.thb(line.grossAmount)}</p>
                ) : null}
                <div className="flex items-center gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/configure/${line.slug}`}>{t("guest.edit")}</Link>
                  </Button>
                  <IconButton
                    name="trash"
                    variant="ghost"
                    size="sm"
                    label={t("remove")}
                    onClick={() => removeGuestLine(line.id)}
                  />
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <aside className="border-border bg-surface rounded-card flex flex-col gap-4 border p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">{t("summary")}</h2>
        <p className="text-muted text-sm">{t("itemsCount", { count: lines.length })}</p>
        <p className="text-muted text-sm">{t("guest.priceNote")}</p>
        <Button asChild size="lg" block>
          <Link href={signInHref}>{t("checkout")}</Link>
        </Button>
        <p className="text-muted flex items-start gap-2 text-xs">
          <Icon name="lock" size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t("guest.signInAtCheckout")}
        </p>
      </aside>
    </div>
  );
}
