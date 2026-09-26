"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { FACTORY_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Meter } from "@/ui/components/Meter";

import { CrudList, defineResource, QueueTabs, StatusChip, type FieldDef, type InitialPage } from "../console";
import { FACTORY_STATUSES, factoriesList, type Factory } from "./resources";

const schema = z.object({
  legalName: z.string().trim().min(1, "required"),
  tradeName: z.string().optional(),
  taxId: z.string().regex(/^\d{13}$/, "taxId"),
  branchCode: z.string().regex(/^\d{5}$/, "branchCode"),
  juristicType: z.enum(["company", "partnership", "individual"]),
  isVatRegistered: z.boolean(),
  vatRegisteredOn: z.string().optional(),
  onboardingMode: z.enum(["self_service", "assisted"]),
  lineGroupId: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const config = defineResource<Factory, Values>({
  list: factoriesList,
  manage: "partners.manage",
  form: {
    schema,
    empty: {
      legalName: "",
      tradeName: "",
      taxId: "",
      branchCode: "00000",
      juristicType: "company",
      isVatRegistered: true,
      vatRegisteredOn: "",
      onboardingMode: "assisted",
      lineGroupId: "",
    },
    toValues: (row) => ({
      legalName: row.legalName,
      tradeName: row.tradeName ?? "",
      taxId: row.taxId,
      branchCode: row.branchCode,
      juristicType: row.juristicType,
      isVatRegistered: row.isVatRegistered,
      vatRegisteredOn: row.vatRegisteredOn ?? "",
      onboardingMode: row.onboardingMode,
      lineGroupId: row.lineGroupId ?? "",
    }),
    create: async ({ contract }, values) =>
      (
        await contract.POST("/v1/admin/factories", {
          body: {
            ...values,
            tradeName: values.tradeName?.trim() || null,
            vatRegisteredOn: values.isVatRegistered && values.vatRegisteredOn ? values.vatRegisteredOn : null,
            lineGroupId: values.lineGroupId?.trim() || null,
          },
        })
      ).data,
  },
});

/**
 * Partner factories as an onboarding pipeline (F2 2.6, D-011, D-041, D-171): one tab per status —
 * applied, in review, on trial, active, suspended, offboarded — each row with how far its
 * onboarding has come. Factories enter through the Partner team (D-171): staff create them, in
 * self-service or assisted mode.
 */
export function FactoriesList({ initial }: { initial: InitialPage<Factory> | null }) {
  const t = useTranslations("partners.list");
  const tStatus = useTranslations("status");

  const columns: DataTableColumn<Factory>[] = [
    {
      id: "code",
      header: t("columns.factory"),
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/partners/${row.id}`} className="text-primary font-medium hover:underline">
            {row.tradeName ?? row.legalName}
          </Link>
          <p className="text-muted font-mono text-xs">{row.code}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={FACTORY_STATUS} value={row.status} />,
    },
    {
      id: "onboarding",
      header: t("columns.onboarding"),
      cell: (row) => (
        <div className="w-36">
          <Meter
            label={t("onboardingOf", { name: row.code })}
            value={row.onboarding.total ? Math.round((row.onboarding.done / row.onboarding.total) * 100) : 0}
            valueText={t("steps", { done: row.onboarding.done, total: row.onboarding.total })}
            tone={row.onboarding.done === row.onboarding.total ? "success" : "primary"}
          />
          <p className="text-muted mt-1 text-xs">
            {t("steps", { done: row.onboarding.done, total: row.onboarding.total })}
          </p>
        </div>
      ),
    },
    { id: "mode", header: t("columns.mode"), cell: (row) => t(`modes.${row.onboardingMode}`) },
    {
      id: "trial",
      header: t("columns.trial"),
      hideable: true,
      cell: (row) =>
        row.status === "trial" ? (
          t("trialJobs", { count: row.trialJobsCompleted })
        ) : (
          <span className="text-muted">–</span>
        ),
    },
    {
      id: "statusChangedAt",
      header: t("columns.since"),
      hideable: true,
      cell: (row) => <When at={row.statusChangedAt} />,
    },
  ];

  const fields: FieldDef<Values>[] = [
    { name: "legalName", label: t("fields.legalName"), kind: "text", required: true, wide: true },
    { name: "tradeName", label: t("fields.tradeName"), kind: "text", wide: true },
    { name: "taxId", label: t("fields.taxId"), kind: "text", required: true, hint: t("hints.taxId") },
    { name: "branchCode", label: t("fields.branchCode"), kind: "text", required: true, hint: t("hints.branchCode") },
    {
      name: "juristicType",
      label: t("fields.juristicType"),
      kind: "select",
      required: true,
      options: (["company", "partnership", "individual"] as const).map((value) => ({
        value,
        label: t(`juristic.${value}`),
      })),
    },
    {
      name: "onboardingMode",
      label: t("fields.onboardingMode"),
      kind: "select",
      required: true,
      hint: t("hints.onboardingMode"),
      options: (["assisted", "self_service"] as const).map((value) => ({ value, label: t(`modes.${value}`) })),
    },
    { name: "isVatRegistered", label: t("fields.isVatRegistered"), kind: "switch" },
    { name: "vatRegisteredOn", label: t("fields.vatRegisteredOn"), kind: "date" },
    { name: "lineGroupId", label: t("fields.lineGroupId"), kind: "text", hint: t("hints.lineGroupId") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueueTabs
        label={t("statusesLabel")}
        param="status"
        tabs={[
          { value: null, label: t("all") },
          ...FACTORY_STATUSES.map((status) => ({
            value: status,
            label: tStatus(FACTORY_STATUS[status].labelKey),
            ...(status === "applied" ? { countKey: "partners.onboarding" } : {}),
          })),
        ]}
      />
      <CrudList
        config={config}
        columns={columns}
        caption={t("title")}
        fields={fields}
        searchLabel={t("search")}
        initial={initial}
        labels={{ create: t("create"), createTitle: t("createTitle"), empty: t("empty") }}
      />
    </div>
  );
}
