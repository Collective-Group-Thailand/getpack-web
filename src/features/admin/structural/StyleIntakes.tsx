"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { STYLE_INTAKE_STATUS } from "@/domain/status";
import { When } from "@/features/shared/format";
import { Button } from "@/ui/components/Button";
import type { DataTableColumn } from "@/ui/components/DataTable";

import { QueueTabs, ResourceList, StatusChip } from "../console";
import { ALL_INTAKES, INTAKE_QUEUE, styleIntakesList, type StyleIntake } from "./resources";

type Row = StyleIntake;

/** Dieline offers from factories (U3.6, D-272), newest first, by status: the ones to review first. */
export function StyleIntakes() {
  const t = useTranslations("catalogue.intakes");
  const tStatus = useTranslations("status");
  const columns: DataTableColumn<Row>[] = [
    {
      id: "title",
      header: t("columns.title"),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/style-intakes/${row.id}`} className="text-primary hover:underline">
            {row.title}
          </Link>
          <p className="text-muted text-xs">{row.file.originalName}</p>
        </div>
      ),
    },
    { id: "factory", header: t("columns.factory"), cell: (row) => `${row.factory.code} · ${row.factory.name}` },
    { id: "base", header: t("columns.base"), cell: (row) => row.proposedBaseCode ?? "—" },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => <StatusChip map={STYLE_INTAKE_STATUS} value={row.status} />,
    },
    { id: "createdAt", header: t("columns.created"), cell: (row) => <When at={row.createdAt} /> },
  ];
  return (
    <ResourceList
      views={
        <QueueTabs
          countFrom={styleIntakesList}
          label={t("statusesLabel")}
          param="status"
          tabs={[
            ...INTAKE_QUEUE.map((s, index) => ({
              value: index === 0 ? null : s,
              label: tStatus(STYLE_INTAKE_STATUS[s].labelKey),
            })),
            { value: ALL_INTAKES, label: t("all") },
          ]}
        />
      }
      resource={styleIntakesList}
      columns={columns}
      caption={t("title")}
      savedViews={false}
      rowHref={(row) => `/style-intakes/${row.id}`}
      empty={{
        title: t("empty"),
        action: (
          <Button asChild variant="secondary" iconEnd="arrow-right">
            <Link href="/partners?status=active">{t("emptyAction")}</Link>
          </Button>
        ),
      }}
    />
  );
}
