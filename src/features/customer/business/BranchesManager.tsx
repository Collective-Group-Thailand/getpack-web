"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { toast } from "@/ui/components/Toast";

type Branch = Schemas["CompanyBranchDto"];

/**
 * Head office and branches (D-125): a tax invoice per branch, each with its 5-digit code. A branch
 * is removed with `store.companies.removeBranch`.
 *
 * CONTRACT-GAP store.geo-ids — a new branch is filed under a province **id**
 * (`CompanyBranchInputDto`), which no store geo read gives, so branches cannot be added here yet.
 * CONTRACT-GAP store.company-branches — the published branch carries its address lines and postcode
 * without the province, so the page shows what it has.
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
  const router = useRouter();

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
              {[branch.line1, branch.line2, branch.postcode].filter(Boolean).join(" ")}
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
        <Callout tone="info" title={t("addBlockedTitle")} className="max-w-xl">
          {t("addBlocked")}
        </Callout>
      ) : null}
    </div>
  );
}
