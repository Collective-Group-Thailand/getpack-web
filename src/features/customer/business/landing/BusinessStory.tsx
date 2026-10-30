import { getLocale, getTranslations } from "next-intl/server";

import { HeroStory, type StoryScene } from "@/features/customer/hero-story/HeroStory";
import { Bar, Foot, Pill, Pressed, Row, Scene, Tick, Toast, Typed, Up, at } from "@/features/customer/hero-story/parts";
import { formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { sampleOrders, type PricedProduct } from "./samples.server";

const ROLES = ["buyer", "approver", "accountant", "admin"] as const;
const BRANCHES = ["hq", "one", "two"] as const;

/**
 * The /business hero story (hero redesign 2026-10-30, the product owner's variant A): five scenes — instant
 * prices, approval, tax invoices per branch, CSV reorder, the company account. Every figure is the API's: the
 * priced product and its quantity tiers (`pricedSamples`, the store pricing path), the price lock, the credit
 * terms; branches are generic labels and there is no company, PO number or total (GLOBAL-RULES §3). Without
 * priced products the price and reorder scenes show the claim over placeholder lines.
 */
export async function BusinessStory({
  products,
  priceLockDays,
  creditTerms,
}: {
  products: PricedProduct[];
  priceLockDays: number | null;
  creditTerms: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("business.landing.story"), getLocale() as Promise<Locale>]);
  const first = products[0];
  const tiers = first ? first.steps.slice(0, 3) : [];
  const chosen = tiers[Math.min(1, tiers.length - 1)];
  const orders = sampleOrders(products).slice(0, 3);
  const approved = orders[0] ?? null;
  const money = (amount: string) => formatTHB(amount, locale, { decimals: 0 });
  const pieces = (quantity: number) => t("pieces", { count: formatNumber(quantity, locale) });

  const scenes: StoryScene[] = [
    {
      key: "price",
      label: t("price.label"),
      content: (
        <Scene
          tag={t("price.label")}
          before={t("price.before")}
          title={t("price.title")}
          toast={
            chosen ? (
              <Toast
                delay={3.6}
                title={t("price.toast")}
                detail={`${pieces(chosen.quantity)} · ${money(chosen.amount)}`}
              />
            ) : null
          }
        >
          <div className="border-border border-b px-5 py-3.5">
            <Typed delay={0.8} text={first?.name ?? t("price.query")} />
          </div>
          <div className="px-5 pt-1 pb-1.5">
            {tiers.length > 0
              ? tiers.map((tier, index) => (
                  <Row
                    key={tier.quantity}
                    delay={1.9 + index * 0.2}
                    highlight={tier === chosen}
                    last={index === tiers.length - 1}
                    name={pieces(tier.quantity)}
                    mid={tier.leadTimeDays !== null ? t("price.leadTime", { days: tier.leadTimeDays }) : ""}
                    end={money(tier.amount)}
                  />
                ))
              : [0, 1, 2].map((row) => (
                  <Up
                    key={row}
                    delay={1.9 + row * 0.2}
                    className="border-border flex gap-3 border-b py-3.5 last:border-b-0"
                  >
                    <span className="bg-border-strong rounded-thumb block h-2 w-1/3" />
                    <span className="bg-border-strong rounded-thumb ml-auto block h-2 w-16" />
                  </Up>
                ))}
          </div>
          <Foot>
            <Pill delay={2.6}>{t("price.pill")}</Pill>
            <Pressed cursorAt={2.4} pressAt={3.4}>
              {t("price.order")}
            </Pressed>
          </Foot>
        </Scene>
      ),
    },
    {
      key: "approval",
      label: t("approval.label"),
      content: (
        <Scene
          tag={t("approval.label")}
          before={t("approval.before")}
          title={t("approval.title")}
          toast={<Toast delay={3} title={t("approval.toast")} detail={t("approval.toastDetail")} />}
        >
          <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <span className="text-muted block text-xs">{t("approval.order")}</span>
              {approved ? (
                <b className="mt-0.5 block text-lg font-bold tabular-nums">{money(approved.amount)}</b>
              ) : (
                <b className="mt-0.5 block text-lg font-bold">{approved === null ? t("approval.orderNoAmount") : ""}</b>
              )}
            </div>
            <div className="w-[7.5rem]">
              <span className="text-muted flex justify-between text-[11px]">
                <span>{t("approval.limit")}</span>
                <span>{t("approval.within")}</span>
              </span>
              <Bar delay={0.9} percent={68} className="mt-1.5" />
            </div>
          </div>
          <div className="flex flex-col gap-3 px-5 pt-3.5 pb-4">
            {(["buyer", "approver", "accountant"] as const).map((step, index) => (
              <Up key={step} delay={1.1 + index * 0.4} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                    index < 2 ? "bg-primary text-primary-fg" : "bg-bg-subtle text-muted",
                  )}
                >
                  {t(`approval.steps.${step}.initial`)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold">{t(`approval.steps.${step}.title`)}</b>
                  <span className="text-muted block text-xs">{t(`approval.steps.${step}.body`)}</span>
                </span>
                {index === 0 ? <Tick delay={1.4} /> : null}
                {index === 1 ? (
                  <Pressed cursorAt={1.7} pressAt={2.7}>
                    {t("approval.approve")}
                  </Pressed>
                ) : null}
                {index === 2 ? <Pill tone="muted">{t("approval.next")}</Pill> : null}
              </Up>
            ))}
          </div>
        </Scene>
      ),
    },
    {
      key: "invoice",
      label: t("invoice.label"),
      content: (
        <Scene
          tag={t("invoice.label")}
          before={t("invoice.before")}
          title={t("invoice.title")}
          toast={<Toast delay={3.2} title={t("invoice.toast")} detail={t("invoice.toastDetail")} />}
        >
          <ul className="px-5 py-1.5">
            {BRANCHES.map((branch, index) => (
              <Up
                key={branch}
                delay={0.9 + index * 0.5}
                className="border-border flex items-center gap-3 border-b py-3 last:border-b-0"
              >
                <span className="bg-primary-subtle text-primary rounded-control grid size-8 shrink-0 place-items-center">
                  <Icon name="receipt" size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold">{t(`invoice.branches.${branch}`)}</b>
                  <span className="text-muted block text-xs">
                    {t("invoice.issuedTo", { branch: t(`invoice.branches.${branch}`) })}
                  </span>
                </span>
                <Pill delay={1.3 + index * 0.5}>{t("invoice.issued")}</Pill>
              </Up>
            ))}
          </ul>
        </Scene>
      ),
    },
    {
      key: "reorder",
      label: t("reorder.label"),
      content: (
        <Scene
          tag={t("reorder.label")}
          before={t("reorder.before")}
          title={t("reorder.title")}
          toast={<Toast delay={3.3} title={t("reorder.toast")} detail={t("reorder.toastDetail")} />}
        >
          <div className="border-border flex items-center gap-2.5 border-b px-5 py-3.5">
            <span
              className="pk-story-drop bg-bg-subtle rounded-control inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold"
              style={at(0.8)}
            >
              <Icon name="spreadsheet" size={14} aria-hidden="true" />
              {t("reorder.file")}
            </span>
          </div>
          <div className="px-5 pt-1 pb-1.5">
            {orders.length > 0
              ? orders.map((order, index) => (
                  <Row
                    key={order.key}
                    delay={1.6 + index * 0.25}
                    last={index === orders.length - 1}
                    name={order.name}
                    mid={`×${formatNumber(order.quantity, locale)}`}
                    end={money(order.amount)}
                  />
                ))
              : [0, 1, 2].map((row) => (
                  <Up
                    key={row}
                    delay={1.6 + row * 0.25}
                    className="border-border flex gap-3 border-b py-3.5 last:border-b-0"
                  >
                    <span className="bg-border-strong rounded-thumb block h-2 w-1/2" />
                    <span className="bg-border-strong rounded-thumb ml-auto block h-2 w-14" />
                  </Up>
                ))}
          </div>
          <Foot>
            <Pill delay={2.7}>{t("reorder.pill")}</Pill>
          </Foot>
        </Scene>
      ),
    },
    {
      key: "account",
      label: t("account.label"),
      content: (
        <Scene tag={t("account.label")} before={t("account.before")} title={t("account.title", { terms: creditTerms })}>
          <dl className="grid grid-cols-2 gap-px px-5 py-4 sm:grid-cols-3">
            {[
              priceLockDays
                ? {
                    key: "lock",
                    value: t("account.facts.lock.value", { days: priceLockDays }),
                    label: t("account.facts.lock.label"),
                  }
                : null,
              { key: "credit", value: creditTerms, label: t("account.facts.credit.label") },
              { key: "free", value: t("account.facts.free.value"), label: t("account.facts.free.label") },
            ]
              .filter((fact): fact is { key: string; value: string; label: string } => fact !== null)
              .map((fact, index) => (
                <Up key={fact.key} delay={0.9 + index * 0.25} className="flex flex-col-reverse py-1">
                  <dt className="text-muted text-xs">{fact.label}</dt>
                  <dd className="text-lg font-bold tabular-nums">{fact.value}</dd>
                </Up>
              ))}
          </dl>
          <ul className="border-border grid grid-cols-2 gap-2 border-t px-5 py-4 sm:grid-cols-4">
            {ROLES.map((role, index) => (
              <Up
                key={role}
                delay={1.8 + index * 0.2}
                className="bg-bg-subtle rounded-control p-2.5 text-center text-xs"
              >
                <b className="block text-[13px] font-semibold">{t(`account.roles.${role}.title`)}</b>
                <span className="text-muted">{t(`account.roles.${role}.body`)}</span>
              </Up>
            ))}
          </ul>
        </Scene>
      ),
    },
  ];

  return (
    <HeroStory label={t("label")} roleDescription={t("role")} scenes={scenes} className="h-[33rem] sm:h-[35rem]" />
  );
}
