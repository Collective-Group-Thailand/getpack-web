"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { PostcodeAreaField, type ChosenArea } from "@/features/customer/account/PostcodeArea";
import { pick } from "@/features/customer/catalog/localize";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Branch = Schemas["CompanyBranchDto"];

/**
 * Head office and branches (D-125): a tax invoice per branch, each with its 5-digit code. A branch
 * is added with its address from the postcode first (the ids it is filed under,
 * `store.catalog.lookupPostcode`, `store.companies.addBranch`) and removed with
 * `store.companies.removeBranch`.
 */
export function BranchesManager({
  companyId,
  branches,
  canManage,
}: {
  companyId: string;
  branches: Branch[];
  canManage: boolean;
}) {
  const t = useTranslations("business.branches");
  const locale = useLocale();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [postcode, setPostcode] = useState("");
  const [area, setArea] = useState<ChosenArea | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!/^\d{5}$/.test(code) || code === "00000") found.code = t("errors.code");
    if (!name.trim()) found.name = t("errors.name");
    if (!line1.trim()) found.address = t("errors.address");
    if (!area) found.subdistrict = t("errors.area");
    setErrors(found);
    if (Object.keys(found).length > 0 || !area) return;
    setBusy(true);
    try {
      await browserApi().POST("/v1/store/companies/{companyId}/branches", {
        params: { path: { companyId } },
        body: {
          branchType: "branch",
          branchCode: code,
          name: name.trim(),
          line1: line1.trim(),
          postcode: area.postcode,
          provinceId: area.provinceId,
          subdistrictId: area.subdistrictId,
          isDefault: false,
        },
      });
      toast.success(t("added", { name: name.trim() }));
      setCode("");
      setName("");
      setLine1("");
      setPostcode("");
      setArea(null);
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(branch: Branch) {
    try {
      await browserApi().DELETE("/v1/store/companies/{companyId}/branches/{branchId}", {
        params: { path: { companyId, branchId: branch.id } },
      });
      toast.success(t("removed", { name: branch.name }));
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-3 md:grid-cols-2">
        {branches.map((branch) => (
          <li key={branch.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{branch.name}</p>
              <Badge tone={branch.branchType === "head_office" ? "primary" : "neutral"}>
                {branch.branchType === "head_office" ? t("headOffice") : t("code", { code: branch.branchCode })}
              </Badge>
            </div>
            <p className="text-muted text-sm">
              {[
                branch.line1,
                branch.line2,
                branch.subdistrictNameTh ? pick(locale, branch.subdistrictNameTh, branch.subdistrictNameEn) : null,
                branch.districtNameTh ? pick(locale, branch.districtNameTh, branch.districtNameEn) : null,
                pick(locale, branch.provinceNameTh, branch.provinceNameEn),
                branch.postcode,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
            {canManage && branch.branchType !== "head_office" ? (
              <Button size="sm" variant="ghost" className="self-start" onClick={() => void remove(branch)}>
                {t("remove")}
                <span className="sr-only"> {branch.name}</span>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form
          noValidate
          onSubmit={(event) => void add(event)}
          aria-labelledby="branch-add"
          className="border-border flex max-w-xl flex-col gap-4 rounded-xl border p-5"
        >
          <h2 id="branch-add" className="text-lg font-semibold">
            {t("addTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("branchCode")} error={errors.code}>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label={t("name")} error={errors.name}>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          </div>
          <PostcodeAreaField
            postcode={postcode}
            subdistrictId={area?.subdistrictId ?? ""}
            errors={{ subdistrict: errors.subdistrict }}
            onChange={(next) => {
              setPostcode(next.postcode);
              setArea(next.area);
            }}
          />
          <Field label={t("address")} error={errors.address}>
            <Input value={line1} onChange={(event) => setLine1(event.target.value)} />
          </Field>
          <Button type="submit" className="self-start" loading={busy}>
            {t("add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
