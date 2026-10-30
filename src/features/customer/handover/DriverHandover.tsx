"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { SHIPMENT_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon, type IconName } from "@/ui/icons";

import { CartonScanner, scannerAvailable } from "./CartonScanner";
import { displayPhone, screenOfError, screenOfHandover, telHref, type Handover, type HandoverScreen } from "./state";

/**
 * The driver's page behind a handover link `<storefront>/l/d…` (D-463, sealed carrier label): the one place outside
 * getpack's staff that shows the recipient's name, phone and address. Public — the link's token is the only key —
 * and read in the browser through the BFF (`store.handover.resolve`), so a link preview or crawler fetching the
 * HTML neither sees the recipient nor counts as an open. Built for a phone held in one hand: the phone number is a
 * large tap-to-call, and "confirm pickup" (`store.handover.confirmPickup`) sits in the sticky bar at the thumb. The
 * cartons' QR may be scanned first where the browser can read QR codes; elsewhere the driver confirms without.
 */
export function DriverHandover({ token }: { token: string }) {
  const [screen, setScreen] = useState<HandoverScreen>({ kind: "loading" });
  const [details, setDetails] = useState(false);
  const opened = useRef(false);

  const open = useCallback(async () => {
    setScreen({ kind: "loading" });
    try {
      const { data } = await browserApi().POST("/v1/store/handover-links/actions/resolve", { body: { token } });
      setScreen(screenOfHandover(data!));
    } catch (error) {
      setScreen(screenOfError(error));
    }
  }, [token]);

  useEffect(() => {
    // Every open is an audit row; React's development double effect must not write two.
    if (opened.current) return;
    opened.current = true;
    void open();
  }, [open]);

  const back = (handover: Handover) => {
    setDetails(false);
    setScreen(screenOfHandover(handover));
  };

  switch (screen.kind) {
    case "loading":
      return <Loading />;
    case "ready":
      return (
        <Trip
          token={token}
          handover={screen.handover}
          onDone={(handover) => setScreen(screenOfHandover(handover))}
          onRefused={(error, handover) => setScreen(screenOfError(error, handover))}
        />
      );
    case "picked-up":
      return details ? (
        <Trip token={token} handover={screen.handover} />
      ) : (
        <PickedUp handover={screen.handover} onDetails={() => setDetails(true)} />
      );
    default:
      return <Refused screen={screen} onRetry={() => void open()} onBack={back} />;
  }
}

function Loading() {
  const t = useTranslations("fulfilment.handover");
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5 pb-8" aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="rounded-panel h-64 w-full" />
      <Skeleton className="rounded-panel h-40 w-full" />
    </div>
  );
}

/** The trip: who receives it, where, the cartons and the link's expiry — and, until picked up, the confirm bar. */
function Trip({
  token,
  handover,
  onDone,
  onRefused,
}: {
  token: string;
  handover: Handover;
  onDone?: (handover: Handover) => void;
  onRefused?: (error: unknown, handover: Handover) => void;
}) {
  const t = useTranslations("fulfilment.handover");
  const format = useFormat();
  const locale = useLocale();
  const [scanning, setScanning] = useState(false);
  const [scans, setScans] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { recipient } = handover;
  const confirmable = Boolean(onDone) && handover.canConfirmPickup && !handover.pickupConfirmedAt;
  const total = handover.cartonsCount;

  // False on the server and in the first paint: only the browser knows whether it reads QR codes.
  const canScan = useSyncExternalStore(noSubscription, scannerAvailable, () => false);
  const onScan = useCallback((scanned: string) => setScans((list) => [...list, scanned]), []);

  const confirm = async () => {
    setBusy(true);
    try {
      const scannedTokens = [...new Set(scans)];
      const { data } = await browserApi().POST("/v1/store/handover-links/actions/confirm-pickup", {
        body: scannedTokens.length ? { token, scannedTokens } : { token },
      });
      setAsking(false);
      onDone?.(data!);
    } catch (error) {
      setAsking(false);
      setScans([]);
      onRefused?.(error, handover);
    } finally {
      setBusy(false);
    }
  };

  const province = locale === "en" ? recipient.province.nameEn : recipient.province.nameTh;
  const area = `${province} ${recipient.postcode}`;
  const scanned = t("scan.counted", { count: scans.length, total });
  const confirmButton = (
    <Button size="xl" block iconStart="package-check" onClick={() => setAsking(true)}>
      {t("confirm")}
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5 pb-8 md:pt-10">
      <header className="flex flex-col gap-1.5">
        <p className="text-muted text-sm">{t("lede")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold tabular-nums">{t("shipment", { no: handover.shipmentNo })}</p>
          <StatusChip map={SHIPMENT_STATUS} value={handover.status} />
        </div>
      </header>

      <section aria-labelledby="handover-recipient" className="border-border bg-surface rounded-panel border p-4">
        <p className="text-muted text-sm">{t("recipient")}</p>
        <h1
          id="handover-recipient"
          className="mt-0.5 text-2xl leading-tight font-semibold [overflow-wrap:break-word] break-keep"
        >
          {recipient.name}
        </h1>
        <a
          href={telHref(recipient.phone)}
          aria-label={t("callLabel", { name: recipient.name, phone: displayPhone(recipient.phone) })}
          className="border-border-strong bg-surface hover:bg-surface-subtle rounded-control mt-4 flex min-h-16 items-center gap-3 border px-4 py-2"
        >
          <span
            aria-hidden="true"
            className="bg-primary text-primary-fg grid size-10 shrink-0 place-items-center rounded-full"
          >
            <Icon name="phone" size={20} />
          </span>
          <span className="text-[1.375rem] font-semibold whitespace-nowrap tabular-nums">
            {displayPhone(recipient.phone)}
          </span>
          <span className="text-muted ms-auto shrink-0 text-xs whitespace-nowrap">{t("tapToCall")}</span>
        </a>
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-muted flex items-center gap-1.5 text-sm">
            <Icon name="map-pin" size={16} aria-hidden="true" />
            {t("address")}
          </p>
          <address className="mt-1 text-lg leading-snug [overflow-wrap:break-word] break-keep not-italic">
            <span className="block">{recipient.line1}</span>
            {recipient.line2 ? <span className="block">{recipient.line2}</span> : null}
            <span className="block font-semibold">{area}</span>
          </address>
        </div>
      </section>

      <section aria-labelledby="handover-cartons" className="border-border bg-surface rounded-panel border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="handover-cartons" className="text-base font-semibold">
            {t("cartons", { count: total })}
          </h2>
          <p className="text-muted text-sm tabular-nums">
            {t("weight", { kg: format.number(Math.round(handover.weightG / 100) / 10) })}
          </p>
        </div>
        {handover.cartons.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {handover.cartons.map((carton) => (
              <li
                key={carton.seq}
                className="border-border bg-surface-subtle rounded-control flex flex-col border px-3 py-2"
              >
                <span className="font-semibold tabular-nums">{t("cartonOf", { n: carton.seq, total })}</span>
                <span className="text-muted truncate text-xs tabular-nums">{carton.labelCode}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="border-border mt-4 grid gap-2 border-t pt-3 text-sm">
          {handover.plannedShipOn ? (
            <Fact icon="calendar" term={t("plannedOn")} value={format.date(handover.plannedShipOn)} />
          ) : null}
          <Fact icon="clock" term={t("expires")} value={format.dateTime(handover.expiresAt)} />
          {handover.pickupConfirmedAt ? (
            <Fact icon="check" term={t("pickedUpAt")} value={format.dateTime(handover.pickupConfirmedAt)} />
          ) : null}
        </dl>
      </section>

      {confirmable && canScan ? (
        <section
          aria-labelledby="handover-scan"
          className="border-border bg-surface rounded-panel flex flex-col gap-3 border p-4"
        >
          <div>
            <h2 id="handover-scan" className="text-base font-semibold">
              {t("scan.heading")}
            </h2>
            <p className="text-muted text-sm [overflow-wrap:break-word] break-keep">{t("scan.optional")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="lg" iconStart="scan" onClick={() => setScanning(true)}>
              {t("scan.open")}
            </Button>
            <p className="text-sm font-medium tabular-nums" aria-live="polite">
              {scanned}
            </p>
          </div>
          {scans.length ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setScans([])}>
              {t("scan.reset")}
            </Button>
          ) : null}
          <CartonScanner
            open={scanning}
            onOpenChange={setScanning}
            count={scans.length}
            total={total}
            onScan={onScan}
          />
        </section>
      ) : null}

      {confirmable ? (
        <>
          <div className="hidden md:block">{confirmButton}</div>
          <MobileActionBar>{confirmButton}</MobileActionBar>
          <AlertDialog
            open={asking}
            onOpenChange={(next) => (busy ? undefined : setAsking(next))}
            title={t("confirmTitle")}
            description={
              scans.length
                ? t("confirmBodyScanned", { count: total, scanned: scans.length })
                : t("confirmBody", { count: total })
            }
            confirmLabel={t("confirm")}
            cancelLabel={t("cancel")}
            loading={busy}
            onConfirm={() => void confirm()}
          />
        </>
      ) : null}
    </div>
  );
}

const noSubscription = () => () => {};

function Fact({ icon, term, value }: { icon: IconName; term: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={16} className="text-muted shrink-0" aria-hidden="true" />
      <dt className="text-muted">{term}</dt>
      <dd className="ms-auto font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function PickedUp({ handover, onDetails }: { handover: Handover; onDetails: () => void }) {
  const t = useTranslations("fulfilment.handover");
  const format = useFormat();
  return (
    <StateCard
      icon="package-check"
      title={t("pickedUp.title")}
      body={t("pickedUp.body", { at: format.dateTime(handover.pickupConfirmedAt ?? handover.expiresAt) })}
      action={
        <Button asChild size="xl" iconStart="phone">
          <a href={telHref(handover.recipient.phone)}>{t("pickedUp.call")}</a>
        </Button>
      }
      secondary={
        <Button variant="ghost" onClick={onDetails}>
          {t("pickedUp.details")}
        </Button>
      }
    />
  );
}

/** A refused open or confirmation: what happened, and what to do next. */
function Refused({
  screen,
  onRetry,
  onBack,
}: {
  screen: Exclude<HandoverScreen, { kind: "loading" | "ready" | "picked-up" }>;
  onRetry: () => void;
  onBack: (handover: Handover) => void;
}) {
  const t = useTranslations("fulfilment.handover");
  const handover = "handover" in screen ? screen.handover : null;
  const getpackPhone = handover?.sender.phone ?? null;
  const contactAs = (variant: "primary" | "secondary") =>
    getpackPhone ? (
      <Button asChild size="xl" variant={variant} iconStart="phone">
        <a href={telHref(getpackPhone)}>{t("actions.callGetpack")}</a>
      </Button>
    ) : (
      <Button asChild size="xl" variant={variant} iconStart="chat">
        <Link href="/contact">{t("actions.contact")}</Link>
      </Button>
    );
  const contact = contactAs("primary");
  const backToTrip = handover ? (
    <Button variant="ghost" onClick={() => onBack(handover)}>
      {t("actions.back")}
    </Button>
  ) : null;

  switch (screen.kind) {
    case "not-found":
      return <StateCard icon="link" title={t("notFound.title")} body={t("notFound.body")} action={contact} />;
    case "expired":
      return <StateCard icon="clock" title={t("expired.title")} body={t("expired.body")} action={contact} />;
    case "not-ready":
      return (
        <StateCard
          icon="hourglass"
          title={t("notReady.title")}
          body={t("notReady.body")}
          action={contact}
          secondary={backToTrip}
        />
      );
    case "wrong-carton":
      return (
        <StateCard
          icon="shield-alert"
          title={t("wrongCarton.title")}
          body={t("wrongCarton.body")}
          action={
            handover ? (
              <Button size="xl" iconStart="scan" onClick={() => onBack(handover)}>
                {t("actions.scanAgain")}
              </Button>
            ) : (
              contact
            )
          }
          secondary={handover ? contactAs("secondary") : null}
        />
      );
    case "error":
      return (
        <StateCard
          icon="refresh"
          title={t("error.title")}
          body={t("error.body")}
          action={
            <Button size="xl" iconStart="refresh" onClick={handover ? () => onBack(handover) : onRetry}>
              {t("actions.retry")}
            </Button>
          }
        />
      );
  }
}

function StateCard({
  icon,
  title,
  body,
  action,
  secondary,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col justify-center px-4 py-10">
      <EmptyState
        action={action}
        secondary={secondary}
        icon={icon}
        title={title}
        titleAs="h1"
        description={body}
        className="[overflow-wrap:break-word] break-keep"
      />
    </div>
  );
}
