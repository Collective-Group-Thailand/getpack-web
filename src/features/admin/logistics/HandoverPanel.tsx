"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { When } from "@/features/shared/format";
import { ApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { browserBffUrl } from "@/lib/zones";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { toast } from "@/ui/components/Toast";
import { Icon, type IconName } from "@/ui/icons";

import { adminBrowserApis, ConfirmAction, problemMessage, Section, useCan } from "../console";
import type { Shipment } from "./resources";

type Issued = Schemas["IssuedHandoverLinkDto"];
type LinkState = Schemas["HandoverLinkState"];

/** The trips getpack-api issues a link for (`HANDOVER_ISSUABLE`): packed, up to delivery. */
const ISSUABLE = new Set<string>(["ready", "picked_up", "in_transit", "out_for_delivery", "failed"]);
const BADGE: Record<LinkState | "none", { tone: "success" | "neutral" | "warning"; icon: IconName }> = {
  none: { tone: "neutral", icon: "link" },
  active: { tone: "success", icon: "link" },
  expired: { tone: "warning", icon: "clock" },
  revoked: { tone: "neutral", icon: "ban" },
  closed: { tone: "neutral", icon: "check" },
};

/** `https://getpack.co/l/d8f…` → `getpack.co/l/d••••••`: where the link leads, without the token that opens it. */
export function maskLink(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    const [, prefix = "", token = ""] = /^(.*\/l\/)(.*)$/.exec(pathname) ?? [];
    return `${host}${prefix}${token.slice(0, 1)}${"\u2022".repeat(6)}`;
  } catch {
    return "\u2022".repeat(8);
  }
}

/** The waybill PDF through the BFF (`admin.shipments.waybill`, audited), saved under the API's file name. */
async function downloadWaybill(shipment: Shipment) {
  const response = await fetch(browserBffUrl("admin", `/shipments/${encodeURIComponent(shipment.id)}/waybill`), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Schemas["ProblemDetails"] | null;
    throw problem?.code ? new ApiError(problem) : new Error(`waybill ${response.status}`);
  }
  const name =
    /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1] ??
    `${shipment.shipmentNo}-waybill.pdf`;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * The driver handover link and the carrier waybill (D-463, sealed carrier label). The recipient's name, phone and
 * address reach the carrier only through these: the link `<storefront>/l/d…` the driver opens on a phone
 * (`admin.shipments.issueHandoverLink`), and the full address label staff print (`admin.shipments.waybill`). The
 * link's URL comes back once — getpack-api keeps only its hash — so it is shown here until the page is left, with
 * a copy button; issuing again revokes the previous link, which is why that asks first. The factory learns only
 * that a waybill was issued.
 */
export function HandoverPanel({ shipment, lead = true }: { shipment: Shipment; lead?: boolean }) {
  const t = useTranslations("logistics.shipment.handover");
  const queryClient = useQueryClient();
  const canManage = useCan("shipments.manage");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const link = shipment.handover;
  const issuable = ISSUABLE.has(shipment.status);
  // Until the refetch lands, a link issued here is the active one.
  const state: LinkState | "none" = link?.state ?? (issued ? "active" : "none");

  const issue = async () => {
    setIssuing(true);
    try {
      const { data } = await adminBrowserApis().contract.POST("/v1/admin/shipments/{shipmentId}/handover-link", {
        params: { path: { shipmentId: shipment.id } },
      });
      setIssued(data!);
      toast.success(state === "none" ? t("issuedToast") : t("reissued"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.detail("admin", "shipment", shipment.id) });
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    } finally {
      setIssuing(false);
    }
  };

  const waybill = async () => {
    setDownloading(true);
    try {
      await downloadWaybill(shipment);
    } catch (error) {
      toast.error(problemMessage(error, t("waybillFailed")));
    } finally {
      setDownloading(false);
    }
  };

  const facts = link
    ? [
        { term: t("issuedAt"), description: <When at={link.issuedAt} /> },
        { term: t("expiresAt"), description: <When at={link.expiresAt} /> },
        { term: t("opens"), description: t("openCount", { count: link.openCount }) },
        { term: t("lastOpenedAt"), description: link.lastOpenedAt ? <When at={link.lastOpenedAt} /> : t("never") },
        {
          term: t("pickupConfirmedAt"),
          description: link.pickupConfirmedAt ? <When at={link.pickupConfirmedAt} /> : t("notYet"),
        },
      ]
    : [];

  return (
    <Section
      title={
        <>
          {t("title")}
          <Badge tone={BADGE[state].tone} icon={BADGE[state].icon}>
            {t(`states.${state}`)}
          </Badge>
        </>
      }
      description={t("description")}
    >
      <div className="flex flex-col gap-4">
        {issued ? (
          <div className="border-border bg-primary-subtle rounded-control flex flex-col gap-2 border p-3">
            <p className="text-primary-subtle-fg text-sm font-semibold">{t("issuedTitle")}</p>
            {/* The link is a key to the recipient's address: never printed on screen (or in a screenshot), only
                copied — the field shows where it leads, the token masked. */}
            <div className="flex items-center gap-2">
              <span
                className="border-border bg-surface rounded-control text-muted min-w-0 flex-1 truncate border px-3 py-2 font-mono text-xs"
                aria-label={t("issuedTitle")}
              >
                {maskLink(issued.url)}
              </span>
              <Button
                size="md"
                iconStart="copy"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.url);
                  toast.success(t("copied"));
                }}
              >
                {t("copy")}
              </Button>
            </div>
            <p className="text-primary-subtle-fg flex items-start gap-1.5 text-sm">
              <Icon name="shield-alert" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t("driverOnly")}
            </p>
            <p className="text-primary-subtle-fg text-xs">{t("shownOnce")}</p>
          </div>
        ) : null}

        {link ? (
          <DescriptionList columns={1} items={facts} />
        ) : issued ? null : (
          <p className="text-muted text-sm">{t("none")}</p>
        )}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="md"
              variant={lead && state === "none" ? "primary" : "secondary"}
              iconStart={state === "none" ? "link" : "refresh"}
              loading={issuing}
              disabled={!issuable}
              onClick={() => (state === "active" ? setConfirming(true) : void issue())}
            >
              {state === "none" ? t("issue") : t("reissue")}
            </Button>
            <Button
              size="md"
              variant={lead && state === "none" ? "secondary" : "ghost"}
              iconStart="download"
              loading={downloading}
              onClick={() => void waybill()}
            >
              {t("waybill")}
            </Button>
          </div>
        ) : null}
        {canManage && !issuable ? <p className="text-muted text-xs">{t("notIssuable")}</p> : null}
      </div>

      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={t("reissueTitle", { no: shipment.shipmentNo })}
        description={t("reissueBody")}
        confirmLabel={t("reissue")}
        tone="destructive"
        onConfirm={async () => {
          await issue();
          setConfirming(false);
        }}
      />
    </Section>
  );
}
