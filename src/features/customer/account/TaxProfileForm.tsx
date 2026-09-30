"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { geoName, type TaxProfile } from "./address";
import { formatTaxId } from "./tax-id";

export type { TaxProfile } from "./address";

/**
 * Who the tax invoice is made out to (D-125), edited under the `ETag` of a fresh read
 * (`store.taxProfiles.update`, If-Match): the name, the registered address lines, the e-mail the
 * documents go to, and whether the customer withholds tax (the API computes the amount and it is
 * shown at checkout). The type, tax id and branch are the Revenue Department's record and do not
 * change once saved.
 *
 * CONTRACT-GAP store.geo-ids — a profile is filed under a province **id**, which no store geo read
 * gives, so a new profile cannot be created yet and a saved one keeps its province.
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
  const t = useTranslations("account.taxForm");
  if (!profile) {
    return (
      <div className="flex flex-col gap-4">
        <Callout tone="info" title={t("createBlockedTitle")}>
          {t("createBlocked")}
        </Callout>
        {onCancel ? (
          <div>
            <Button variant="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  return <EditTaxProfile profile={profile} onSaved={onSaved} onCancel={onCancel} />;
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
  const locale = useLocale();
  const [name, setName] = useState(profile.name);
  const [line1, setLine1] = useState(profile.line1);
  const [line2, setLine2] = useState(profile.line2 ?? "");
  const [documentEmail, setDocumentEmail] = useState(profile.documentEmail ?? "");
  const [withholdsTax, setWithholdsTax] = useState(profile.withholdsTax);
  const [isDefault, setIsDefault] = useState(profile.isDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const area = [geoName(locale, profile.subdistrict), geoName(locale, profile.province), profile.postcode]
    .filter(Boolean)
    .join(" ");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("required");
    if (!line1.trim()) found.line1 = t("required");
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
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">{t("type")}</dt>
        <dd>{t(`types.${profile.taxType}`)}</dd>
        <dt className="text-muted">{t("taxId")}</dt>
        <dd className="tabular-nums">{formatTaxId(profile.taxId)}</dd>
        <dt className="text-muted">{t("branch")}</dt>
        <dd>{profile.branchType === "head_office" ? t("headOffice") : t("branchNo", { code: profile.branchCode })}</dd>
        <dt className="text-muted">{t("areaFixed")}</dt>
        <dd>{area}</dd>
      </dl>
      <Field label={t("name")} error={errors.name} required requiredLabel={t("requiredMark")}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
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
