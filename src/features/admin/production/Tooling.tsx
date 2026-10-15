"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Pagination } from "@/ui/components/Pagination";

import { adminBrowserApis, QueryError } from "../console";
import { useFactoryOptions } from "./factories";

type Item = Schemas["ToolingItemDto"];
type Kind = Schemas["ToolingKind"];
type Status = Schemas["ToolingStatus"];

/**
 * The tooling register (D-205, D-289): printing plates and die blocks a delivered order paid for,
 * kept at the factory that made them — plates bound to the specification and approved artwork, a
 * die block to the specification — reusable at that factory until last use plus the reuse period;
 * a remake Packio absorbed is listed under its item.
 */
export function Tooling() {
  const t = useTranslations("production.tooling");
  const tList = useTranslations("console.list");
  const format = useFormat();
  const factories = useFactoryOptions();
  const [factoryId, setFactoryId] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.list("admin", "tooling", { factoryId, kind, status, page }),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/tooling", {
          params: {
            query: {
              page,
              perPage: 25,
              ...(factoryId ? { factoryId } : {}),
              ...(kind ? { kind } : {}),
              ...(status ? { status } : {}),
            },
          },
        })
      ).data!,
  });
  const today = new Date().toISOString();
  const columns: DataTableColumn<Item>[] = [
    { id: "kind", header: t("kind"), cell: (row) => <Badge size="sm">{t(`kinds.${row.kind}`)}</Badge> },
    {
      id: "factory",
      header: t("factory"),
      cell: (row) => <span className="font-mono text-sm">{row.factory.code}</span>,
    },
    {
      id: "source",
      header: t("source"),
      cell: (row) => (
        <Link href={`/orders/${row.sourceOrder.orderId}`} className="text-primary font-mono text-sm hover:underline">
          {row.sourceOrder.orderCode}
        </Link>
      ),
    },
    {
      id: "last",
      header: t("lastUsed"),
      cell: (row) => (
        <div className="text-sm">
          <Link href={`/orders/${row.lastOrder.orderId}`} className="text-primary font-mono hover:underline">
            {row.lastOrder.orderCode}
          </Link>
          <p className="text-muted text-xs">
            <When at={row.lastUsedAt} />
          </p>
        </div>
      ),
    },
    {
      id: "until",
      header: t("reusableUntil"),
      cell: (row) => (
        <span className={row.reusableUntil < today ? "text-muted line-through" : undefined}>
          {format.date(row.reusableUntil)}
        </span>
      ),
    },
    {
      id: "artwork",
      header: t("artwork"),
      cell: (row) =>
        row.artworkSha256 ? <span className="font-mono text-xs">{row.artworkSha256.slice(0, 12)}</span> : "—",
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div>
          <Badge size="sm" tone={row.status === "active" ? "success" : "danger"}>
            {t(`statuses.${row.status}`)}
          </Badge>
          {row.remakes.length ? (
            <p className="text-muted mt-1 text-xs">
              {t("remakes", { count: row.remakes.length, amount: format.thb(row.remakes[0]!.buyNetAmount) })}
            </p>
          ) : null}
        </div>
      ),
    },
  ];
  const data = query.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {factories.length ? (
          <Field label={t("factory")} className="w-64">
            <NativeSelect
              value={factoryId}
              onValueChange={(value) => {
                setFactoryId(value);
                setPage(1);
              }}
              options={[{ value: "", label: t("all") }, ...factories]}
            />
          </Field>
        ) : null}
        <Field label={t("kind")} className="w-44">
          <NativeSelect
            value={kind}
            onValueChange={(value) => {
              setKind(value as Kind | "");
              setPage(1);
            }}
            options={[
              { value: "", label: t("all") },
              ...(["plates", "die_block"] as const).map((k) => ({ value: k, label: t(`kinds.${k}`) })),
            ]}
          />
        </Field>
        <Field label={t("status")} className="w-44">
          <NativeSelect
            value={status}
            onValueChange={(value) => {
              setStatus(value as Status | "");
              setPage(1);
            }}
            options={[
              { value: "", label: t("all") },
              ...(["active", "unusable"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) })),
            ]}
          />
        </Field>
      </div>
      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={t("title")}
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(row) => row.id}
          loading={query.isPending}
          rowTone={(row) => (row.status === "unusable" ? "danger" : undefined)}
          empty={<EmptyState icon="wrench" title={t("empty")} description={t("emptyHint")} />}
        />
      )}
      {data && data.meta.total > data.meta.perPage ? (
        <Pagination
          page={data.meta.page}
          perPage={data.meta.perPage}
          total={data.meta.total}
          onPageChange={setPage}
          labels={{
            nav: tList("pagination"),
            previous: tList("previous"),
            next: tList("next"),
            range: (from, to, total) => tList("range", { from, to, total }),
            pageOf: (current, pages) => tList("pageOf", { page: current, pages }),
            perPage: tList("perPage"),
          }}
        />
      ) : null}
    </div>
  );
}
