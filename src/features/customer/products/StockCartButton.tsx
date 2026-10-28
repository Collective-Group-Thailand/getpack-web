"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAddStockToCart } from "@/features/customer/catalog/stock-cart";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";

import { useQuoteTrayMode } from "./quote-tray";

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((m) => m.SignInSheet), {
  ssr: false,
});

/**
 * "ใส่ตะกร้า N ชิ้น" on a stock card or row (owner decision D-447 / DECISIONS-STAGE-A §10.2): a stock item can go
 * straight in the cart at its minimum order, as on the home shelf — priced by the API (`standard_product` quote), a
 * guest signs in first (a cart line is a saved quotation, D-051). Drawn only for an item on hand with an instant price
 * (`stockCartable`); the quote tray stays next to it.
 */
export function StockCartButton({
  stockProductId,
  quantity,
  name,
  label,
  size = "sm",
}: {
  stockProductId: string;
  quantity: number;
  name: string;
  /** "ใส่ตะกร้า 500 ชิ้น" */
  label: string;
  size?: "sm" | "md";
}) {
  const t = useTranslations("products.card");
  const { signedIn } = useQuoteTrayMode();
  const router = useRouter();
  const addToCart = useAddStockToCart();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [signIn, setSignIn] = useState(false);

  async function add() {
    setBusy(true);
    try {
      if (await addToCart({ stockProductId, quantity, name, route: "/products" })) setAdded(true);
    } finally {
      setBusy(false);
    }
  }

  if (added)
    return (
      <Button asChild size={size} variant="secondary" iconStart="check">
        <Link href="/cart">{t("inCart")}</Link>
      </Button>
    );
  return (
    <>
      <Button
        type="button"
        size={size}
        iconStart="cart"
        loading={busy}
        onClick={() => (signedIn ? void add() : setSignIn(true))}
      >
        {label}
        <span className="sr-only"> — {name}</span>
      </Button>
      {signIn ? (
        <SignInSheet
          open
          onOpenChange={(open) => !open && setSignIn(false)}
          onSignedIn={() => {
            setSignIn(false);
            void add().then(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
