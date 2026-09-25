"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { Select } from "@/ui/components/Select";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { problemMessage, QueryError } from "../console";

type DesignOption = "own_file" | "online_designer" | "hired_design" | "free_design";
type MockupOption = "none" | "with_print" | "without_print";

/**
 * CS places an order on a customer's behalf (F2 2.2, B3.1, legacy `create_order_modal`), from a
 * saved quotation: where it goes (split across addresses, which must add up to the quantity), who
 * the tax invoice is for, how the artwork arrives, and the PO number.
 *
 * One idempotency key for the life of this form: a double click, or a retry after a timeout,
 * creates one order group, not two (api-conventions §3).
 */
export function CreateOrder({ quoteId, quantity }: { quoteId: string; quantity: number }) {
  const t = useTranslations("cs.createOrder");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [split, setSplit] = useState<Record<string, number>>({});
  const [taxProfileId, setTaxProfileId] = useState<string>("none");
  const [designOption, setDesignOption] = useState<DesignOption>("own_file");
  const [mockupOption, setMockupOption] = useState<MockupOption>("none");
  const [poNumber, setPoNumber] = useState("");
  const [cc, setCc] = useState("");
  const [remarks, setRemarks] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  const quote = useQuery({
    queryKey: queryKeys.detail("admin", "quote", quoteId),
    queryFn: () => browserRequests().call("GET /v1/admin/quotations/{quoteId}", { path: { quoteId } }),
  });
  const customerId = quote.data?.customer.id;
  const customer = useQuery({
    queryKey: queryKeys.detail("admin", "customer", customerId ?? ""),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/customers/{customerId}", { path: { customerId: customerId! } }),
    enabled: Boolean(customerId),
  });

  const ccList = cc.split(/[,\s]+/).filter(Boolean);
  const destinations = Object.entries(split).filter(([, value]) => value > 0);
  const total = destinations.reduce((sum, [, value]) => sum + value, 0);

  const place = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/orders", {
        body: {
          quoteId,
          quantity,
          customerId: customerId!,
          destinations: destinations.map(([addressId, value]) => ({ addressId, quantity: value })),
          taxProfileId: taxProfileId === "none" ? null : taxProfileId,
          designOption,
          mockupOption,
          ...(poNumber ? { poNumber } : {}),
          ccEmails: ccList,
          ...(remarks ? { csRemarks: remarks } : {}),
        },
        idempotencyKey,
      }),
    onSuccess: (created) => {
      toast.success(t("placed", { code: created.groupCode }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource("admin", "order") });
      const first = created.orders[0];
      router.push(first ? `/orders/${first.id}` : "/orders");
    },
  });

  if (quote.isError) return <QueryError error={quote.error} onRetry={() => void quote.refetch()} />;
  if (!quote.data || !customer.data) return <Skeleton className="h-96" />;

  const option = quote.data.options.find((candidate) => candidate.quantity === quantity) ?? quote.data.options[0]!;
  const addresses = customer.data.addresses.filter((address) => address.kind === "delivery");
  const juristic = customer.data.customerType !== "individual";
  const ready = total === quantity && destinations.length > 0 && ccList.every((email) => /^\S+@\S+\.\S+$/.test(email));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <Card padding="lg">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>{t("destinations")}</CardTitle>
            <Button variant="secondary" size="sm" iconStart="plus" onClick={() => setAddingAddress(true)}>
              {t("addAddress")}
            </Button>
          </CardHeader>
          <p className="text-muted mb-3 text-sm">{t("destinationsHint", { quantity: format.number(quantity) })}</p>
          {addresses.length === 0 ? (
            <Callout tone="warning" title={t("noAddress")} />
          ) : (
            <ul className="flex flex-col gap-3">
              {addresses.map((address) => (
                <li
                  key={address.id}
                  className="border-border flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {address.label}
                      {" · "}
                      {address.recipientName}
                    </p>
                    <p className="text-muted">
                      {[address.line1, address.line2, address.district, address.province, address.postcode]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>
                  <Field label={t("quantityFor", { label: address.label })} className="w-40">
                    <NumberInput
                      min={0}
                      max={quantity}
                      value={split[address.id] ?? ""}
                      onChange={(event) =>
                        setSplit({ ...split, [address.id]: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                  </Field>
                </li>
              ))}
            </ul>
          )}
          <p
            className={total === quantity ? "text-success mt-3 text-sm" : "text-warning-subtle-fg mt-3 text-sm"}
            aria-live="polite"
          >
            {t("allocated", { allocated: format.number(total), quantity: format.number(quantity) })}
          </p>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            <Field label={t("taxProfile")} hint={juristic ? t("taxHintJuristic") : t("taxHint")}>
              <Select
                value={taxProfileId}
                onValueChange={setTaxProfileId}
                options={[
                  { value: "none", label: t("noTaxInvoice") },
                  ...customer.data.taxProfiles.map((profile) => ({
                    value: profile.id,
                    label: `${profile.name} · ${profile.taxId}`,
                  })),
                ]}
              />
            </Field>
            <Field label={t("design")}>
              <RadioCards
                value={designOption}
                onValueChange={(value) => setDesignOption(value as DesignOption)}
                options={(["own_file", "online_designer", "hired_design"] as const).map((value) => ({
                  value,
                  label: t(`designOptions.${value}`),
                  description: t(`designHints.${value}`),
                }))}
              />
            </Field>
            <Field label={t("mockup")} hint={t("mockupHint")}>
              <Select
                value={mockupOption}
                onValueChange={(value) => setMockupOption(value as MockupOption)}
                options={(["none", "with_print", "without_print"] as const).map((value) => ({
                  value,
                  label: t(`mockupOptions.${value}`),
                }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("po")}>
                <Input value={poNumber} maxLength={60} onChange={(event) => setPoNumber(event.target.value)} />
              </Field>
              <Field
                label={t("cc")}
                hint={t("ccHint")}
                error={ccList.every((email) => /^\S+@\S+\.\S+$/.test(email)) ? undefined : t("ccInvalid")}
              >
                <Input value={cc} onChange={(event) => setCc(event.target.value)} />
              </Field>
            </div>
            <Field label={t("remarks")} hint={t("remarksHint")}>
              <Textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      <Card padding="lg" className="self-start">
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <DescriptionList
          columns={1}
          items={[
            { term: t("customer"), description: `${customer.data.displayName} · ${customer.data.customerCode}` },
            { term: t("quote"), description: <span className="font-mono">{quote.data.quoteCode}</span> },
            { term: t("quantity"), description: format.number(option.quantity) },
            {
              term: t("total"),
              description: <span className="font-semibold tabular-nums">{format.thb(option.grossAmount)}</span>,
            },
            { term: t("validUntil"), description: format.date(quote.data.validUntil) },
          ]}
        />
        {place.error ? (
          <Callout tone="danger" title={problemMessage(place.error, t("failed"))} className="mt-4">
            {isApiError(place.error) ? place.error.errors.map((item) => item.message).join(" ") : null}
          </Callout>
        ) : null}
        <Button
          className="mt-4 w-full"
          iconStart="cart"
          loading={place.isPending}
          disabled={!ready}
          onClick={() => place.mutate()}
        >
          {t("place")}
        </Button>
        <p className="text-muted mt-2 text-xs">{t("placeHint")}</p>
      </Card>

      {addingAddress ? (
        <AddAddressDialog
          customerId={customer.data.id}
          onClose={() => setAddingAddress(false)}
          onAdded={() => {
            setAddingAddress(false);
            void customer.refetch();
          }}
          closeLabel={tCommon("actions.close")}
        />
      ) : null}
    </div>
  );
}

function AddAddressDialog({
  customerId,
  onClose,
  onAdded,
  closeLabel,
}: {
  customerId: string;
  onClose: () => void;
  onAdded: () => void;
  closeLabel: string;
}) {
  const t = useTranslations("cs.address");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState({
    label: "",
    recipientName: "",
    phone: "",
    line1: "",
    line2: "",
    postcode: "",
    district: "",
    subdistrict: "",
  });
  const lookup = useQuery({
    queryKey: queryKeys.detail("admin", "postcode", values.postcode),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/geo/postcodes/{postcode}", { path: { postcode: values.postcode } }),
    enabled: /^\d{5}$/.test(values.postcode),
    retry: false,
  });
  const districts = lookup.data?.districts ?? [];
  const subdistricts = districts.find((district) => district.name === values.district)?.subdistricts ?? [];

  const add = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/customers/{customerId}/addresses", {
        path: { customerId },
        body: {
          kind: "delivery",
          label: values.label,
          recipientName: values.recipientName,
          phone: values.phone,
          line1: values.line1,
          line2: values.line2 || null,
          postcode: values.postcode,
          province: lookup.data!.province,
          ...(values.district ? { district: values.district } : {}),
          ...(values.subdistrict ? { subdistrict: values.subdistrict } : {}),
        },
      }),
    onSuccess: onAdded,
  });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [key]: event.target.value });
  const ready = values.label && values.recipientName && /^0\d{8,9}$/.test(values.phone) && values.line1 && lookup.data;

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      closeLabel={closeLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!ready}>
            {tCommon("actions.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {add.error ? (
          <Callout tone="danger" title={problemMessage(add.error, t("failed"))} className="sm:col-span-2" />
        ) : null}
        <Field label={t("label")} required requiredLabel={tCommon("state.required")}>
          <Input value={values.label} onChange={set("label")} />
        </Field>
        <Field label={t("recipient")} required requiredLabel={tCommon("state.required")}>
          <Input value={values.recipientName} onChange={set("recipientName")} />
        </Field>
        <Field label={t("phone")} required requiredLabel={tCommon("state.required")}>
          <Input inputMode="tel" value={values.phone} onChange={set("phone")} />
        </Field>
        <Field
          label={t("postcode")}
          hint={lookup.data?.province ?? (lookup.isError ? t("postcodeUnknown") : undefined)}
          required
          requiredLabel={tCommon("state.required")}
        >
          <Input
            inputMode="numeric"
            maxLength={5}
            value={values.postcode}
            onChange={(event) =>
              setValues({ ...values, postcode: event.target.value.replace(/\D/g, ""), district: "", subdistrict: "" })
            }
          />
        </Field>
        <Field label={t("line1")} required requiredLabel={tCommon("state.required")} className="sm:col-span-2">
          <Input value={values.line1} onChange={set("line1")} />
        </Field>
        <Field label={t("line2")} className="sm:col-span-2">
          <Input value={values.line2} onChange={set("line2")} />
        </Field>
        {districts.length > 0 ? (
          <>
            <Field label={t("district")}>
              <Select
                value={values.district || undefined}
                onValueChange={(district) => setValues({ ...values, district, subdistrict: "" })}
                placeholder={t("choose")}
                options={districts.map((district) => ({ value: district.name, label: district.name }))}
              />
            </Field>
            <Field label={t("subdistrict")}>
              <Select
                value={values.subdistrict || undefined}
                onValueChange={(subdistrict) => setValues({ ...values, subdistrict })}
                placeholder={t("choose")}
                options={subdistricts.map((name) => ({ value: name, label: name }))}
              />
            </Field>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
