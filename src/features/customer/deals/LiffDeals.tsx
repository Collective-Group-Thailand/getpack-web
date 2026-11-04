"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CopyCodeButton, DealCard, useDealStub } from "@/features/shared/deals/DealCard";
import { dealState, featuredDeal } from "@/features/shared/deals/model";
import { useDealSaves } from "@/features/shared/deals/useDealSaves";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import type { Deal } from "@/features/shared/deals/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet, SheetClose } from "@/ui/components/Sheet";
import { Ticket } from "@/ui/components/Ticket";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

import { BundleSheet } from "./BundleSheet";
import { forYouReasonText } from "./for-you";

/**
 * `/liff/deals` (loyalty P1.5, STITCH-NOTES R2-f; prototype `p15-liff-deals.html`): the segmented "ดีลทั้งหมด |
 * คูปองของฉัน (n)", the featured ticket, compact rows, and a deal opened in a bottom sheet drawn as a ticket — a
 * solid stub band, notches cut into the sheet's edges (they show the scrim), the conditions, the code, the solid
 * "เก็บโค้ด" and "ส่งดีลนี้ให้ทีม". A sticky bar above the LIFF tabs: "แชร์ให้เพื่อน | เปิดกระเป๋าคูปอง". No LINE
 * chrome of its own (LINE draws it).
 */
export function LiffDeals({
  deals,
  dealsUrl,
  now,
  typeNames = {},
}: {
  deals: readonly Deal[];
  dealsUrl: string;
  now: number;
  /** Loyalty P2: product-type names for the "สำหรับคุณ" reasons. */
  typeNames?: Record<string, string>;
}) {
  const t = useTranslations("deals.liff");
  const tForYou = useTranslations("deals.forYou");
  const saves = useDealSaves();
  const [view, setView] = useState<"all" | "for_you" | "mine">("all");
  const [open, setOpen] = useState<Deal | null>(null);
  const [bundleDeal, setBundleDeal] = useState<Deal | null>(null);
  const isMine = (deal: Deal) => deal.myStatus === "saved" || saves.stateOf(deal) === "saved";
  const mine = deals.filter(isMine);
  // Loyalty P2: "สำหรับคุณ" is the deals the API marks `forYou` (the list is already the caller's).
  const forYou = deals.filter((deal) => deal.forYou);
  const featured = view === "all" ? featuredDeal(deals) : null;
  const shown = (view === "all" ? deals : view === "for_you" ? forYou : mine).filter(
    (deal) => deal.id !== featured?.id,
  );
  const reasonOf = (deal: Deal) =>
    view === "for_you"
      ? forYouReasonText(
          deal,
          {
            newCustomer: tForYou("newCustomer"),
            tier: tForYou("tier"),
            orderedType: (type) => tForYou("orderedType", { type }),
            orderedAny: tForYou("orderedAny"),
          },
          typeNames,
        )
      : null;

  return (
    <div className="flex flex-col gap-3.5 pb-16">
      <SegmentedControl
        label={t("segments")}
        value={view}
        onValueChange={setView}
        className="grid w-full grid-cols-3"
        options={[
          { value: "all", label: t("all") },
          { value: "for_you", label: t("forYou") },
          { value: "mine", label: t("mine", { count: mine.length }) },
        ]}
      />
      {featured ? (
        <DealCard
          variant="hero"
          deal={featured}
          signedIn
          now={now}
          showBadge
          headingLevel="h2"
          stateOverride={saves.stateOf(featured)}
          saving={saves.pendingId === featured.id}
          onSave={(deal) => void saves.save(deal)}
          signInHref="/liff/deals"
          onAddBundle={setBundleDeal}
        />
      ) : null}
      {shown.length > 0 ? (
        <ul className="border-border bg-surface rounded-card divide-border m-0 list-none divide-y overflow-hidden border p-0">
          {shown.map((deal) => (
            <li key={deal.id}>
              <DealCard
                variant="compact"
                deal={deal}
                signedIn
                now={now}
                headingLevel="h2"
                stateOverride={saves.stateOf(deal)}
                saving={saves.pendingId === deal.id}
                onSave={(chosen) => void saves.save(chosen)}
                onOpen={setOpen}
                reasonText={reasonOf(deal)}
                onAddBundle={setBundleDeal}
              />
            </li>
          ))}
        </ul>
      ) : view === "mine" ? (
        <EmptyState icon="ticket" title={t("emptyMine")} description={t("emptyMineBody")} />
      ) : view === "for_you" ? (
        <EmptyState icon="ticket" title={tForYou("emptyTitle")} description={tForYou("emptyBody")} />
      ) : null}
      <BundleSheet deal={bundleDeal} signedIn onOpenChange={(next) => (next ? null : setBundleDeal(null))} />

      <div className="border-border bg-surface fixed inset-x-0 bottom-[calc(var(--mobile-tab-h)+env(safe-area-inset-bottom))] z-30 border-t">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 px-4 py-2.5">
          <Button
            variant="secondary"
            iconStart="link"
            className="h-11"
            onClick={() => void share(dealsUrl, t("shareTitle"), t("linkCopied"))}
          >
            {t("share")}
          </Button>
          <Button asChild variant="secondary" iconStart="wallet" className="h-11">
            <Link href="/account/wallet">{t("wallet")}</Link>
          </Button>
        </div>
      </div>

      {open ? (
        <DealSheet
          deal={open}
          onClose={() => setOpen(null)}
          saving={saves.pendingId === open.id}
          saved={saves.stateOf(open) === "saved"}
          onSave={(deal) => void saves.save(deal)}
        />
      ) : null}
    </div>
  );
}

async function share(url: string, title: string, copied: string) {
  if (typeof navigator.share === "function") {
    await navigator.share({ title, url }).catch(() => undefined);
    return;
  }
  await navigator.clipboard?.writeText(url).catch(() => undefined);
  toast.success(copied);
}

/** One deal, torn off into a bottom sheet: the sheet *is* the ticket. */
function DealSheet({
  deal,
  onClose,
  saving,
  saved,
  onSave,
}: {
  deal: Deal;
  onClose: () => void;
  saving: boolean;
  saved: boolean;
  onSave: (deal: Deal) => void;
}) {
  const t = useTranslations("deals");
  const format = useFormat();
  const stub = useDealStub(deal.benefit);
  const state = saved ? "saved" : dealState(deal, true);
  const until = deal.endsAt ? format.date(deal.endsAt) : t("card.noEnd");
  return (
    <Sheet
      appearance="bare"
      side="bottom"
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={deal.headline}
      description={deal.benefit.summary}
      closeLabel={t("liff.close")}
    >
      <div className="mx-auto max-w-xl pt-6">
        <span aria-hidden="true" className="bg-primary-fg/70 mx-auto -mt-3.5 mb-2.5 block h-1 w-10 rounded-sm" />
        <Ticket
          shape="sheet"
          tone="featured"
          stubSize={132}
          notchRadius={10}
          stubClassName="flex flex-col items-center justify-center gap-1.5 leading-none"
          bodyClassName="gap-3 px-4.5 pt-4.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          stub={
            <>
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label={t("liff.close")}
                  className="text-primary-fg focus-visible:ring-primary-fg hover:bg-primary-fg/10 absolute end-2 top-2 grid size-11 place-items-center rounded-lg outline-none focus-visible:ring-2"
                >
                  <Icon name="close" size={20} aria-hidden="true" />
                </button>
              </SheetClose>
              <span className="flex items-baseline gap-2">
                {stub.word ? <span className="text-base font-medium">{stub.word}</span> : null}
                <span
                  className={
                    stub.value.figure.kind === "word"
                      ? "text-[2.5rem] font-bold"
                      : "text-[3.5rem] font-bold tracking-[-0.045em] tabular-nums"
                  }
                >
                  {stub.figureText}
                </span>
              </span>
              {stub.cap ? <span className="text-sm font-medium">{stub.cap}</span> : null}
            </>
          }
        >
          <h2 className="m-0 text-[1.1875rem] leading-snug font-semibold">{deal.headline}</h2>
          <dl className="border-border m-0 border-t">
            {[...deal.conditions, { label: t("detail.terms"), value: until }].map((entry) => (
              <div key={entry.label} className="border-border flex justify-between gap-4 border-b py-2.5 text-sm">
                <dt className="text-muted">{entry.label}</dt>
                <dd className="m-0 text-end font-medium">{entry.value}</dd>
              </div>
            ))}
          </dl>
          {deal.code ? (
            <div className="border-border-strong flex items-center justify-between gap-3 rounded-xl border border-dashed py-2.5 ps-3.5 pe-2.5">
              <span className="flex flex-col leading-tight">
                <small className="text-muted text-xs">{t("card.codeLabel")}</small>
                <b className="text-lg font-semibold tracking-[0.08em]">{deal.code}</b>
              </span>
              <CopyCodeButton code={deal.code} />
            </div>
          ) : (
            <p className="text-muted m-0 text-sm">{t("card.automatic")}</p>
          )}
          {state === "claimable" ? (
            <Button size="lg" block loading={saving} onClick={() => onSave(deal)}>
              {t("card.save")}
            </Button>
          ) : state === "saved" ? (
            <p className="text-success m-0 inline-flex min-h-13 items-center justify-center gap-1.5 font-medium">
              <Icon name="check" size={18} aria-hidden="true" />
              {t("card.saved")}
            </p>
          ) : null}
          <Button
            variant="ghost"
            iconStart="link"
            className="text-primary h-11"
            onClick={() => void share(deal.shareUrl, deal.headline, t("liff.linkCopied"))}
          >
            {t("liff.sendTeam")}
          </Button>
        </Ticket>
      </div>
    </Sheet>
  );
}
