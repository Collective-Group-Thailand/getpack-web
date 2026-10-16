"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Dialog } from "@/ui/components/Dialog";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, ConfirmAction, problemMessage, useCan } from "../console";

type Quote = Schemas["AdminSavedQuoteDto"];

/** The storefront's origin as seen from the back office (`admin.<host>` → `<host>`). */
const storeOrigin = () => window.location.origin.replace("//admin.", "//");

/**
 * Where the customer opens a shared quotation: a catalogue product's configurator with the token
 * (`/configure/{slug}?share=…`, as the storefront shares its own); a quotation priced outside the
 * catalogue has no configurator page, so the customer finds it in their account's quotations.
 */
async function shareUrl(quote: Quote, token: string): Promise<string> {
  const productId = (quote.configuration as { catalogProductId?: string }).catalogProductId;
  if (productId) {
    try {
      const { data } = await adminBrowserApis().contract.GET("/v1/admin/catalog/catalog-products/{id}", {
        params: { path: { id: productId } },
      });
      return `${storeOrigin()}/configure/${data!.slug}?share=${encodeURIComponent(token)}`;
    } catch {
      // Without the product's slug, the account page still finds the quotation.
    }
  }
  return `${storeOrigin()}/account/quotes`;
}

/**
 * What staff do with a saved quotation (D-051, D-185): share it with the customer — a QT number
 * and a new link, the previous one revoked — stop sharing it, or re-price an expired one into a new
 * quotation at today's prices (the old one becomes superseded).
 */
export function QuoteActions({ quote }: { quote: Quote }) {
  const t = useTranslations("cs.quoteActions");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan("quotes.manage");
  const [open, setOpen] = useState<"share" | "unshare" | "reprice" | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  if (!canManage) return null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "quote") });
  const shared = Boolean(quote.sharedAt) && quote.status === "shared";
  const close = (next: boolean) => (next ? undefined : setOpen(null));
  const fail = (error: unknown): never => {
    toast.error(problemMessage(error, t("failed")));
    throw error;
  };
  return (
    <>
      {["saved", "shared"].includes(quote.status) ? (
        <Button variant="secondary" iconStart="link" onClick={() => setOpen("share")}>
          {shared ? t("shareAgain") : t("share")}
        </Button>
      ) : null}
      {shared ? (
        <Button variant="ghost" iconStart="ban" onClick={() => setOpen("unshare")}>
          {t("unshare")}
        </Button>
      ) : null}
      {quote.status === "expired" ? (
        <Button iconStart="refresh" onClick={() => setOpen("reprice")}>
          {t("reprice")}
        </Button>
      ) : null}

      <ConfirmAction
        open={open === "share"}
        onOpenChange={close}
        title={t("shareTitle")}
        description={shared ? t("shareAgainBody") : t("shareBody", { until: format.date(quote.validUntil) })}
        confirmLabel={t("share")}
        onConfirm={async () => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/quotes/{quoteId}/actions/share", {
              params: { path: { quoteId: quote.id } },
            });
            setLink({ url: await shareUrl(quote, data!.shareToken), expiresAt: data!.expiresAt });
            refresh();
          } catch (error) {
            fail(error);
          }
        }}
      />
      <ConfirmAction
        open={open === "unshare"}
        onOpenChange={close}
        title={t("unshareTitle")}
        description={t("unshareBody")}
        confirmLabel={t("unshare")}
        tone="destructive"
        onConfirm={async () => {
          try {
            await adminBrowserApis().contract.DELETE("/v1/admin/quotes/{quoteId}/share", {
              params: { path: { quoteId: quote.id } },
            });
            refresh();
            toast.success(t("unshared"));
          } catch (error) {
            fail(error);
          }
        }}
      />
      <ConfirmAction
        open={open === "reprice"}
        onOpenChange={close}
        title={t("repriceTitle")}
        description={t("repriceBody", { code: quote.quoteCode ?? "—" })}
        confirmLabel={t("reprice")}
        onConfirm={async () => {
          try {
            const { data } = await adminBrowserApis().contract.POST("/v1/admin/quotes/{quoteId}/actions/reprice", {
              params: { path: { quoteId: quote.id } },
            });
            refresh();
            toast.success(t("repriced"));
            router.push(`/quotations/${data!.id}`);
          } catch (error) {
            fail(error);
          }
        }}
      />
      {link ? (
        <Dialog
          open
          onOpenChange={(next) => (next ? undefined : setLink(null))}
          title={t("linkTitle")}
          description={t("linkBody", { until: format.dateTime(link.expiresAt) })}
          closeLabel={t("close")}
          footer={
            <Button
              iconStart="copy"
              onClick={() => {
                void navigator.clipboard.writeText(link.url);
                toast.success(t("copied"));
              }}
            >
              {t("copy")}
            </Button>
          }
        >
          <Input
            readOnly
            value={link.url}
            aria-label={t("linkTitle")}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * The levers the customer was shown against their target price (D-248, D-250): each a change —
 * more quantity, another material, no back print — with the saving it brings. Staff only read
 * them; reading never computes them.
 */
export function QuoteLevers({ quote }: { quote: Quote }) {
  const t = useTranslations("cs.levers");
  const format = useFormat();
  const levers = useQuery({
    enabled: Boolean(quote.targetPricePerUnit),
    queryKey: queryKeys.related("admin", "quote", quote.id, "levers"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/quotes/{quoteId}/levers", {
          params: { path: { quoteId: quote.id } },
        })
      ).data!,
  });
  if (!quote.targetPricePerUnit || !levers.data) return null;
  const data = levers.data;
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <span className="text-muted text-sm">
          {t("target", { price: format.thb(data.targetPricePerUnit) })}
          {data.status === "meets_target" ? (
            <Badge size="sm" tone="success" className="ms-2">
              {t("meetsTarget")}
            </Badge>
          ) : null}
        </span>
      </CardHeader>
      {!data.computedAt ? (
        <p className="text-muted text-sm">{t("notAsked")}</p>
      ) : data.levers.length === 0 ? (
        <p className="text-muted text-sm">{data.status === "not_instant" ? t("notInstant") : t("none")}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {data.levers.map((lever) => (
            <li
              key={lever.id}
              className="border-border flex flex-wrap items-baseline justify-between gap-2 border-t pt-2"
            >
              <span className="font-medium">
                {lever.rank}. {t(`kinds.${lever.kind}`)}
              </span>
              <span className="text-muted text-xs">{Object.keys(lever.changes).join(", ")}</span>
              <span className="tabular-nums">{t("saving", { pct: format.percent(lever.bestSavingPct) })}</span>
              {lever.takenQuoteId ? (
                <Badge size="sm" tone="info">
                  {t("taken")}
                </Badge>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {data.computedAt ? (
        <p className="text-muted mt-2 text-xs">{t("computedAt", { at: format.dateTime(data.computedAt) })}</p>
      ) : null}
    </Card>
  );
}
