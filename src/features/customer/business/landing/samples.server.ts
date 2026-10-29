import "server-only";

import { getPriceTiers, listProducts } from "@/features/customer/catalog/api.server";
import { pick } from "@/features/customer/catalog/localize";

/** One priced quantity of a product's default spec, exactly as the pricing service answered it. */
export interface PricedStep {
  quantity: number;
  /** Total incl. VAT, shipping not included — the API's decimal string, never computed here. */
  amount: string;
  leadTimeDays: number | null;
}

export interface PricedProduct {
  slug: string;
  name: string;
  steps: PricedStep[];
}

/** How many real products the simulator and the catalogue demo show. */
const SAMPLE_PRODUCTS = 3;

/**
 * Real products for the approval simulator and the catalogue demo (business pack Phase 1 items 3–4): the first
 * instantly priced catalogue products, each with its default spec priced at the quantity presets through the one
 * store pricing path (`store.catalog.getPriceTiers`, GLOBAL-RULES §5). Only the quantities and prices are the API's;
 * nothing is estimated. Empty when the catalogue has none — the sections then say so.
 */
export async function pricedSamples(locale: string): Promise<PricedProduct[]> {
  const page = await listProducts({ perPage: 24 }).catch(() => null);
  const candidates = (page?.data ?? []).filter((card) => card.availability !== "rfq").slice(0, SAMPLE_PRODUCTS * 2);
  const priced = await Promise.all(
    candidates.map(async (card): Promise<PricedProduct | null> => {
      const tiers = await getPriceTiers(card.slug);
      const steps = (tiers?.tiers ?? [])
        .filter((step) => step.instant && step.grossAmount !== null)
        .map((step) => ({ quantity: step.quantity, amount: step.grossAmount!, leadTimeDays: step.leadTimeDays }));
      return steps.length > 0 ? { slug: card.slug, name: pick(locale, card.nameTh, card.nameEn), steps } : null;
    }),
  );
  return priced.filter((product): product is PricedProduct => product !== null).slice(0, SAMPLE_PRODUCTS);
}

export interface SampleOrder {
  key: string;
  name: string;
  quantity: number;
  amount: string;
  leadTimeDays: number | null;
}

/**
 * The simulator's sample orders: one quantity per product — the smallest, a middle and the largest preset in turn —
 * so the orders span the amounts a company meets.
 */
export function sampleOrders(products: PricedProduct[]): SampleOrder[] {
  return products.map((product, index) => {
    const at = index === 0 ? 0 : index === 1 ? Math.floor(product.steps.length / 2) : product.steps.length - 1;
    const step = product.steps[at]!;
    return {
      key: `${product.slug}:${step.quantity}`,
      name: product.name,
      quantity: step.quantity,
      amount: step.amount,
      leadTimeDays: step.leadTimeDays,
    };
  });
}
