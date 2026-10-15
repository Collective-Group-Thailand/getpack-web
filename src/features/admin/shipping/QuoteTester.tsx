"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, Section } from "../console";
import { POSTCODE, startOfDay, today } from "./rates";

/**
 * What a customer would pay to ship a parcel (`admin.customerShippingRates.quote`, D-013): the
 * version in force on a date, the postcode's zone and the matching band — or why nothing applies.
 * A check before a new version is submitted, and the answer to "why did this quote cost that".
 */
export function QuoteTester() {
  const t = useTranslations("shipping.quote");
  const format = useFormat();
  const [postcode, setPostcode] = useState("");
  const [kg, setKg] = useState("1");
  const [volume, setVolume] = useState("");
  const [at, setAt] = useState(today);
  const quote = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/shipping/customer-rate-card/actions/quote", {
          body: {
            postcode: postcode.trim(),
            weightG: Math.round(Number(kg) * 1000),
            volumeCm3: volume.trim() ? Math.trunc(Number(volume)) : null,
            at: at === today() ? undefined : startOfDay(at),
          },
        })
      ).data!,
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });
  const ready = POSTCODE.test(postcode.trim()) && Number(kg) > 0;
  const result = quote.data;
  return (
    <Section title={t("title")} description={t("intro")}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) quote.mutate();
        }}
      >
        <Field label={t("postcode")} className="w-32">
          <Input inputMode="numeric" maxLength={5} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        </Field>
        <Field label={t("weight")} className="w-32">
          <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
        </Field>
        <Field label={t("volume")} className="w-36">
          <Input inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </Field>
        <Field label={t("at")} className="w-44">
          <Input type="date" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={!ready} loading={quote.isPending}>
          {t("run")}
        </Button>
      </form>
      {result ? (
        <Callout
          className="mt-3"
          tone={result.priced ? "success" : "warning"}
          title={
            result.priced
              ? t("priced", { amount: format.thb(result.netAmount) })
              : t(`miss.${result.reason ?? "no_band"}`)
          }
        >
          {result.zoneCode ? t("zone", { zone: result.zoneCode }) : null}
        </Callout>
      ) : null}
    </Section>
  );
}
