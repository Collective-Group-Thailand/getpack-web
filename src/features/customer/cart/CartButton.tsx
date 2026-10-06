"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import { IconButton } from "@/ui/components/IconButton";
import { cn } from "@/ui/lib/cn";

import { onCartAdd } from "./cart-events";
import { useGuestCart } from "./guest-cart";

/**
 * The header's cart with its count (round 2, B7): a signed-in customer's lines from the cart read
 * (`store.cart.get`, the key every add invalidates), a guest's from this browser.
 *
 * CONTRACT-REQUEST store.cart-count — the whole cart is read for a number; a count endpoint would
 * be lighter. Read once per page and again after an add, never polled.
 */
export function CartButton({ signedIn, label }: { signedIn: boolean; label: string }) {
  const guest = useGuestCart();
  const cart = useQuery({
    // Its own key under the cart's: an invalidation of the cart refreshes the count too, but the
    // cart page's own read (seeded from the server) is never answered from this older copy.
    queryKey: [...queryKeys.resource("customer", "cart"), "count"],
    queryFn: async () => ({ lines: (await browserApi().GET("/v1/store/cart")).data!.items.length }),
    enabled: signedIn,
    staleTime: 60_000,
    retry: false,
  });
  const count = signedIn ? (cart.data?.lines ?? 0) : guest.length;
  const [bump, setBump] = useState(false);
  useEffect(
    () =>
      onCartAdd(() => {
        setBump(true);
        void cart.refetch();
        setTimeout(() => setBump(false), 700);
      }),
    // `cart.refetch` is stable for the query's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <span className="relative inline-flex">
      <IconButton asChild name="cart" variant="ghost" size="sm" label={count ? `${label} (${count})` : label}>
        <Link href="/cart" />
      </IconButton>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary text-primary-fg pointer-events-none absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums",
            bump && "motion-safe:animate-bounce",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </span>
  );
}
