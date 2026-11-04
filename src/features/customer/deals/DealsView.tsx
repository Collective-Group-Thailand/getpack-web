"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DealCard } from "@/features/shared/deals/DealCard";
import { useDealSaves } from "@/features/shared/deals/useDealSaves";
import type { Deal } from "@/features/shared/deals/types";
import { cn } from "@/ui/lib/cn";

import { forYouReasonText } from "./for-you";
import { dealHref } from "./paths";

/** The bundle sheet loads when a bundle is opened: the home strip and /deals do not carry it otherwise. */
const BundleSheet = dynamic(() => import("./BundleSheet").then((module) => module.BundleSheet), { ssr: false });

/** Loyalty P2: the "สำหรับคุณ" reason words and the bundle sheet, shared by the list and the featured ticket. */
function useP2(signedIn: boolean, typeNames: Record<string, string>) {
  const t = useTranslations("deals.forYou");
  const [bundleDeal, setBundleDeal] = useState<Deal | null>(null);
  const reasonOf = (deal: Deal) =>
    forYouReasonText(
      deal,
      {
        newCustomer: t("newCustomer"),
        tier: t("tier"),
        orderedType: (type) => t("orderedType", { type }),
        orderedAny: t("orderedAny"),
      },
      typeNames,
    );
  const sheet = bundleDeal ? (
    <BundleSheet deal={bundleDeal} signedIn={signedIn} onOpenChange={(open) => (open ? null : setBundleDeal(null))} />
  ) : null;
  return { reasonOf, openBundle: setBundleDeal, sheet };
}

/**
 * The deal list of `/deals` and the home strip (prototype `p15-deals.html`): vertical tickets in a grid from 768 px;
 * below that, compact rows in one hairline container. The order is the API's. The featured ticket, when there is
 * one, is drawn by `FeaturedDeal` and not repeated here.
 */
export function DealsView({
  deals,
  signedIn,
  now,
  typeNames,
  layout = "page",
  showReasons = false,
  className,
}: {
  deals: readonly Deal[];
  signedIn: boolean;
  now: number;
  typeNames: Record<string, string>;
  /** `strip`: the home page's three tickets, a grid at every width. */
  layout?: "page" | "strip";
  /** Loyalty P2: the "สำหรับคุณ" tab — each card says why it is there (when the API may say). */
  showReasons?: boolean;
  className?: string;
}) {
  const t = useTranslations("deals");
  const saves = useDealSaves();
  const p2 = useP2(signedIn, typeNames);
  const reasonOf = (deal: Deal) => (showReasons ? p2.reasonOf(deal) : null);
  const tag = (deal: Deal) => (deal.productTypeCodes[0] ? (typeNames[deal.productTypeCodes[0]] ?? null) : null);
  const card = (deal: Deal) => (
    <DealCard
      deal={deal}
      signedIn={signedIn}
      now={now}
      typeName={tag(deal)}
      stateOverride={saves.stateOf(deal)}
      saving={saves.pendingId === deal.id}
      onSave={(chosen) => void saves.save(chosen)}
      href={dealHref(deal)}
      reasonText={reasonOf(deal)}
      onAddBundle={p2.openBundle}
    />
  );

  if (layout === "strip")
    return (
      <>
        <ul className={cn("m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3", className)}>
          {deals.map((deal) => (
            <li key={deal.id} className="flex">
              {card(deal)}
            </li>
          ))}
        </ul>
        {p2.sheet}
      </>
    );

  return (
    <div className={className}>
      <ul aria-label={t("list")} className="m-0 hidden list-none grid-cols-2 gap-5 p-0 md:grid lg:grid-cols-3">
        {deals.map((deal) => (
          <li key={deal.id} className="flex">
            {card(deal)}
          </li>
        ))}
      </ul>
      <ul
        aria-label={t("list")}
        className="border-border bg-surface rounded-card divide-border m-0 list-none divide-y overflow-hidden border p-0 md:hidden"
      >
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard
              variant="compact"
              deal={deal}
              signedIn={signedIn}
              now={now}
              stateOverride={saves.stateOf(deal)}
              saving={saves.pendingId === deal.id}
              onSave={(chosen) => void saves.save(chosen)}
              href={dealHref(deal)}
              reasonText={reasonOf(deal)}
              onAddBundle={p2.openBundle}
            />
          </li>
        ))}
      </ul>
      {p2.sheet}
    </div>
  );
}

/** The page's lead ticket: horizontal from 768 px, standing up (stamp along the top) below. */
export function FeaturedDeal({
  deal,
  signedIn,
  now,
  typeName,
  headingLevel = "h2",
  typeNames = {},
}: {
  deal: Deal;
  signedIn: boolean;
  now: number;
  typeName: string | null;
  headingLevel?: "h1" | "h2" | "h3";
  /** Loyalty P2: for a bundle's sheet and the reason words. */
  typeNames?: Record<string, string>;
}) {
  const saves = useDealSaves();
  const p2 = useP2(signedIn, typeNames);
  const common = {
    deal,
    signedIn,
    now,
    typeName,
    showBadge: true,
    headingLevel,
    stateOverride: saves.stateOf(deal),
    saving: saves.pendingId === deal.id,
    onSave: (chosen: Deal) => void saves.save(chosen),
    href: dealHref(deal),
    onAddBundle: p2.openBundle,
  };
  return (
    <>
      <DealCard {...common} variant="featured" className="hidden md:block" />
      <DealCard {...common} variant="hero" className="md:hidden" />
      {p2.sheet}
    </>
  );
}
