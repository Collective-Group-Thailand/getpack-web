"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFactory } from "@/features/partner/context/FactoryProvider";
import { bangkokToday, useRefresh } from "@/features/partner/client";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { Select } from "@/ui/components/Select";
import { toast } from "@/ui/components/Toast";

export type ChangeRequestTopic = Schemas["FactoryChangeRequestTopic"];

const TOPICS = [
  "capability",
  "capacity",
  "delivery_zones",
  "tolerance",
  "participation_tier",
  "pricing_arrangement",
  "payout_policy",
  "site_visit",
  "other",
] as const satisfies readonly ChangeRequestTopic[];

/**
 * "Please change this" to the Partner team (`partner.changeRequests.create`). The factory never
 * edits what Packio records — capability, capacity, zones, tolerance, tier, visits (D-011, D-171) —
 * it asks, and the answer comes back on the requests list.
 *
 * `productTypes` offers a product type when the topic is about one (a tier, a capacity, a
 * tolerance override); `visit` asks for up to three dates the factory can host a site visit.
 */
export function ChangeRequestForm({
  topic: initialTopic,
  chooseTopic = false,
  productTypes = [],
  productTypeId,
  visit = false,
  placeholder,
  submitLabel,
  primary = false,
}: {
  topic: ChangeRequestTopic;
  /** Let the person pick what the request is about (the general requests screen). */
  chooseTopic?: boolean;
  productTypes?: { id: string; name: string }[];
  productTypeId?: string;
  visit?: boolean;
  placeholder?: string;
  submitLabel?: string;
  /** The page's main action (the requests page), not a side request beside another. */
  primary?: boolean;
}) {
  const t = useTranslations("partnerRequests.form");
  const tCommon = useTranslations("common");
  const { factoryId, can } = useFactory();
  const [refresh] = useRefresh();
  const [topic, setTopic] = useState<ChangeRequestTopic>(initialTopic);
  const [type, setType] = useState(productTypeId ?? productTypes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [dates, setDates] = useState(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  // Asking is the owner's (`factory_profile.manage`); everyone at the factory reads the answers.
  if (!can("factory_profile.manage")) return <p className="text-muted text-sm">{t("ownerOnly")}</p>;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const preferredDates = dates.filter(Boolean);
    if (message.trim().length < 3) return setError(t("messageTooShort"));
    if (visit && preferredDates.length === 0) return setError(t("dateRequired"));
    setBusy(true);
    setError(null);
    // CONTRACT-GAP partner.change-requests — a request names no product type, so the one it is about
    // leads the message, in the factory's own words.
    const typeName = productTypes.find((item) => item.id === type)?.name;
    const text = typeName ? t("aboutType", { type: typeName, message: message.trim() }) : message.trim();
    try {
      await browserApi().POST("/v1/partner/factories/{factoryId}/change-requests", {
        params: { path: { factoryId }, header: { "Idempotency-Key": key } },
        body: { topic, message: text.slice(0, 2000), ...(visit ? { preferredDates } : {}) },
      });
      setMessage("");
      setDates(["", "", ""]);
      setKey(newIdempotencyKey());
      toast.success(t("sent"));
      refresh();
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="flex flex-col gap-4" noValidate>
      {chooseTopic ? (
        <Field label={t("topic")}>
          <Select
            value={topic}
            onValueChange={setTopic}
            options={TOPICS.filter((key) => key !== "site_visit").map((key) => ({
              value: key,
              label: t(`topics.${key}`),
            }))}
          />
        </Field>
      ) : null}
      {productTypes.length > 1 && !productTypeId ? (
        <Field label={t("productType")}>
          <Select
            value={type}
            onValueChange={setType}
            options={productTypes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Field>
      ) : null}
      {visit ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">{t("dates")}</legend>
          <p className="text-muted text-sm">{t("datesHint")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {dates.map((value, index) => (
              <Field key={index} label={t("date", { n: index + 1 })}>
                <Input
                  type="date"
                  inputSize="lg"
                  min={bangkokToday(1)}
                  value={value}
                  onChange={(event) => setDates(dates.map((item, at) => (at === index ? event.target.value : item)))}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Field label={t("message")} required requiredLabel={tCommon("state.required")} error={error ?? undefined}>
        <Textarea
          rows={4}
          value={message}
          placeholder={placeholder}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1900}
        />
      </Field>
      <Button
        type="submit"
        size="xl"
        variant={primary ? "primary" : "secondary"}
        iconStart="send"
        loading={busy}
        className="self-start"
      >
        {submitLabel ?? t("send")}
      </Button>
    </form>
  );
}
