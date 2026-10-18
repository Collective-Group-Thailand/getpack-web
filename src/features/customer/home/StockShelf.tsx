"use client";

import dynamic from "next/dynamic";
import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { stockRfqHref } from "@/features/customer/catalog/paths";
import { stockQuoteBody, useAddStockToCart } from "@/features/customer/catalog/stock-cart";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/ui/components/Button";
import { ProductCard } from "@/ui/components/ProductCard";
import { cn } from "@/ui/lib/cn";

const SignInSheet = dynamic(() => import("@/features/customer/auth/SignInSheet").then((m) => m.SignInSheet), {
  ssr: false,
});

/** One stock product as the shelf shows it — words and numbers prepared on the server. */
export interface ShelfItem {
  id: string;
  sku: string;
  href: string;
  name: string;
  /** Its stock type ("ซองไปรษณีย์"), the chip it files under. */
  type: string;
  image: string | null;
  /** The unit's word ("ซอง"), for the price line. */
  unit: string;
  /** "ขั้นต่ำ 500 ซอง" */
  minimum: string;
  minOrderQty: number;
  /** "ใส่ตะกร้า 500 ซอง" */
  addLabel: string;
}

/**
 * The home page's ready-to-ship shelf (product owner, 2026-10-17: "เอารายการสินค้าสต็อกไปอยู่ใน
 * หน้าหลัก เพื่อให้ลูกค้ากดสั่งได้ง่ายๆ"): chips by stock type, and on every card a one-tap
 * "ใส่ตะกร้า" at the product's minimum — a stock item has nothing to configure, so the shelf is
 * the whole ordering step. A guest signs in first (a cart line is a saved quotation, D-051) and
 * the item goes in right after. The quantity is changed in the cart or on the product's page.
 */
export function StockShelf({
  items,
  types,
  signedIn,
  instant,
}: {
  /**
   * Whether stock prices instantly (`standard_product` quote mode). Quote-only (A-16: the type's
   * pricing validation is not signed yet), a card asks for a price instead of offering a cart.
   */
  instant: boolean;
  items: ShelfItem[];
  /** The types in shelf order, each with how many items it has here. */
  types: { name: string; count: number }[];
  signedIn: boolean;
}) {
  const t = useTranslations("home.stock");
  const router = useRouter();
  const addToCart = useAddStockToCart();
  const [type, setType] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ShelfItem | null>(null);
  const format = useFormat();
  // Two full rows: eight at four columns, ten at five, twelve at six (the extra ones only from `lg` / `xl`).
  const shown = (type ? items.filter((item) => item.type === type) : items).slice(0, 12);
  // What each card on show costs at its minimum — the API's price, as on the product's page.
  const prices = useQueries({
    queries: shown.map((item) => ({
      queryKey: ["customer", "stock-price", item.id, item.minOrderQty],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        (
          await browserApi().POST("/v1/store/quotes/actions/calculate", {
            body: stockQuoteBody(item.id, item.minOrderQty),
            signal,
          })
        ).data!.steps[0] ?? null,
      staleTime: 5 * 60_000,
      enabled: instant,
    })),
  });

  async function add(item: ShelfItem) {
    setBusy(item.id);
    try {
      const ok = await addToCart({ stockProductId: item.id, quantity: item.minOrderQty, name: item.name, route: "/" });
      if (ok) setAdded((current) => new Set(current).add(item.id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div
        role="group"
        aria-label={t("filter")}
        className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {[
          { name: null, label: t("allTypes"), count: items.length },
          ...types.map((x) => ({ name: x.name, label: x.name, count: x.count })),
        ].map((chip) => {
          const current = type === chip.name;
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={current}
              onClick={() => setType(chip.name)}
              className={cn(
                "rounded-control border-border inline-flex min-h-10 shrink-0 items-center gap-1.5 border px-3.5 text-sm whitespace-nowrap",
                current ? "bg-primary text-fg-inverse border-primary" : "bg-surface hover:border-primary",
              )}
            >
              {chip.label}
              <span className={cn("tabular-nums", current ? "opacity-80" : "text-muted")}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      {/* A phone swipes one row; wider screens see the shelf as a grid. */}
      <ul
        aria-live="polite"
        className="-mx-5 grid snap-x snap-mandatory auto-cols-[46%] grid-flow-col gap-3 overflow-x-auto px-5 pb-2 sm:auto-cols-[31%] md:mx-0 md:grid-flow-row md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5 xl:grid-cols-6"
      >
        {shown.map((item, index) => {
          const inCart = added.has(item.id);
          const step = prices[index]?.data;
          return (
            <ProductCard
              key={item.id}
              as="li"
              className={cn("snap-start", index >= 8 && (index >= 10 ? "md:hidden xl:flex" : "md:hidden lg:flex"))}
              aspect="square"
              title={<Link href={item.href}>{item.name}</Link>}
              topLine={item.type}
              image={item.image ? { src: item.image, alt: item.name } : null}
              fallback={{ family: "stock", tone: "paper" }}
              price={
                step?.grossAmount ? (
                  <span className="flex flex-col">
                    {step.unitPrice ? (
                      <span className="tabular-nums">
                        {t("price", { price: format.thb(step.unitPrice), unit: item.unit })}
                      </span>
                    ) : null}
                    <span className="text-muted text-xs font-normal">
                      {t("total", { total: format.thb(step.grossAmount), minimum: item.minimum })}
                    </span>
                  </span>
                ) : instant && prices[index]?.isPending ? (
                  <span className="bg-bg-subtle block h-5 w-28 animate-pulse rounded" aria-hidden="true" />
                ) : undefined
              }
              meta={step?.grossAmount ? undefined : item.minimum}
              actions={
                !instant ? (
                  <Button asChild size="sm" variant="secondary" iconStart="chat" className="w-full">
                    <Link href={stockRfqHref(item.sku)}>
                      {t("askPrice")}
                      <span className="sr-only"> — {item.name}</span>
                    </Link>
                  </Button>
                ) : inCart ? (
                  <Button asChild size="sm" variant="secondary" iconStart="check" className="w-full">
                    <Link href="/cart">{t("inCart")}</Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    iconStart="cart"
                    className="w-full"
                    loading={busy === item.id}
                    disabled={busy !== null && busy !== item.id}
                    onClick={() => (signedIn ? void add(item) : setPending(item))}
                  >
                    {item.addLabel}
                    <span className="sr-only"> — {item.name}</span>
                  </Button>
                )
              }
            />
          );
        })}
      </ul>

      {pending ? (
        <SignInSheet
          open
          onOpenChange={(open) => !open && setPending(null)}
          onSignedIn={() => {
            const item = pending;
            setPending(null);
            void add(item).then(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
