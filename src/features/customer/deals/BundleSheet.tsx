"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Deal } from "@/features/shared/deals/types";
import { useFormat } from "@/features/shared/format/useFormat";
import { dealP2Of } from "@/features/shared/loyalty-p2/read";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Sheet, SheetClose } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";

type DesignChoice = "own_file" | "hired_design";

/**
 * "เพิ่มชุดนี้ลงตะกร้า" (loyalty P2, D-494; prototype `p2-for-you.html`): the bundle's pieces — product, the preset as
 * the API words it, quantity and the API's VAT-inclusive unit price — each with its design choice ("ใช้ไฟล์ของฉัน"
 * by default), then `store.promotions.addBundle` under the cart's `ETag`, and on to the cart. There is no total: the
 * web adds no money; the note repeats the API's estimated saving and says the discount is decided in the cart.
 * A right-hand panel from 768 px, a bottom sheet below.
 */
export function BundleSheet({
  deal,
  onOpenChange,
  signedIn,
}: {
  deal: Deal | null;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
}) {
  const t = useTranslations("deals.bundle");
  const format = useFormat();
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, DesignChoice>>({});
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const bundle = deal ? dealP2Of(deal).bundle : null;
  const open = Boolean(deal && bundle);

  const add = async () => {
    if (!deal || !bundle) return;
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/deals/${deal.slug}`)}`);
      return;
    }
    setAdding(true);
    setProblem(null);
    try {
      const { response } = await browserApi().GET("/v1/store/cart");
      await browserRequests().call("POST /v1/store/promotions/{promotionId}/actions/add-bundle", {
        path: { promotionId: deal.id },
        etag: response.headers.get("etag") ?? undefined,
        body: { items: bundle.items.map((item) => ({ designOption: choices[item.productTypeCode] ?? "own_file" })) },
      });
      toast.success(t("added", { count: bundle.items.length }));
      onOpenChange(false);
      router.push("/cart");
    } catch (error) {
      if (isApiError(error) && error.code === "promotions.bundle_unavailable") {
        const names = error.errors
          .map((entry) => /^items\[(\d+)\]/.exec(entry.path)?.[1])
          .filter((index): index is string => index !== undefined)
          .map((index) => bundle.items[Number(index)]?.productTypeName)
          .filter(Boolean);
        setProblem(names.length ? t("unavailableItems", { items: names.join(", ") }) : t("unavailable"));
      } else if (isApiError(error) && error.status === 412) setProblem(t("stale"));
      else setProblem(isApiError(error) && error.status === 404 ? t("gone") : t("failed"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={deal?.headline ?? t("title")}
      closeLabel={t("close")}
      appearance="bare"
      className="md:inset-y-0 md:start-auto md:end-0 md:max-h-dvh md:w-[30rem]"
    >
      {deal && bundle ? (
        <div className="bg-surface shadow-overlay flex max-h-[92dvh] flex-col rounded-t-[1.125rem] md:h-dvh md:max-h-dvh md:rounded-none">
          <span aria-hidden="true" className="bg-border mx-auto mt-2 block h-1 w-9 shrink-0 rounded-full md:hidden" />
          <div className="border-border flex items-start justify-between gap-3 border-b px-5 pt-3 pb-4 md:px-[1.375rem] md:pt-5">
            <div className="min-w-0">
              <p className="text-muted text-[0.8125rem]">{t("eyebrow", { count: bundle.items.length })}</p>
              <p className="mt-0.5 text-[1.1875rem] leading-snug font-semibold">{deal.headline}</p>
            </div>
            <SheetClose asChild>
              <IconButton name="close" label={t("close")} size="sm" />
            </SheetClose>
          </div>

          <ol className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-5 py-1.5 md:px-[1.375rem]">
            {bundle.items.map((item, at) => (
              <li
                key={item.productTypeCode}
                className="border-border grid grid-cols-[1.625rem_minmax(0,1fr)] gap-x-2.5 py-4 not-last:border-b"
              >
                <span className="text-subtle pt-px text-[0.8125rem] tabular-nums">{at + 1}</span>
                <div className="min-w-0">
                  <p className="flex justify-between gap-3 text-[0.9375rem] font-semibold">
                    <span className="min-w-0">{item.productTypeName}</span>
                    <span className="shrink-0 tabular-nums">
                      {format.number(item.quantity)} {item.unit}
                    </span>
                  </p>
                  <p className="text-muted text-[0.8125rem]">{item.summary}</p>
                  <p className="text-muted text-[0.8125rem] tabular-nums">
                    {t("unitPrice", { price: format.thb(item.unitPrice), unit: item.unit })}
                  </p>
                  <SegmentedControl<DesignChoice>
                    className="mt-2.5"
                    size="sm"
                    label={t("design", { item: item.productTypeName })}
                    value={choices[item.productTypeCode] ?? "own_file"}
                    onValueChange={(value) => setChoices({ ...choices, [item.productTypeCode]: value })}
                    options={[
                      { value: "own_file", label: t("ownFile") },
                      { value: "hired_design", label: t("hiredDesign") },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ol>

          <div className="border-border flex flex-col gap-3 border-t px-5 pt-4 pb-5 md:px-[1.375rem]">
            <p className="text-muted flex items-start gap-2 text-[0.8125rem]">
              <Icon name="info" size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {bundle.estimatedSaving
                  ? t.rich("note", {
                      count: bundle.items.length,
                      saving: format.thb(bundle.estimatedSaving),
                      b: (chunk) => <b className="text-fg font-semibold tabular-nums">{chunk}</b>,
                    })
                  : t("noteNoSaving", { count: bundle.items.length })}
              </span>
            </p>
            {problem ? (
              <p role="alert" className="text-danger text-sm">
                {problem}
              </p>
            ) : null}
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button size="lg" loading={adding} onClick={() => void add()}>
                {signedIn ? t("confirm", { count: bundle.items.length }) : t("signIn")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
