"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { pick } from "@/features/customer/catalog/localize";
import { lineTrayItem } from "@/features/customer/products/quote-tray";
import { trayItemHref } from "@/features/customer/products/tray-flow";
import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { itemFacts } from "./summary";

type Basket = Schemas["RfqBasketDto"];

/**
 * The draft basket (U5.4 §1, D-301): the items added from RFQ forms, the delivery postcode, target
 * date and notes every item shares, and one submission — one RFQ per item, one conversation for
 * all of them. Removing an item is immediate and reversible by adding it again; discarding the
 * whole basket asks first.
 */
export function BasketDraft({ initial }: { initial: Basket }) {
  const t = useTranslations("quoteRequests.basket");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [basket, setBasket] = useState(initial);
  const [postcode, setPostcode] = useState(initial.deliveryPostcode ?? "");
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const submitKey = useRef(newIdempotencyKey());
  /** D-447 §10.9: the basket is sent only once every waiting product's form is filled. */
  const pending = basket.items.some((item) => item.formPending);

  async function remove(itemId: string) {
    setBusy(itemId);
    // Optimistic: the row goes at once and comes back if the API refuses (U5.7).
    const before = basket;
    setBasket({ ...basket, items: basket.items.filter((item) => item.id !== itemId) });
    try {
      const { data } = await browserApi().DELETE("/v1/store/rfq-baskets/draft/items/{itemId}", {
        params: { path: { itemId } },
      });
      setBasket(data!);
    } catch (error) {
      setBasket(before);
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{5}$/.test(postcode)) {
      setErrors({ deliveryPostcode: t("postcodeInvalid") });
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy("submit");
    try {
      const api = browserApi();
      await api.PATCH("/v1/store/rfq-baskets/draft", {
        body: { deliveryPostcode: postcode, targetDate: targetDate || null, notes: notes.trim() },
      });
      const { data } = await api.POST("/v1/store/rfq-baskets/draft/actions/submit", {
        params: { header: { "Idempotency-Key": submitKey.current } },
      });
      router.push(`/account/rfq-baskets/${data!.id}?submitted=1`);
    } catch (error) {
      if (isApiError(error)) submitKey.current = newIdempotencyKey();
      if (isApiError(error) && error.errors.length)
        setErrors(Object.fromEntries(error.errors.map((item) => [item.path, item.message])));
      setFailure(isApiError(error) ? error.detail : t("failed"));
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    try {
      await browserApi().POST("/v1/store/rfq-baskets/draft/actions/discard");
      toast.success(t("discarded"));
      router.push("/account/rfqs");
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
      setBusy(null);
    }
  }

  if (basket.items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title={t("empty.title")}
        description={t("empty.body")}
        action={
          <Button asChild>
            <Link href="/products">{t("empty.action")}</Link>
          </Button>
        }
      />
    );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <section aria-labelledby="basket-items">
        <h2 id="basket-items" className="text-lg font-semibold">
          {t("items", { count: basket.items.length })}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {basket.items.map((item, index) => {
            const facts = itemFacts(item);
            // D-447 §10.9: a product put in from the quote tray waits for its form; the link opens it.
            const waiting = lineTrayItem(item);
            return (
              <li
                key={item.id}
                className="bg-surface border-border flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {index + 1}.{" "}
                    {item.product
                      ? pick(locale, item.product.nameTh, item.product.nameEn)
                      : pick(locale, item.productType.nameTh, item.productType.nameEn)}
                  </p>
                  {waiting ? (
                    <p className="text-muted text-sm">
                      {t("pending")}
                      {" · "}
                      <Link href={trayItemHref(waiting)} className="text-primary font-medium underline">
                        {t("fill")}
                      </Link>
                    </p>
                  ) : (
                    <p className="text-muted text-sm">
                      {facts.size
                        ? t("size", {
                            l: format.number(facts.size[0]),
                            w: format.number(facts.size[1]),
                            h: facts.size[2] === null ? "—" : format.number(facts.size[2]),
                          })
                        : t("noSize")}
                      {" · "}
                      {t("quantities", { list: facts.quantities.map((q) => format.number(q)).join(", ") })}
                      {" · "}
                      {t("answers", { count: facts.answers })}
                    </p>
                  )}
                  {itemError(errors, index) ? (
                    <p className="text-danger mt-1 text-sm">{itemError(errors, index)}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  iconStart="trash"
                  loading={busy === item.id}
                  onClick={() => void remove(item.id)}
                  aria-label={t("removeItem", { n: index + 1 })}
                >
                  {t("remove")}
                </Button>
              </li>
            );
          })}
        </ol>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link href="/products">{t("addMore")}</Link>
        </Button>
      </section>

      <section aria-labelledby="basket-details" className="flex flex-col gap-4">
        <h2 id="basket-details" className="text-lg font-semibold">
          {t("details")}
        </h2>
        <p className="text-muted text-sm">{t("detailsHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("postcode")} error={errors.deliveryPostcode} required requiredLabel={t("required")}>
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={postcode}
              onChange={(event) => setPostcode(event.target.value.trim())}
            />
          </Field>
          <Field label={t("targetDate")} hint={t("targetDateHint")}>
            <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </Field>
        </div>
        <Field label={t("notes")}>
          <Textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </section>

      {pending ? <Callout tone="warning" title={t("pendingHint")} /> : null}
      {failure ? <Callout tone="danger" title={failure} /> : null}

      <div className="bg-surface border-border sticky bottom-0 flex flex-wrap items-center gap-3 border-t py-3 md:static md:border-0">
        <Button
          type="submit"
          size="lg"
          loading={busy === "submit"}
          disabled={pending || (busy !== null && busy !== "submit")}
        >
          {t("submit", { count: basket.items.length })}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setDiscarding(true)} disabled={busy !== null}>
          {t("discard")}
        </Button>
      </div>

      <AlertDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("discardTitle")}
        description={t("discardBody", { count: basket.items.length })}
        confirmLabel={t("discard")}
        cancelLabel={t("keep")}
        tone="destructive"
        loading={busy === "discard"}
        onConfirm={() => void discard()}
      />
    </form>
  );
}

/** An item's refusal, wherever under `items[i]` the API put it (D-301: "errors under items[i]"). */
function itemError(errors: Record<string, string>, index: number): string | null {
  const prefix = `items[${index}]`;
  const key = Object.keys(errors).find((path) => path === prefix || path.startsWith(`${prefix}.`));
  return key ? errors[key]! : null;
}
