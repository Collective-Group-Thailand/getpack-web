import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import {
  capPct,
  inView,
  isClosed,
  OFFER_STATUS_TONE,
  OFFER_VIEWS,
  type OfferView,
} from "@/features/partner/cofunding/offers";
import { OfferTicket } from "@/features/partner/cofunding/OfferTicket";
import { attempt, canAt, factoryContext } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { serverApi } from "@/lib/api/server";
import type { PartnerCofundingOffer } from "@/features/shared/loyalty-p4/types";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.cofunding"))("title") };
}

/**
 * "ร่วมสนับสนุนส่วนลด" (loyalty P4, D-506; prototype `p4-partner-cofunding.html`, 390 first): the factory's own
 * co-funding offers as tickets — awaiting an answer, accepted (with the accrued / cap meter), and the closed ones under
 * "ที่ผ่านมา". The lede says what an offer is and that it is voluntary. Never shows customers, other factories, other
 * offers or free capacity (`partner.cofundingOffers.list`).
 */
export default async function CofundingOffersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const view: OfferView = OFFER_VIEWS.includes(query.view as OfferView) ? (query.view as OfferView) : "open";
  const [t, format, context] = await Promise.all([
    getTranslations("partnerBilling.cofunding"),
    getFormat(),
    factoryContext(),
  ]);
  if (!canAt(context, "factory_cofunding.read"))
    return (
      <PartnerPage title={t("title")}>
        <Callout tone="info" title={t("noAccess")} />
      </PartnerPage>
    );
  const api = await serverApi("partner");
  const found = await attempt(
    async () =>
      (
        await api.GET("/v1/partner/cofunding-offers", {
          params: { query: { factoryId: context.factoryId, perPage: 100 } },
        })
      ).data!.data,
  );
  if (!found.data)
    return (
      <PartnerPage title={t("title")} description={t("lede")}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const offers = found.data;
  const count = (key: OfferView) => offers.filter((offer) => inView(offer, key)).length;
  const shown = offers.filter((offer) => inView(offer, view));
  const live = shown.filter((offer) => !isClosed(offer));
  const past = shown.filter(isClosed);

  const ticket = (offer: PartnerCofundingOffer) => (
    <li key={offer.id} className="flex">
      <OfferTicket
        href={`/cofunding/${offer.id}`}
        share={offer.mode === "pct_of_discount" ? format.percent(offer.sharePct, 2) : format.thb(offer.fixedAmount)}
        shareUnit={t(`shareUnit.${offer.mode}`)}
        title={t("ticketTitle", {
          type: offer.deal.productTypeName,
          from: format.date(offer.validFrom),
          to: format.date(offer.validTo),
        })}
        meta={t("ticketMeta", { pct: format.percent(offer.deal.discountPct), cap: format.thb(offer.capAmount) })}
        status={{ label: t(`status.${offer.status}`), tone: OFFER_STATUS_TONE[offer.status] }}
        closed={isClosed(offer)}
        waiting={offer.status === "proposed" ? t("respondBy", { date: format.dateTime(offer.respondBy) }) : undefined}
        use={
          offer.status === "accepted"
            ? {
                text: t("use", {
                  accrued: format.thb(offer.accruedAmount),
                  cap: format.thb(offer.capAmount),
                  orders: offer.ordersCount,
                }),
                pct: capPct(offer),
              }
            : undefined
        }
        linkLabel={t("open")}
      />
    </li>
  );

  return (
    <PartnerPage title={t("title")} description={t("lede")}>
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={OFFER_VIEWS.map((key) => ({
            key,
            href: `/cofunding${queryOf({ view: key === "open" ? undefined : key })}`,
            label: t(`views.${key}`),
            count: count(key),
          }))}
        />
      </ListToolbar>
      {shown.length === 0 ? (
        <EmptyState icon="handshake" title={t(`empty.${view}`)} description={t("emptyBody")} />
      ) : (
        <>
          {live.length ? <ul className="grid gap-3 md:grid-cols-2">{live.map(ticket)}</ul> : null}
          {past.length ? (
            <PartnerSection title={t("past")}>
              <ul className="grid gap-3 md:grid-cols-2">{past.map(ticket)}</ul>
            </PartnerSection>
          ) : null}
        </>
      )}
      <Callout tone="neutral" icon="info">
        {t("netNote")}
      </Callout>
    </PartnerPage>
  );
}
