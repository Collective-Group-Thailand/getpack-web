"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";

import type { TaxProfile } from "./address";
import { PostcodeAreaField, type ChosenArea } from "./PostcodeArea";
import { formatTaxId, isValidThaiTaxId } from "./tax-id";

export type { TaxProfile } from "./address";

/**
 * Who the tax invoice is made out to (D-125), edited under the `ETag` of a fresh read
 * (`store.taxProfiles.update`, If-Match): the name, the registered address lines, the e-mail the
 * documents go to, and whether the customer withholds tax (the API computes the amount and it is
 * shown at checkout). The type, tax id and branch are the Revenue Department's record and do not
 * change once saved. A new profile takes them, its address from the postcode first (the ids it is
 * filed under, `store.catalog.lookupPostcode`), and the tax id checked as the Revenue Department's
 * check digit before it is sent (`store.taxProfiles.create`).
 */
export function TaxProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile?: TaxProfile;
  onSaved: (profile: TaxProfile) => void;
  onCancel?: () => void;
}) {
  if (!profile) return <CreateTaxProfile onSaved={onSaved} onCancel={onCancel} />;
  return <EditTaxProfile profile={profile} onSaved={onSaved} onCancel={onCancel} />;
}

type TaxType = Schemas["CustomerType"];

function CreateTaxProfile({ onSaved, onCancel }: { onSaved: (profile: TaxProfile) => void; onCancel?: () => void }) {
  const t = useTranslations("account.taxForm");
  const [taxType, setTaxType] = useState<TaxType>("juristic");
  const [taxId, setTaxId] = useState("");
  const [branchType, setBranchType] = useState<Schemas["BranchType"]>("head_office");
  const [branchCode, setBranchCode] = useState("");
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [area, setArea] = useState<ChosenArea | null>(null);
  const [documentEmail, setDocumentEmail] = useState("");
  const [withholdsTax, setWithholdsTax] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const found: Record<string, string> = {};
    if (!isValidThaiTaxId(taxId)) found.taxId = t("taxIdInvalid");
    if (branchType === "branch" && !/^\d{5}$/.test(branchCode)) found.branchCode = t("branchCodeInvalid");
    if (!name.trim()) found.name = t("required");
    if (!line1.trim()) found.line1 = t("required");
    if (!/^\d{5}$/.test(postcode)) found.postcode = t("postcodeInvalid");
    else if (!area) found.subdistrict = t("required");
    if (documentEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(documentEmail.trim()))
      found.documentEmail = t("emailInvalid");
    setErrors(found);
    if (Object.keys(found).length > 0 || !area) return;
    setSaving(true);
    setFailure(null);
    try {
      const { data } = await browserApi().POST("/v1/store/tax-profiles", {
        body: {
          taxType,
          taxId,
          branchType,
          ...(branchType === "branch" ? { branchCode } : {}),
          name: name.trim(),
          line1: line1.trim(),
          line2: line2.trim() || null,
          postcode: area.postcode,
          provinceId: area.provinceId,
          subdistrictId: area.subdistrictId,
          documentEmail: documentEmail.trim() || null,
          withholdsTax: taxType !== "individual" && withholdsTax,
          isDefault,
        },
      });
      onSaved(data!);
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
      {failure ? (
        <Callout tone="danger" live>
          {failure}
        </Callout>
      ) : null}
      <Field label={t("type")}>
        <RadioCards
          columns={3}
          value={taxType}
          onValueChange={(value) => setTaxType(value as TaxType)}
          options={(["individual", "juristic", "government"] as const).map((value) => ({
            value,
            label: t(`types.${value}`),
          }))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("taxId")} error={errors.taxId} required requiredLabel={t("requiredMark")}>
          <Input
            inputMode="numeric"
            maxLength={13}
            value={taxId}
            onChange={(event) => setTaxId(event.target.value.replace(/\D/g, "").slice(0, 13))}
          />
        </Field>
        <Field label={t("branch")}>
          <RadioCards
            columns={2}
            value={branchType}
            onValueChange={(value) => setBranchType(value as Schemas["BranchType"])}
            options={[
              { value: "head_office", label: t("headOffice") },
              { value: "branch", label: t("branchLabel") },
            ]}
          />
        </Field>
        {branchType === "branch" ? (
          <Field label={t("branchCode")} error={errors.branchCode} required requiredLabel={t("requiredMark")}>
            <Input
              inputMode="numeric"
              maxLength={5}
              value={branchCode}
              onChange={(event) => setBranchCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </Field>
        ) : null}
      </div>
      <Field label={t("name")} error={errors.name} required requiredLabel={t("requiredMark")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <PostcodeAreaField
        postcode={postcode}
        subdistrictId={area?.subdistrictId ?? ""}
        errors={{ postcode: errors.postcode, subdistrict: errors.subdistrict }}
        onChange={(next) => {
          setPostcode(next.postcode);
          setArea(next.area);
        }}
      />
      <Field label={t("line1")} error={errors.line1} required requiredLabel={t("requiredMark")}>
        <Input value={line1} onChange={(event) => setLine1(event.target.value)} />
      </Field>
      <Field label={t("line2")}>
        <Input value={line2} onChange={(event) => setLine2(event.target.value)} />
      </Field>
      <Field label={t("documentEmail")} hint={t("documentEmailHint")} error={errors.documentEmail}>
        <Input
          type="email"
          inputMode="email"
          value={documentEmail}
          onChange={(event) => setDocumentEmail(event.target.value)}
        />
      </Field>
      {taxType !== "individual" ? (
        <Checkbox
          checked={withholdsTax}
          onCheckedChange={(checked) => setWithholdsTax(checked === true)}
          label={t("withholds")}
          description={t("withholdsHint")}
        />
      ) : null}
      <Checkbox
        checked={isDefault}
        onCheckedChange={(checked) => setIsDefault(checked === true)}
        label={t("default")}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {t("save")}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function EditTaxProfile({
  profile,
  onSaved,
  onCancel,
}: {
  profile: TaxProfile;
  onSaved: (profile: TaxProfile) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("account.taxForm");
  const [name, setName] = useState(profile.name);
  const [line1, setLine1] = useState(profile.line1);
  const [line2, setLine2] = useState(profile.line2 ?? "");
  const [documentEmail, setDocumentEmail] = useState(profile.documentEmail ?? "");
  const [withholdsTax, setWithholdsTax] = useState(profile.withholdsTax);
  const [isDefault, setIsDefault] = useState(profile.isDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The registered address may move; the identity (type, tax id, branch) may not — a changed tax
  // id is a new profile. The area used to be fixed text here (owner feedback 2026-10-14).
  const [postcode, setPostcode] = useState(profile.postcode);
  const [area, setArea] = useState<ChosenArea | null>(() =>
    profile.subdistrict
      ? { postcode: profile.postcode, provinceId: profile.province.id, subdistrictId: profile.subdistrict.id }
      : null,
  );
  const areaChanged =
    postcode !== profile.postcode || (area !== null && area.subdistrictId !== profile.subdistrict?.id);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("required");
    if (!line1.trim()) found.line1 = t("required");
    if (!/^\d{5}$/.test(postcode)) found.postcode = t("required");
    else if (!area) found.subdistrict = t("required");
    if (documentEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(documentEmail.trim()))
      found.documentEmail = t("emailInvalid");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      const api = browserApi();
      const current = await api.GET("/v1/store/tax-profiles/{taxProfileId}", {
        params: { path: { taxProfileId: profile.id } },
      });
      const { data } = await api.PATCH("/v1/store/tax-profiles/{taxProfileId}", {
        params: {
          path: { taxProfileId: profile.id },
          header: { "If-Match": current.response.headers.get("etag") ?? "" },
        },
        body: {
          name: name.trim(),
          line1: line1.trim(),
          line2: line2.trim() || null,
          documentEmail: documentEmail.trim() || null,
          withholdsTax: profile.taxType !== "individual" && withholdsTax,
          isDefault,
          ...(areaChanged && area
            ? { postcode: area.postcode, provinceId: area.provinceId, subdistrictId: area.subdistrictId }
            : {}),
        },
      });
      onSaved(data!);
    } catch (error) {
      setFailure(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
      {failure ? (
        <Callout tone="danger" live>
          {failure}
        </Callout>
      ) : null}
      <div className="bg-bg-subtle rounded-lg px-4 py-3">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t("type")}</dt>
          <dd>{t(`types.${profile.taxType}`)}</dd>
          <dt className="text-muted">{t("taxId")}</dt>
          <dd className="tabular-nums">{formatTaxId(profile.taxId)}</dd>
          <dt className="text-muted">{t("branch")}</dt>
          <dd>{profile.branchType === "head_office" ? t("headOffice") : t("branchNo", { code: profile.branchCode })}</dd>
        </dl>
        <p className="text-muted mt-2 text-xs">{t("fixedHint")}</p>
      </div>
      <Field label={t("name")} error={errors.name} required requiredLabel={t("requiredMark")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <PostcodeAreaField
        postcode={postcode}
        subdistrictId={area?.subdistrictId ?? ""}
        errors={{ postcode: errors.postcode, subdistrict: errors.subdistrict }}
        onChange={(next) => {
          setPostcode(next.postcode);
          setArea(next.area);
        }}
      />
      <Field label={t("line1")} error={errors.line1} required requiredLabel={t("requiredMark")}>
        <Input value={line1} onChange={(event) => setLine1(event.target.value)} />
      </Field>
      <Field label={t("line2")}>
        <Input value={line2} onChange={(event) => setLine2(event.target.value)} />
      </Field>
      <Field label={t("documentEmail")} hint={t("documentEmailHint")} error={errors.documentEmail}>
        <Input
          type="email"
          inputMode="email"
          value={documentEmail}
          onChange={(event) => setDocumentEmail(event.target.value)}
        />
      </Field>
      {profile.taxType !== "individual" ? (
        <Checkbox
          checked={withholdsTax}
          onCheckedChange={(checked) => setWithholdsTax(checked === true)}
          label={t("withholds")}
          description={t("withholdsHint")}
        />
      ) : null}
      <Checkbox
        checked={isDefault}
        onCheckedChange={(checked) => setIsDefault(checked === true)}
        label={t("default")}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {t("save")}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
