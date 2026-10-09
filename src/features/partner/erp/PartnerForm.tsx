"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { isValidThaiTaxId } from "@/domain/tax-id";
import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";

import { plainNumber } from "./format";

type Partner = Schemas["ErpTradingPartnerDto"];
type Kind = Partner["kind"];
const KINDS: Kind[] = ["supplier", "customer", "both"];

/**
 * A supplier or customer of the factory's own (D-317): who they are, how to reach them, their credit terms.
 * New partners get a code from the API unless one is typed; edits go under `If-Match`.
 */
export function PartnerForm({
  partner,
  etag,
  initialKind,
}: {
  partner?: Partner;
  etag?: string | null;
  initialKind?: Kind;
}) {
  const t = useTranslations("partnerErp.partners.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const [refresh] = useRefresh();
  const [kind, setKind] = useState<Kind>(partner?.kind ?? initialKind ?? "supplier");
  const [code, setCode] = useState("");
  const [name, setName] = useState(partner?.name ?? "");
  const [taxId, setTaxId] = useState(partner?.taxId ?? "");
  const [branchCode, setBranchCode] = useState(partner?.branchCode ?? "");
  const [contactName, setContactName] = useState(partner?.contactName ?? "");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [email, setEmail] = useState(partner?.email ?? "");
  const [address, setAddress] = useState(partner?.address ?? "");
  const [days, setDays] = useState(partner ? String(partner.paymentTermDays) : "");
  const [creditLimit, setCreditLimit] = useState(partner?.creditLimit?.replace(/\.00$/, "") ?? "");
  const [note, setNote] = useState(partner?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (taxId && !isValidThaiTaxId(taxId)) next.taxId = t("taxIdInvalid");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const body = {
      kind,
      name: name.trim(),
      taxId: taxId || null,
      branchCode: branchCode || null,
      contactName: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      paymentTermDays: days ? Number.parseInt(days, 10) : 0,
      creditLimit: creditLimit ? plainNumber(creditLimit) : null,
      note: note.trim() || null,
    };
    try {
      if (partner) {
        await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}", {
          params: { path: { factoryId, partnerId: partner.id }, header: { "If-Match": etag ?? "" } },
          body,
        });
        toast.success(tCommon("saved"));
        refresh();
      } else {
        const { data } = await browserApi().POST("/v1/partner/factories/{factoryId}/erp/partners", {
          params: { path: { factoryId } },
          body: { ...body, ...(code.trim() ? { code: code.trim().toUpperCase() } : {}) },
        });
        toast.success(t("created", { name: data?.name ?? name }));
        router.push(data ? `/partners/${data.id}` : "/partners");
      }
    } catch (error) {
      if (isApiError(error)) setErrors(Object.fromEntries(error.errors.map((e) => [e.path, e.message])));
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <SegmentedControl
        label={t("kind")}
        size="xl"
        value={kind}
        onValueChange={setKind}
        options={KINDS.map((value) => ({ value, label: tCommon(`partnerKinds.${value}`) }))}
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {partner ? (
          <Field label={t("code")}>
            <Input value={partner.code} disabled />
          </Field>
        ) : (
          <Field label={t("code")} hint={t("codeHint")} error={errors.code}>
            <Input value={code} placeholder={t("codePlaceholder")} onChange={(event) => setCode(event.target.value)} />
          </Field>
        )}
        <Field label={t("name")} required requiredLabel={tCommon("required")} error={errors.name}>
          <Input value={name} placeholder={t("namePlaceholder")} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("taxId")} error={errors.taxId}>
          <Input
            inputMode="numeric"
            maxLength={13}
            value={taxId}
            placeholder={t("taxIdPlaceholder")}
            onChange={(event) => setTaxId(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label={t("branchCode")} error={errors.branchCode}>
          <Input
            inputMode="numeric"
            maxLength={5}
            value={branchCode}
            placeholder={t("branchCodePlaceholder")}
            onChange={(event) => setBranchCode(event.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label={t("contactName")}>
          <Input
            value={contactName}
            placeholder={t("contactNamePlaceholder")}
            onChange={(event) => setContactName(event.target.value)}
          />
        </Field>
        <Field label={t("phone")}>
          <Input
            type="tel"
            value={phone}
            placeholder={t("phonePlaceholder")}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label={t("email")} error={errors.email}>
          <Input
            type="email"
            value={email}
            placeholder={t("emailPlaceholder")}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t("paymentTerm")}>
          <NumberInput
            min={0}
            max={365}
            step={1}
            value={days}
            placeholder={t("paymentTermPlaceholder")}
            onChange={(event) => setDays(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("address")}>
        <Textarea
          rows={2}
          value={address}
          placeholder={t("addressPlaceholder")}
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("creditLimit")} error={errors.creditLimit}>
          <NumberInput
            min={0}
            step="any"
            unit="฿"
            value={creditLimit}
            placeholder={t("creditLimitPlaceholder")}
            onChange={(event) => setCreditLimit(event.target.value)}
          />
        </Field>
        <Field label={t("note")}>
          <Input
            value={note}
            placeholder={tCommon("notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {partner ? tCommon("save") : t("create")}
      </Button>
    </form>
  );
}

/** Archives or restores a partner. */
export function PartnerStatusButton({ partner, etag }: { partner: Partner; etag: string | null }) {
  const t = useTranslations("partnerErp.partners.form");
  const tCommon = useTranslations("partnerErp.common");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  const archived = partner.status === "archived";
  async function flip() {
    setBusy(true);
    try {
      await browserApi().PATCH("/v1/partner/factories/{factoryId}/erp/partners/{partnerId}", {
        params: { path: { factoryId, partnerId: partner.id }, header: { "If-Match": etag ?? "" } },
        body: { status: archived ? "active" : "archived" },
      });
      toast.success(tCommon("saved"));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, tCommon("failed")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      variant={archived ? "secondary" : "destructive"}
      iconStart={archived ? "undo" : "archive"}
      loading={busy}
      onClick={() => void flip()}
    >
      {archived ? t("restore") : t("archive")}
    </Button>
  );
}
