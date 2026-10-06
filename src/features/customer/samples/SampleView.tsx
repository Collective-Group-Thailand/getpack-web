"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useFileUrl } from "@/features/customer/files/files";
import { formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { SampleDecision, type SampleCheck } from "./SampleDecision";

type Sample = Schemas["SampleDto"];

/** An evidence photo through its signed URL. */
function Photo({ id, alt }: { id: string; alt: string }) {
  const url = useFileUrl(id);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the API's file host
    <img src={url} alt={alt} className="border-border h-36 w-48 rounded-md border object-cover" />
  ) : (
    <span className="bg-bg-subtle block h-36 w-48 rounded-md" aria-hidden="true" />
  );
}

/**
 * One sample, as the customer acts on it (U2.F3, D-253–D-257): the sample quotation to buy, what
 * the factory measured and photographed, the decision — approve after checking dimensions, colour,
 * material and construction (the API keeps who, when and the photos seen), ask for changes, or
 * reject — and, once approved, the bulk order with the locked specification and the credit as the API
 * states it. Every figure is the API's.
 */
export function SampleView({ sample }: { sample: Sample }) {
  const t = useTranslations("myOrders.samples.detail");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    setProblem(null);
    try {
      await action();
      after?.();
      router.refresh();
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const path = { params: { path: { sampleId: sample.id } } };
  const buy = () =>
    run("buy", async () => {
      // The cart is edited under its ETag.
      const { response } = await browserApi().GET("/v1/store/cart");
      await browserApi().POST("/v1/store/cart/items", {
        params: { header: { "If-Match": response.headers.get("etag") ?? "" } },
        body: {
          quoteId: sample.quotation!.quoteId,
          quoteOptionId: sample.quotation!.optionId,
          designOption: "own_file",
        },
      });
      router.push("/cart");
    });
  const approve = (input: { checked: SampleCheck[]; note: string }) =>
    run(
      "approve",
      () =>
        browserApi().POST("/v1/store/samples/{sampleId}/actions/approve", {
          ...path,
          // The checklist confirmed goes with the decision's note (the API keeps the note with the evidence seen).
          body: {
            note: [t("checkedNote", { items: input.checked.map((c) => t(`checks.${c}`)).join(", ") }), input.note]
              .filter(Boolean)
              .join("\n"),
          },
        }),
      () => toast.success(t("approved")),
    );
  const decide = (action: "reject" | "request-changes", note: string) =>
    run(action, () =>
      action === "reject"
        ? browserApi().POST("/v1/store/samples/{sampleId}/actions/reject", { ...path, body: { note } })
        : browserApi().POST("/v1/store/samples/{sampleId}/actions/request-changes", {
            ...path,
            body: { note: note.trim() },
          }),
    );
  const orderBulk = () =>
    run("bulk", async () => {
      const { data } = await browserApi().POST("/v1/store/samples/{sampleId}/actions/order-bulk", {
        ...path,
        body: { quantity: Math.round(Number(quantity)) },
      });
      toast.success(data!.creditAvailable ? t("bulkWithCredit") : t("bulkAdded"));
      router.push("/cart");
    });

  const config = sample.configuration as Record<string, unknown>;
  const spec = [
    typeof config.l === "number" && typeof config.w === "number"
      ? {
          term: t("size"),
          description:
            [config.l, config.w, config.d]
              .filter((n) => typeof n === "number")
              .map((n) => formatNumber(n as number, locale))
              .join(" × ") + ` ${t("mm")}`,
        }
      : null,
    typeof config.material === "string" ? { term: t("material"), description: config.material } : null,
    { term: t("kind"), description: t(`mockup.${sample.mockupOption}`) },
    { term: t("quantity"), description: formatNumber(sample.quantity, locale) },
  ].filter((x): x is { term: string; description: string } => x !== null);
  const evidence = sample.evidence;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sample-spec" className="flex flex-col gap-3">
        <h2 id="sample-spec" className="text-lg font-semibold">
          {sample.status === "approved" ? t("lockedSpec") : t("spec")}
        </h2>
        <DescriptionList items={spec} columns={2} />
        {sample.status === "approved" ? <p className="text-muted text-sm">{t("lockedHint")}</p> : null}
      </section>

      {sample.status === "quoted" && sample.quotation ? (
        <section aria-labelledby="sample-quote" className="border-border flex flex-col gap-2 rounded-xl border p-4">
          <h2 id="sample-quote" className="text-lg font-semibold">
            {t("quoteTitle")}
          </h2>
          {sample.sellGrossAmount ? (
            <p className="serif text-3xl tabular-nums">{formatTHB(sample.sellGrossAmount, locale)}</p>
          ) : null}
          <p className="text-muted text-sm">
            {[
              sample.leadTimeDays !== null ? t("leadTime", { days: sample.leadTimeDays }) : null,
              sample.validUntil ? t("validUntil", { date: formatDate(sample.validUntil, locale) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-muted text-sm">{t("creditRule")}</p>
          <div>
            <Button loading={busy === "buy"} onClick={() => void buy()}>
              {t("buy")}
            </Button>
          </div>
        </section>
      ) : null}

      {sample.status === "requested" ? <Callout tone="info" title={t("waitingQuote")} /> : null}

      {evidence.recordedAt ? (
        <section aria-labelledby="sample-evidence" className="flex flex-col gap-3">
          <h2 id="sample-evidence" className="text-lg font-semibold">
            {t("evidenceTitle")}
          </h2>
          <p className="text-muted text-sm">
            {t("evidenceIntro", { date: formatDateTime(evidence.recordedAt, locale) })}
          </p>
          <DescriptionList
            columns={2}
            items={[
              {
                term: t("measured", { basis: evidence.basis ? t(`bases.${evidence.basis}`) : "" }),
                description:
                  [evidence.lengthMm, evidence.widthMm, evidence.depthMm].filter(Boolean).join(" × ") + ` ${t("mm")}`,
              },
              { term: t("materialUsed"), description: evidence.materialUsed ?? "—" },
            ]}
          />
          <ul className="flex flex-wrap gap-3">
            {evidence.photos.map((p, i) => (
              <li key={p.id} className="flex flex-col gap-1">
                <Photo id={p.id} alt={t("photo", { n: i + 1 })} />
                {p.sha256 ? (
                  <span className="text-muted font-mono text-[11px]">{t("sha", { hash: p.sha256.slice(0, 12) })}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sample.status === "delivered" ? (
        <SampleDecision
          busy={busy === "approve" || busy === "reject" || busy === "request-changes" ? busy : null}
          onDecide={(kind, input) => (kind === "approve" ? void approve(input) : void decide(kind, input.note))}
        />
      ) : null}

      {sample.decision ? (
        <section aria-labelledby="sample-decision" className="flex flex-col gap-2">
          <h2 id="sample-decision" className="text-lg font-semibold">
            {t("decisionTitle")}
          </h2>
          <p className="text-sm">{t("decidedAt", { date: formatDateTime(sample.decision.decidedAt, locale) })}</p>
          {sample.decision.note ? <p className="text-sm whitespace-pre-line">{sample.decision.note}</p> : null}
          {sample.decision.evidencePhotoSha256.length ? (
            <p className="text-muted text-xs">
              {t("photosSeen", { count: sample.decision.evidencePhotoSha256.length })}
            </p>
          ) : null}
        </section>
      ) : null}

      {sample.status === "approved" ? (
        <section aria-labelledby="sample-bulk" className="border-border flex flex-col gap-3 rounded-xl border p-4">
          <h2 id="sample-bulk" className="text-lg font-semibold">
            {t("bulkTitle")}
          </h2>
          {sample.credit?.availableUntil ? (
            <Callout tone="success" title={t("credit", { date: formatDate(sample.credit.availableUntil, locale) })}>
              {sample.credit.creditAmount ? (
                <p className="text-sm">
                  {t("creditAmount", { amount: formatTHB(sample.credit.creditAmount, locale) })}
                </p>
              ) : null}
            </Callout>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("bulkQuantity")} className="w-40">
              <Input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <Button
              loading={busy === "bulk"}
              disabled={!/^\d{1,7}$/.test(quantity) || Number(quantity) < 1}
              onClick={() => void orderBulk()}
            >
              {t("bulk")}
            </Button>
          </div>
          <p className="text-muted text-xs">{t("bulkHint")}</p>
        </section>
      ) : null}

      {problem ? <Callout tone="danger" title={problem} /> : null}
    </div>
  );
}
