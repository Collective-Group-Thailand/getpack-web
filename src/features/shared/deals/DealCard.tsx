"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Ticket } from "@/ui/components/Ticket";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { daysLeft, dealState, stubValue, thbCompact, type DealState } from "./model";
import type { Deal } from "./types";

export type DealCardVariant = "grid" | "compact" | "featured" | "hero";

export interface DealCardProps {
  deal: Deal;
  signedIn: boolean;
  /** `grid`: vertical ticket · `compact`: a row with a mini-stub · `featured`: horizontal, solid stub, stamp edge ·
   *  `hero`: the featured ticket standing up (phone). */
  variant?: DealCardVariant;
  /** The time the page was read, so "เหลือ n วัน" is the same on the server and in the browser. */
  now: number;
  /** The first product type's name, for the stub's tag. */
  typeName?: string | null;
  /** The surface's one amber "ดีลเด่น" badge (D-486). */
  showBadge?: boolean;
  /** The state the card shows instead of the API's (a save just made, Storybook). */
  stateOverride?: DealState;
  onSave?: (deal: Deal) => void;
  saving?: boolean;
  /** The deal's own page, for the compact row and "เงื่อนไขทั้งหมด". */
  href?: string;
  /** Opens the deal in place (LIFF sheet) instead of following `href`. */
  onOpen?: (deal: Deal) => void;
  signInHref?: string;
  walletHref?: string;
  headingLevel?: "h1" | "h2" | "h3";
  /**
   * Loyalty P2: why the deal is in "สำหรับคุณ", already worded by the surface ("สำหรับลูกค้าที่เคยสั่งกล่องลูกฟูก");
   * null or absent shows no line. Never an internal attribute (inactivity, business type).
   */
  reasonText?: string | null;
  /** Loyalty P2: opens the bundle sheet ("เพิ่มชุดนี้ลงตะกร้า") for a deal with a bundle. */
  onAddBundle?: (deal: Deal) => void;
  className?: string;
}

/**
 * A deal as a coupon ticket (loyalty P1.5, D-486; prototype `p15-deal-card.html`). The stub carries the value, the
 * body says what it is and until when; the code sits in a dashed box with its copy button. The grid's action is the
 * outline button — a solid one only on the featured ticket — and amber appears only as the one "ดีลเด่น" badge.
 * Every word is the API's (`promotions.display`) or `messages/*`; every figure the API's, formatted.
 */
export function DealCard({
  deal,
  signedIn,
  variant = "grid",
  now,
  typeName,
  showBadge = false,
  stateOverride,
  onSave,
  saving = false,
  href,
  onOpen,
  signInHref = "/sign-in?next=/deals",
  walletHref = "/account/wallet",
  headingLevel = "h3",
  reasonText = null,
  onAddBundle,
  className,
}: DealCardProps) {
  const t = useTranslations("deals.card");
  const format = useFormat();
  const state = stateOverride ?? dealState(deal, signedIn);
  const spent = state === "used";
  const stub = useDealStub(deal.benefit);
  // Loyalty P2: a bundle's stub is the API's estimated saving (ex-VAT), its body the pieces, its action the CTA.
  const { bundle } = deal;
  const bundleSaving = bundle?.estimatedSaving ? thbCompact(bundle.estimatedSaving, format.locale) : null;
  const value = stub.value;
  const word = bundleSaving ? t("bundle.word") : stub.word;
  const figureText = bundleSaving ?? stub.figureText;
  const cap = bundleSaving ? t("bundle.exVat") : stub.cap;
  const wordFigure = bundleSaving ? false : value.figure.kind === "word";
  const days = deal.endingSoon ? daysLeft(deal.endsAt, now) : null;
  const until = deal.endsAt ? t("until", { date: format.date(deal.endsAt) }) : t("noEnd");
  const condition = deal.conditions.map((entry) => `${entry.label} ${entry.value}`).join(" · ");
  const Heading = headingLevel;
  const badge = showBadge ? (
    <Badge tone="accent" appearance="solid" size="sm" className="self-start font-semibold">
      {deal.badge ?? t("featured")}
    </Badge>
  ) : null;
  const validity = (
    <p className={cn("m-0 text-[0.8125rem]", days !== null ? "text-warning font-medium" : "text-muted")}>
      {days !== null ? `${t("daysLeft", { days })} · ${until}` : until}
    </p>
  );
  const reason =
    state === "ineligible" ? (
      <p className="text-muted m-0 mt-1 flex items-start gap-1.5 text-[0.8125rem]">
        <Icon name="info" size={14} aria-hidden="true" className="mt-[3px] shrink-0" />
        {t(`reasons.${reasonKey(deal.notEligibleReason)}`)}
      </p>
    ) : null;

  const why = reasonText ? (
    <p className="text-primary-subtle-fg m-0 mt-0.5 flex items-start gap-1.5 text-[0.8125rem]">
      <Icon name="users" size={14} aria-hidden="true" className="mt-[3px] shrink-0" />
      {reasonText}
    </p>
  ) : null;
  const pieces = bundle ? (
    <ul className="m-0 mt-1.5 flex list-none flex-col p-0 text-[0.84375rem]">
      {bundle.items.map((item) => (
        <li
          key={item.productTypeCode}
          className="border-border flex justify-between gap-2.5 py-[3px] not-first:border-t not-first:border-dashed"
        >
          <span className="min-w-0 truncate">{item.productTypeName}</span>
          <span className="text-muted shrink-0 tabular-nums">
            {format.number(item.quantity)} {item.unit}
          </span>
        </li>
      ))}
    </ul>
  ) : null;
  const bundleAction = (solid: boolean, stretch: boolean) => (
    <Button
      variant={solid ? "primary" : "secondary"}
      className={stretch ? "w-full" : undefined}
      onClick={() => onAddBundle?.(deal)}
    >
      {t("bundle.add")}
    </Button>
  );

  if (variant === "compact") {
    const actionNode =
      bundle && state !== "used" && state !== "ineligible" ? (
        <Button variant="secondary" className="h-11 min-w-16 px-3.5" onClick={() => onAddBundle?.(deal)}>
          {t("bundle.addShort")}
        </Button>
      ) : state === "claimable" ? (
        <Button variant="secondary" className="h-11 min-w-16 px-3.5" loading={saving} onClick={() => onSave?.(deal)}>
          {t("saveShort")}
        </Button>
      ) : state === "guest" ? (
        <Button asChild variant="secondary" className="h-11 min-w-16 px-3.5">
          <Link href={signInHref}>{t("saveShort")}</Link>
        </Button>
      ) : state === "saved" ? (
        <span className="text-success inline-flex items-center gap-1.5 px-1 text-sm font-medium">
          <Icon name="check" size={16} aria-hidden="true" />
          {t("saved")}
        </span>
      ) : state === "used" ? (
        <Badge size="sm">{t("used")}</Badge>
      ) : state === "automatic" ? (
        <span className="text-muted text-xs">{t("automaticShort")}</span>
      ) : null;
    const meta =
      state === "ineligible"
        ? t(`reasons.${reasonKey(deal.notEligibleReason)}`)
        : (reasonText ?? (bundle ? bundle.items.map((item) => item.productTypeName).join(" + ") : condition));
    return (
      <div
        className={cn(
          "relative grid min-h-20 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3.5 px-3.5 py-3",
          className,
        )}
        aria-label={deal.benefit.summary}
        role="group"
      >
        {onOpen || href ? (
          onOpen ? (
            <button
              type="button"
              aria-label={t("open", { headline: deal.headline })}
              className="hover:bg-bg/60 focus-visible:ring-focus-ring absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
              onClick={() => onOpen(deal)}
            />
          ) : (
            <Link
              href={href!}
              aria-label={t("open", { headline: deal.headline })}
              className="hover:bg-bg/60 focus-visible:ring-focus-ring absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
            />
          )
        ) : null}
        <MiniStub word={bundle ? t("bundle.short") : word} figure={figureText} wordFigure={wordFigure} spent={spent} />
        <div className="pointer-events-none relative min-w-0">
          <Heading className={cn("m-0 truncate text-[0.9375rem] leading-snug font-semibold", spent && "text-muted")}>
            {deal.headline}
          </Heading>
          <p className={cn("m-0 mt-0.5 truncate text-[0.8125rem]", "text-muted")}>{meta}</p>
          <div className="[&>p]:text-[0.8125rem]">{validity}</div>
        </div>
        <div className="relative">{actionNode}</div>
      </div>
    );
  }

  const featured = variant === "featured" || variant === "hero";
  const footer = (
    <CardFooter
      deal={deal}
      state={state}
      solid={featured}
      saving={saving}
      onSave={onSave}
      signInHref={signInHref}
      walletHref={walletHref}
      stretch={variant === "hero"}
    />
  );

  if (variant === "featured")
    return (
      <article aria-label={deal.benefit.summary} className={cn("min-w-0", className)}>
        <Ticket
          orientation="horizontal"
          edge="stamp"
          tone="featured"
          stubSize={248}
          stubClassName="flex flex-col items-start ps-[1.875rem] pe-6 pt-6 pb-5 leading-none"
          bodyClassName="border-border-strong/55 border-s border-dashed ps-8 pe-7 pt-6 pb-5"
          stub={
            <>
              {word ? <span className="text-[0.9375rem] font-medium">{word}</span> : null}
              <span
                className={cn(
                  "mt-2.5 font-bold tracking-[-0.045em] tabular-nums",
                  wordFigure ? "text-[3rem] tracking-[-0.02em]" : "text-[5.25rem]",
                )}
              >
                {figureText}
              </span>
              {cap ? <span className="mt-3 mb-5 text-[0.9375rem] font-medium">{cap}</span> : null}
              {typeName ? (
                <span className="border-primary-fg/30 mt-auto self-stretch border-t pt-3.5 text-[0.8125rem] font-medium">
                  {typeName}
                </span>
              ) : null}
            </>
          }
        >
          <div className="flex items-center justify-between gap-3">
            {badge ?? <span />}
            {validity}
          </div>
          <Heading className="m-0 mt-3 text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] text-pretty">
            {deal.headline}
          </Heading>
          <p className="text-muted m-0 mt-1.5 text-[0.90625rem]">
            {[deal.subline, condition].filter(Boolean).join(" · ")}
          </p>
          {why}
          {reason}
          {pieces}
          <div className="border-border mt-auto flex flex-wrap items-center gap-3 border-t pt-5">
            {bundle && !spent && state !== "ineligible" ? bundleAction(true, false) : footer}
            {href ? (
              <Link
                href={href}
                className="text-primary ms-auto inline-flex min-h-11 items-center gap-0.5 text-sm font-medium hover:underline"
              >
                {t("terms")}
                <Icon name="chevron-right" size={16} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </Ticket>
      </article>
    );

  if (variant === "hero")
    return (
      <article aria-label={deal.benefit.summary} className={cn("min-w-0", className)}>
        <Ticket
          orientation="vertical"
          edge="stamp"
          tone="featured"
          stubSize={150}
          stubClassName="flex flex-col px-5 pt-5"
          bodyClassName="gap-1 px-5 pt-4 pb-5"
          stub={
            <>
              <span className="flex items-center justify-between pt-0.5 text-[0.9375rem] leading-none font-medium">
                <span>{word}</span>
                {typeName ? <span className="text-[0.8125rem]">{typeName}</span> : null}
              </span>
              <span className="mt-2.5 flex items-baseline gap-2.5 leading-none">
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    wordFigure ? "text-[2.5rem]" : "text-[3.875rem] tracking-[-0.045em]",
                  )}
                >
                  {figureText}
                </span>
                {cap ? <span className="text-[0.9375rem] font-medium">{cap}</span> : null}
              </span>
            </>
          }
        >
          <div className="flex items-center justify-between gap-3">
            {badge ?? <span />}
            {validity}
          </div>
          <Heading className="m-0 mt-2 text-[1.1875rem] leading-snug font-semibold text-pretty">
            {deal.headline}
          </Heading>
          <p className="text-muted m-0 text-[0.84375rem]">{[deal.subline, condition].filter(Boolean).join(" · ")}</p>
          {why}
          {reason}
          {pieces}
          <div className="mt-3.5 flex items-center gap-2.5">
            {bundle && !spent && state !== "ineligible" ? bundleAction(true, true) : footer}
          </div>
        </Ticket>
      </article>
    );

  return (
    <article aria-label={deal.benefit.summary} className={cn("flex min-w-0", className)}>
      <Ticket
        className="flex-1"
        tone={spent ? "spent" : "normal"}
        stubSize={116}
        stubClassName="flex flex-col px-[1.125rem] pt-3.5"
        bodyClassName="min-h-[11.5rem] gap-1 px-[1.125rem] pt-4 pb-[1.125rem]"
        stub={
          <>
            <span className="flex h-[1.375rem] items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-medium">{word}</span>
              {typeName ? <Badge size="sm">{typeName}</Badge> : null}
            </span>
            <span className="mt-2.5 flex items-baseline gap-2 leading-none tabular-nums">
              <span
                className={cn(
                  "font-semibold",
                  wordFigure ? "text-[1.875rem] tracking-[-0.01em]" : "text-[3.25rem] tracking-[-0.035em]",
                )}
              >
                {figureText}
              </span>
              {cap ? <span className="text-[0.8125rem] font-medium">{cap}</span> : null}
            </span>
          </>
        }
      >
        {badge ? <div className="mb-1.5">{badge}</div> : null}
        <Heading
          className={cn("m-0 line-clamp-2 text-base leading-snug font-semibold text-pretty", spent && "text-muted")}
        >
          {href ? (
            <Link href={href} className="hover:underline focus-visible:underline">
              {deal.headline}
            </Link>
          ) : (
            deal.headline
          )}
        </Heading>
        {condition ? <p className={cn("m-0 text-[0.84375rem] leading-normal", "text-muted")}>{condition}</p> : null}
        {why}
        {pieces}
        {validity}
        {reason}
        <div className="mt-auto flex min-h-14 items-center justify-between gap-2.5 pt-4">
          {bundle && !spent && state !== "ineligible" ? bundleAction(false, true) : footer}
        </div>
      </Ticket>
    </article>
  );
}

/** The stub's words for a benefit, formatted for the reader: "ลด" · "10%" · "สูงสุด ฿1,500". */
export function useDealStub(benefit: Deal["benefit"]) {
  const t = useTranslations("deals.card");
  const format = useFormat();
  const value = stubValue(benefit, {
    thbWhole: (amount) => thbCompact(amount, format.locale),
    percent: (figure) => format.percent(figure),
  });
  return {
    value,
    word: value.word ? t(value.word) : null,
    figureText: value.figure.kind === "word" ? t(value.figure.key) : value.figure.text,
    cap: value.cap ? t("cap", { amount: value.cap }) : null,
  };
}

function reasonKey(reason: string | null): string {
  const known = [
    "first_order_only",
    "new_customer_only",
    "returning_customer_only",
    "min_quantity",
    "min_order_value",
    "product_type",
    "segment",
    "usage_limit",
  ];
  return reason && known.includes(reason) ? reason : "other";
}

/** The 64 px stub of a compact row: one notch on its far edge (`notch="end"`). */
export function MiniStub({
  word,
  figure,
  wordFigure,
  spent = false,
  size = "md",
}: {
  word: string | null;
  figure: React.ReactNode;
  wordFigure: boolean;
  spent?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <Ticket
      aria-hidden="true"
      orientation="horizontal"
      notch="end"
      notchRadius={6}
      shape="control"
      tone={spent ? "spent" : "normal"}
      className={size === "sm" ? "h-11 w-13" : "h-14 w-16"}
      stubClassName="flex flex-col items-center justify-center gap-px pe-1 leading-none"
      stub={
        <>
          {word ? (
            <span className={size === "sm" ? "text-[0.625rem]" : "text-[0.6875rem] font-medium"}>{word}</span>
          ) : null}
          <span
            className={cn(
              "font-semibold tracking-[-0.02em] tabular-nums",
              wordFigure ? (size === "sm" ? "text-xs" : "text-[0.9375rem]") : size === "sm" ? "text-base" : "text-xl",
            )}
          >
            {figure}
          </span>
        </>
      }
    />
  );
}

/** The ticket's footer: the code box and the action for the state. */
function CardFooter({
  deal,
  state,
  solid,
  saving,
  onSave,
  signInHref,
  walletHref,
  stretch,
}: {
  deal: Deal;
  state: DealState;
  solid: boolean;
  saving: boolean;
  onSave?: (deal: Deal) => void;
  signInHref: string;
  walletHref: string;
  stretch: boolean;
}) {
  const t = useTranslations("deals.card");
  if (state === "automatic") return <p className="text-muted m-0 text-[0.8125rem]">{t("automatic")}</p>;
  if (state === "ineligible") return null;
  if (state === "used")
    return (
      <>
        {deal.code ? <CodeBox code={deal.code} muted /> : null}
        <Badge size="sm">{t("used")}</Badge>
      </>
    );
  return (
    <>
      <CodeBox code={deal.code!} className={stretch ? "flex-1 justify-between" : undefined} />
      {state === "saved" ? (
        <span className="flex flex-col items-end text-sm leading-snug">
          <span className="text-success inline-flex items-center gap-1.5 font-medium">
            <Icon name="check" size={16} aria-hidden="true" />
            {t("saved")}
          </span>
          <Link href={walletHref} className="text-primary text-[0.8125rem] font-medium underline underline-offset-4">
            {t("viewWallet")}
          </Link>
        </span>
      ) : state === "guest" ? (
        solid ? (
          <Button asChild>
            <Link href={signInHref}>{t("save")}</Link>
          </Button>
        ) : (
          <Link href={signInHref} className="text-primary text-[0.84375rem] font-medium underline underline-offset-4">
            {t("signInToSave")}
          </Link>
        )
      ) : (
        <Button variant={solid ? "primary" : "secondary"} loading={saving} onClick={() => onSave?.(deal)}>
          {t("save")}
        </Button>
      )}
    </>
  );
}

/**
 * The dashed code box with its copy button (named "คัดลอกโค้ด BOX10"); a polite live region says "คัดลอกโค้ด BOX10
 * แล้ว", and the icon turns to a check for two seconds.
 */
export function CodeBox({ code, muted = false, className }: { code: string; muted?: boolean; className?: string }) {
  const t = useTranslations("deals.card");
  const [copied, setCopied] = useState(false);
  const status = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span
      className={cn(
        "rounded-control bg-surface inline-flex h-10 items-center gap-0.5 border border-dashed ps-3 pe-1 text-sm font-semibold tracking-[0.06em] tabular-nums",
        muted ? "border-border text-muted" : "border-border-strong",
        className,
      )}
    >
      <span>{code}</span>
      {muted ? null : (
        <button
          type="button"
          aria-label={t("copy", { code })}
          aria-describedby={status}
          className="text-muted hover:bg-bg-subtle hover:text-fg focus-visible:ring-focus-ring grid size-8 place-items-center rounded-lg outline-none focus-visible:ring-2"
          onClick={() => {
            void navigator.clipboard?.writeText(code).catch(() => undefined);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={16} aria-hidden="true" />
        </button>
      )}
      <span id={status} role="status" aria-live="polite" className="sr-only">
        {copied ? t("copied", { code }) : ""}
      </span>
    </span>
  );
}

/** "คัดลอก" as a labelled button (the LIFF sheet's code box), with the same live announcement as `CodeBox`. */
export function CopyCodeButton({ code }: { code: string }) {
  const t = useTranslations("deals.card");
  const [copied, setCopied] = useState(false);
  const status = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <Button
        variant="secondary"
        iconStart={copied ? "check" : "copy"}
        aria-label={t("copy", { code })}
        aria-describedby={status}
        onClick={() => {
          void navigator.clipboard?.writeText(code).catch(() => undefined);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        }}
      >
        {t("copyShort")}
      </Button>
      <span id={status} role="status" aria-live="polite" className="sr-only">
        {copied ? t("copied", { code }) : ""}
      </span>
    </>
  );
}
