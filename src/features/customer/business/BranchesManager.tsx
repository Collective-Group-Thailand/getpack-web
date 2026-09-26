"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

type Branch = ResponseOf<Requests, "GET /v1/store/me/company/branches">["data"][number];

/** Head office and branches (D-125): a tax invoice per branch, each with its 5-digit code. */
export function BranchesManager({ branches, canManage }: { branches: Branch[]; canManage: boolean }) {
  const t = useTranslations("business.branches");
  const router = useRouter();
  const [form, setForm] = useState({ branchCode: "", name: "", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!/^\d{5}$/.test(form.branchCode)) found.branchCode = t("errors.code");
    if (!form.name.trim()) found.name = t("errors.name");
    if (form.address.trim().length < 10) found.address = t("errors.address");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await browserRequests().call("POST /v1/store/me/company/branches", {
        body: { branchCode: form.branchCode, name: form.name.trim(), address: form.address.trim() },
      });
      toast.success(t("added", { name: form.name.trim() }));
      setForm({ branchCode: "", name: "", address: "" });
      router.refresh();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(branch: Branch) {
    try {
      await browserRequests().call("DELETE /v1/store/me/company/branches/{branchId}", {
        path: { branchId: branch.id },
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
            <p className="text-muted text-sm">{branch.address}</p>
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
        <section
          aria-labelledby="branch-add"
          className="border-border flex max-w-xl flex-col gap-4 rounded-xl border p-5"
        >
          <h2 id="branch-add" className="text-lg font-semibold">
            {t("addTitle")}
          </h2>
          <form noValidate onSubmit={(event) => void add(event)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Field label={t("branchCode")} error={errors.branchCode}>
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  value={form.branchCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, branchCode: event.target.value.replace(/\D/g, "") }))
                  }
                />
              </Field>
              <Field label={t("name")} error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
            </div>
            <Field label={t("address")} error={errors.address}>
              <Textarea
                rows={3}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              />
            </Field>
            <Button type="submit" className="self-start" loading={busy}>
              {t("add")}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
