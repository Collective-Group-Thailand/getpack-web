"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { erpPost } from "./api";
import { SalesActions } from "./SalesActions";

type Quotation = Schemas["ErpQuotationDto"];

/**
 * What can be done with a quotation now (D-360): edit the draft, send it — the customer gets a link to read,
 * accept or decline it without an account — record the customer's answer, revise it, open the sales order,
 * cancel, print.
 */
export function QuotationActions({ quotation, etag }: { quotation: Quotation; etag: string | null }) {
  const t = useTranslations("partnerSales.quotations.actions");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const router = useRouter();
  const [refresh] = useRefresh();
  const [dialog, setDialog] = useState<"send" | "accept" | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [poNo, setPoNo] = useState("");
  const [nameError, setNameError] = useState<string>();
  const params = { quotationId: quotation.id };
  const no = quotation.quoteNo;
  const open = (next: "send" | "accept") => {
    setKey(newIdempotencyKey());
    setLink(null);
    setDialog(next);
  };

  async function send() {
    setBusy(true);
    try {
      const result = await erpPost<{ url: string; expiresAt: string }>(
        factoryId,
        "/quotations/{quotationId}/actions/send",
        params,
        undefined,
        { idempotencyKey: key, etag },
      );
      setLink(result);
      toast.success(t("sent", { no }));
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (name.trim().length < 2) {
      setNameError(t("acceptNameRequired"));
      return;
    }
    setBusy(true);
    try {
      await erpPost(
        factoryId,
        "/quotations/{quotationId}/actions/accept",
        params,
        { name: name.trim(), position: position.trim() || null, customerPoNo: poNo.trim() || null },
        { idempotencyKey: key },
      );
      toast.success(t("accepted", { no }));
      setDialog(null);
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SalesActions
        layout="panel"
        offered={quotation.nextActions}
        etag={etag}
        actions={[
          {
            key: "erp_quote.order",
            kind: "post",
            primary: true,
            path: "/quotations/{quotationId}/actions/order",
            params,
            title: t("orderTitle"),
            description: t("orderBody", { no, customer: quotation.customer.name, total: format.thb(quotation.total) }),
            done: (r) => t("ordered", { no: (r as { soNo?: string }).soNo ?? "" }),
            next: (r) => `/sales-orders/${(r as { id: string }).id}`,
          },
          { key: "erp_quote.send", kind: "dialog", primary: true, open: () => open("send") },
          { key: "erp_quote.accept", kind: "dialog", open: () => open("accept") },
          { key: "erp_quote.edit", kind: "link", href: `/quotations/${quotation.id}/edit` },
          { key: "erp_quote.pdf", kind: "pdf", path: "/quotations/{quotationId}/pdf", params },
          {
            key: "erp_quote.revise",
            kind: "post",
            path: "/quotations/{quotationId}/actions/revise",
            params,
            title: t("reviseTitle"),
            description: t("reviseBody", { no, revision: quotation.revision + 1 }),
            done: t("revised"),
            next: (r) => `/quotations/${(r as { id: string }).id}/edit`,
          },
          {
            key: "erp_quote.reject",
            kind: "post",
            path: "/quotations/{quotationId}/actions/reject",
            params,
            body: (reason) => ({ reason }),
            title: t("rejectTitle"),
            description: t("rejectBody", { no, customer: quotation.customer.name }),
            reason: { label: t("rejectReason"), placeholder: t("rejectPlaceholder") },
            done: t("rejected"),
          },
          {
            key: "erp_quote.cancel",
            kind: "post",
            path: "/quotations/{quotationId}/actions/cancel",
            params,
            body: (reason) => ({ reason }),
            title: t("cancelTitle"),
            description: t("cancelBody", { no }),
            phrase: no,
            reason: { label: tCommon("reason"), placeholder: tCommon("reasonPlaceholder") },
            done: t("cancelled"),
          },
        ]}
      />

      {dialog === "send" ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("sendTitle", { no })}
          description={t("sendBody", { customer: quotation.customer.name })}
          closeLabel={tCommon("close")}
          footer={
            link ? (
              <Button onClick={() => (setDialog(null), router.refresh())}>{tCommon("done")}</Button>
            ) : (
              <Button iconStart="send" loading={busy} onClick={() => void send()}>
                {t("sendConfirm")}
              </Button>
            )
          }
        >
          {link ? (
            <div className="flex flex-col gap-3">
              <Field label={t("link")} hint={t("linkHint", { date: format.date(link.expiresAt) })}>
                <Input value={link.url} readOnly onFocus={(event) => event.currentTarget.select()} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  iconStart="copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link.url);
                    toast.success(t("copied"));
                  }}
                >
                  {t("copy")}
                </Button>
                <Button asChild variant="secondary" iconStart="chat">
                  <a
                    href={`https://line.me/R/share?text=${encodeURIComponent(t("lineText", { no, url: link.url }))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("shareLine")}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm">{quotation.linkActive ? t("sendAgain") : t("sendFirst")}</p>
          )}
        </Dialog>
      ) : null}

      {dialog === "accept" ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={t("acceptTitle", { no })}
          description={t("acceptBody", { customer: quotation.customer.name, total: format.thb(quotation.total) })}
          closeLabel={tCommon("close")}
          footer={
            <Button iconStart="check" loading={busy} onClick={() => void accept()}>
              {t("acceptConfirm")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("acceptName")} error={nameError} required requiredLabel={tCommon("required")}>
              <Input
                value={name}
                placeholder={t("acceptNamePlaceholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={t("acceptPosition")}>
              <Input value={position} onChange={(event) => setPosition(event.target.value)} />
            </Field>
            <Field label={t("acceptPo")}>
              <Input value={poNo} onChange={(event) => setPoNo(event.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
