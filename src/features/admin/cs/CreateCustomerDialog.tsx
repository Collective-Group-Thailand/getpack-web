"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage } from "../console";

/** CS registers a customer on their behalf; a phone or e-mail already known answers that customer. */
export function CreateCustomerDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: Schemas["AdminCustomerDto"]) => void;
}) {
  const t = useTranslations("cs.newCustomer");
  const tCommon = useTranslations("common");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState<"individual" | "juristic">("individual");

  const create = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/customers", {
          body: { displayName: displayName.trim(), phone, ...(email ? { email } : {}), customerType },
        })
      ).data!,
    // Find-or-create: a phone or e-mail that matches an account answers that customer instead.
    onSuccess: ({ created, customer }) => {
      const name = customer.customerCode ?? customer.displayName;
      toast.success(created ? t("created", { code: name }) : t("matched", { name }));
      onCreated(customer);
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("title")}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon("actions.cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!displayName.trim() || !/^0\d{8,9}$/.test(phone)}
          >
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error ? <Callout tone="danger" title={problemMessage(create.error, t("failed"))} /> : null}
        <Field label={t("name")} required requiredLabel={tCommon("state.required")}>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} required requiredLabel={tCommon("state.required")}>
          <Input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label={t("type")}>
          <div className="flex gap-4 text-sm">
            {(["individual", "juristic"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-primary size-4"
                  name="customer-type"
                  checked={customerType === value}
                  onChange={() => setCustomerType(value)}
                />
                {t(`types.${value}`)}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}
