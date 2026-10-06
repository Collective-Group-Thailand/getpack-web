"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

/**
 * "ขอตัวอย่างก่อนสั่งผลิต" on a saved quotation (U2.F3, D-253): printed or plain, how many, a note for
 * CS. Packio's CS quotes it (price, freight, lead time) and the customer buys it like a quotation.
 */
export function RequestSample({ quoteId, label }: { quoteId: string; label: string }) {
  const t = useTranslations("myOrders.samples.request");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" iconStart="package-check" onClick={() => setOpen(true)}>
        {t("open")}
        <span className="sr-only"> {label}</span>
      </Button>
      <RequestSampleDialog quoteId={quoteId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The request itself, opened from a saved quotation's row or straight from the configurator's dock
 * (U5.8, T5). The postcode starts from the configuration's own, else from the customer's default
 * delivery address (D-298), read when the dialog opens — a default accepted costs no step.
 */
export function RequestSampleDialog({
  quoteId,
  open,
  onOpenChange,
  defaultPostcode = "",
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPostcode?: string;
}) {
  const t = useTranslations("myOrders.samples.request");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [mockup, setMockup] = useState<"with_print" | "without_print">("with_print");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [postcode, setPostcode] = useState(/^\d{5}$/.test(defaultPostcode) ? defaultPostcode : "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const looked = useRef(false);

  useEffect(() => {
    if (!open || looked.current || postcode !== "") return;
    looked.current = true;
    void browserApi()
      .GET("/v1/store/addresses", { params: { query: { perPage: 100 } } })
      .then(({ data }) => {
        const delivery = data?.data.filter((address) => address.kind === "delivery") ?? [];
        const found = (delivery.find((address) => address.isDefault) ?? delivery[0])?.postcode;
        // Never over what the customer has started typing.
        if (found) setPostcode((typed) => typed || found);
      })
      .catch(() => undefined);
  }, [open, postcode]);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { data } = await browserApi().POST("/v1/store/samples", {
        body: {
          quoteId,
          mockupOption: mockup,
          quantity: Math.max(1, Math.round(Number(quantity) || 1)),
          // Where it goes: the sample's freight is priced from it (found on the real API).
          deliveryPostcode: postcode,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      router.push(`/account/samples/${data!.id}`);
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !busy && onOpenChange(false)}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      footer={
        <Button loading={busy} disabled={!/^\d{5}$/.test(postcode)} onClick={() => void send()}>
          {t("send")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <RadioCards
          aria-label={t("kind")}
          columns={2}
          value={mockup}
          onValueChange={(value) => setMockup(value as typeof mockup)}
          options={[
            { value: "with_print", label: t("withPrint"), description: t("withPrintHint") },
            { value: "without_print", label: t("withoutPrint"), description: t("withoutPrintHint") },
          ]}
        />
        <Field label={t("quantity")}>
          <Input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </Field>
        <Field label={t("postcode")} hint={t("postcodeHint")}>
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={postcode}
            onChange={(event) => setPostcode(event.target.value.trim())}
          />
        </Field>
        <Field label={t("note")} hint={t("noteHint")}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} />
        </Field>
        {problem ? <Callout tone="danger" title={problem} /> : null}
      </div>
    </Dialog>
  );
}
