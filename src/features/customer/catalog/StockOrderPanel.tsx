"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useJustAdded } from "@/features/customer/cart/cart-events";
import { useDebounced } from "@/features/customer/configurator/pricing";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { NumberInput } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";

import { stockQuoteBody, useAddStockToCart } from "./stock-cart";

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((m) => m.SignInSheet), {
  ssr: false,
});

/**
 * Ordering a stock product (round 2, B5): it has nothing to configure, so "สั่งซื้อสินค้านี้" no
 * longer leads to a configurator that does not exist for it (a 404). The quantity — at least the
 * product's minimum — is priced by the API (`store.quotes.calculate`, `standard_product` with its
 * `stockProductId`), and "เพิ่มลงตะกร้า" keeps that price as a quotation and adds it
 * (`store.quotes.save` → `store.cart.addItem`, no design). A guest signs in first: the cart line is
 * a customer's saved quotation (D-051).
 */
export function StockOrderPanel({
  stockProductId,
  sku,
  name,
  unit,
  minOrderQty,
  signedIn,
}: {
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  minOrderQty: number;
  signedIn: boolean;
}) {
  const t = useTranslations("catalog.stock");
  const format = useFormat();
  const router = useRouter();
  const justAdded = useJustAdded();
  const [quantity, setQuantity] = useState(String(minOrderQty));
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const qty = Number(quantity);
  const valid = Number.isInteger(qty) && qty >= minOrderQty;
  const settled = useDebounced(valid ? qty : null, 400);
  const body = (q: number) => stockQuoteBody(stockProductId, q);
  const addToCart = useAddStockToCart();

  const price = useQuery({
    queryKey: ["customer", "stock-price", stockProductId, settled],
    queryFn: async ({ signal }) =>
      (await browserApi().POST("/v1/store/quotes/actions/calculate", { body: body(settled!), signal })).data!
        .steps[0] ?? null,
    enabled: settled !== null,
    staleTime: 60_000,
  });
  const step = price.data;

  async function add() {
    if (!valid) return;
    if (!signedIn) return setSignIn(true);
    setBusy(true);
    try {
      await addToCart({ stockProductId, quantity: qty, name, route: "/products/[key]" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t("quantity")}
        error={quantity && !valid ? t("belowMinimum", { quantity: format.number(minOrderQty), unit }) : undefined}
      >
        <NumberInput
          inputSize="lg"
          inputMode="numeric"
          min={minOrderQty}
          step={1}
          unit={unit}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </Field>
      <div aria-live="polite" className="min-h-14">
        {!valid ? null : price.isFetching && !step ? (
          <Skeleton className="h-12 w-48" />
        ) : step?.grossAmount ? (
          <p className="flex flex-col">
            <span className="serif text-3xl tabular-nums">{format.thb(step.grossAmount)}</span>
            <span className="text-muted text-sm">
              {t("totalFor", { quantity: format.number(step.quantity), unit })}
              {step.leadTimeDays ? ` · ${t("leadTime", { days: step.leadTimeDays })}` : ""}
            </span>
          </p>
        ) : step ? (
          <p className="text-muted text-sm">{t("noPrice")}</p>
        ) : price.isError ? (
          <p className="text-muted text-sm">{t("priceFailed")}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {justAdded ? (
          <Button asChild size="lg" variant="secondary" iconStart="check">
            <Link href="/cart">{t("goToCart")}</Link>
          </Button>
        ) : (
          <Button
            size="lg"
            iconStart="cart"
            loading={busy}
            disabled={!valid || (signedIn && !step?.grossAmount)}
            onClick={() => void add()}
          >
            {t("addToCart")}
            <span className="sr-only"> {sku}</span>
          </Button>
        )}
      </div>
      {signIn ? (
        <SignInSheet
          open={signIn}
          onOpenChange={setSignIn}
          onSignedIn={() => {
            setSignIn(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
