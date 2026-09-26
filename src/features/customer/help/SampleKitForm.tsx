"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";
import { RadioCards } from "@/ui/components/RadioCards";

type Kit = ResponseOf<Requests, "GET /v1/store/sample-kits">["data"][number];
type Result = ResponseOf<Requests, "POST /v1/store/sample-kits/actions/request">;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/** Ordering a sample kit (F3 3.7): pick a kit, say where to send it. The price is the API's. */
export function SampleKitForm({ kits }: { kits: Kit[] }) {
  const t = useTranslations("help.samples");
  const format = useFormat();
  const available = kits.filter((kit) => kit.available);
  const [kitCode, setKitCode] = useState(available[0]?.code);
  const [form, setForm] = useState({
    recipientName: "",
    company: "",
    phone: "",
    email: "",
    line1: "",
    district: "",
    province: "",
    postcode: "",
    interest: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.recipientName.trim()) found.recipientName = t("errors.name");
    if (!/^0\d{8,9}$/.test(form.phone)) found.phone = t("errors.phone");
    if (!form.line1.trim()) found.line1 = t("errors.line1");
    if (!form.province.trim()) found.province = t("errors.province");
    if (!/^\d{5}$/.test(form.postcode)) found.postcode = t("errors.postcode");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || !kitCode) return;
    setBusy(true);
    try {
      setResult(
        await browserRequests().call("POST /v1/store/sample-kits/actions/request", {
          body: {
            kitCode,
            ...(form.company.trim() ? { company: form.company.trim() } : {}),
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
            ...(form.interest.trim() ? { interest: form.interest.trim() } : {}),
            address: {
              recipientName: form.recipientName.trim(),
              phone: form.phone,
              line1: form.line1.trim(),
              ...(form.district.trim() ? { district: form.district.trim() } : {}),
              province: form.province.trim(),
              postcode: form.postcode,
            },
          },
          idempotencyKey: key.current,
        }),
      );
    } catch (error) {
      key.current = newKey();
      setFailure(
        isApiError(error) && error.status === 429 ? t("rateLimited") : isApiError(error) ? error.detail : t("failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (result)
    return (
      <Callout tone="success" title={t("sentTitle", { request: result.requestNo })} role="status">
        <p>{t("sent", { date: format.date(result.shipsBy) })}</p>
        {result.payUrl ? (
          <a href={result.payUrl} className="mt-2 inline-block underline underline-offset-4">
            {t("pay")}
          </a>
        ) : null}
      </Callout>
    );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}
      <Field label={t("kit")}>
        <RadioCards
          columns={2}
          value={kitCode}
          onValueChange={setKitCode}
          options={available.map((kit) => ({
            value: kit.code,
            label: t("kitLabel", { name: kit.name, price: kit.price === "0.00" ? t("free") : format.thb(kit.price) }),
            description: kit.creditedOnFirstOrder
              ? t("credited", { days: kit.leadDays })
              : t("lead", { days: kit.leadDays }),
          }))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("recipient")} required requiredLabel={t("required")} error={errors.recipientName}>
          <Input
            autoComplete="name"
            value={form.recipientName}
            onChange={(event) => set("recipientName")(event.target.value)}
          />
        </Field>
        <Field label={t("company")}>
          <Input
            autoComplete="organization"
            value={form.company}
            onChange={(event) => set("company")(event.target.value)}
          />
        </Field>
        <Field label={t("phone")} required requiredLabel={t("required")} error={errors.phone}>
          <PhoneInput value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label={t("email")}>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => set("email")(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("line1")} required requiredLabel={t("required")} error={errors.line1}>
        <Input
          autoComplete="street-address"
          value={form.line1}
          onChange={(event) => set("line1")(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("district")}>
          <Input value={form.district} onChange={(event) => set("district")(event.target.value)} />
        </Field>
        <Field label={t("province")} required requiredLabel={t("required")} error={errors.province}>
          <Input
            autoComplete="address-level1"
            value={form.province}
            onChange={(event) => set("province")(event.target.value)}
          />
        </Field>
        <Field label={t("postcode")} required requiredLabel={t("required")} error={errors.postcode}>
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={form.postcode}
            onChange={(event) => set("postcode")(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <Field label={t("interest")} hint={t("interestHint")}>
        <Textarea
          rows={3}
          maxLength={1000}
          value={form.interest}
          onChange={(event) => set("interest")(event.target.value)}
        />
      </Field>
      <Button type="submit" className="self-start" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
