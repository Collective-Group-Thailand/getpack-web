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
import { Sheet } from "@/ui/components/Sheet";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

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
  const [adding, setAdding] = useState(false);

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
      setAdding(false);
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

  // Project C: branches as the address book's cards (icon plate; the head office outlined in green) with a dashed
  // tile to add one, and the form in a side sheet over the list.
  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => {
          const head = branch.branchType === "head_office";
          return (
            <li
              key={branch.id}
              className={cn(
                "bg-surface rounded-card flex min-w-0 flex-col gap-3 border p-4",
                head ? "border-primary" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    head ? "bg-primary-subtle text-primary-subtle-fg" : "bg-surface-subtle text-muted",
                  )}
                >
                  <Icon name="building" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="min-w-0 [overflow-wrap:break-word] break-keep">{branch.name}</span>
                    <Badge tone={head ? "primary" : "neutral"}>
                      {head ? t("headOffice") : t("code", { code: branch.branchCode })}
                    </Badge>
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    {[
                      branch.line1,
                      branch.line2,
                      branch.subdistrictNameTh
                        ? pick(locale, branch.subdistrictNameTh, branch.subdistrictNameEn)
                        : null,
                      branch.districtNameTh ? pick(locale, branch.districtNameTh, branch.districtNameEn) : null,
                      pick(locale, branch.provinceNameTh, branch.provinceNameEn),
                      branch.postcode,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              </div>
              {canManage && !head ? (
                <div className="border-border mt-auto border-t pt-3">
                  <Button size="sm" variant="ghost" onClick={() => void remove(branch)}>
                    {t("remove")}
                    <span className="sr-only"> {branch.name}</span>
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
        {canManage ? (
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="border-border-strong text-muted hover:border-primary hover:text-primary focus-visible:ring-focus-ring rounded-card flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 border border-dashed p-4 text-sm font-medium outline-none focus-visible:ring-2"
            >
              <Icon name="plus" size={20} aria-hidden="true" />
              {t("addTitle")}
            </button>
          </li>
        ) : null}
      </ul>
      {canManage ? (
        <Sheet
          open={adding}
          onOpenChange={setAdding}
          title={t("addTitle")}
          closeLabel={t("addTitle")}
          className="w-[min(32rem,calc(100vw-2rem))]"
          footer={
            <Button type="submit" form="branch-add-form" loading={busy}>
              {t("add")}
            </Button>
          }
        >
          <form id="branch-add-form" noValidate onSubmit={(event) => void add(event)} className="flex flex-col gap-4">
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
          </form>
        </Sheet>
      ) : null}
    </div>
  );
}
