"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { POINTS_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";

import { adminBrowserApis, QueryError, Section, StatusChip } from "../console";
import { PartyOrders } from "../orders";
import { useGeoName } from "./geo";
import type { Customer, CustomerConsent, CustomerTab, Loyalty, PointsEntry } from "./resources";

/**
 * One customer (F2 2.7): profile with addresses and tax profiles, orders, points (balance and
 * the append-only ledger, D-130…D-135) and consents (PDPA) — all read-only here: the customer
 * changes their own details and consents in the store.
 *
 * Composed from the published customer, its addresses, tax profiles and loyalty summary. The
 * customer carries no company, order count, last order or referral code, and the referrals it
 * made cannot be listed (CONTRACT-GAP admin.customers, admin.referrals).
 */
export function CustomerDetail({
  customerId,
  initial,
  tab,
}: {
  customerId: string;
  initial: Customer | null;
  tab: CustomerTab;
}) {
  const t = useTranslations("customers.detail");
  const pathname = usePathname();
  const [current, setCurrent] = useState<string>(tab);
  const query = useQuery({
    queryKey: queryKeys.detail("admin", "customer", customerId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}", { params: { path: { customerId } } }))
        .data!,
    initialData: initial ?? undefined,
  });
  const loyalty = useLoyalty(customerId);
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const customer = query.data;
  if (!customer) return null;

  const go = (next: string) => {
    setCurrent(next);
    window.history.replaceState(null, "", next === "profile" ? pathname : `${pathname}?tab=${next}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[
              { label: t("customers"), href: "/customers" },
              { label: customer.customerCode ?? customer.displayName },
            ]}
          />
        }
        title={customer.displayName}
        meta={
          <>
            {customer.customerCode ? (
              <span className="text-muted font-mono text-sm">{customer.customerCode}</span>
            ) : null}
            <Badge>{t(`types.${customer.customerType}`)}</Badge>
            {loyalty.data ? (
              <Badge tone="primary" icon="star">
                {t(`tiers.${loyalty.data.tier}`)}
              </Badge>
            ) : null}
          </>
        }
      />
      <Tabs
        label={t("tabsLabel")}
        value={current}
        onValueChange={go}
        items={[
          {
            value: "profile",
            label: t("tabs.profile"),
            content: <Profile customer={customer} loyalty={loyalty.data} />,
          },
          { value: "orders", label: t("tabs.orders"), content: <PartyOrders customer={customer} /> },
          { value: "points", label: t("tabs.points"), content: <Points customerId={customer.id} /> },
          { value: "consents", label: t("tabs.consents"), content: <Consents customer={customer} /> },
        ]}
      />
    </div>
  );
}

function useLoyalty(customerId: string) {
  return useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId, "loyalty"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/loyalty", {
          params: { path: { customerId } },
        })
      ).data!,
  });
}

function Profile({ customer, loyalty }: { customer: Customer; loyalty: Loyalty | undefined }) {
  const t = useTranslations("customers.detail");
  const format = useFormat();
  const geo = useGeoName();
  const path = { customerId: customer.id };
  const addresses = useQuery({
    queryKey: queryKeys.related("admin", "customer", customer.id, "addresses"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/addresses", {
          params: { path, query: { perPage: 100 } },
        })
      ).data!,
  });
  const taxProfiles = useQuery({
    queryKey: queryKeys.related("admin", "customer", customer.id, "tax_profiles"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/tax-profiles", {
          params: { path, query: { perPage: 100 } },
        })
      ).data!,
  });
  const addressRows = addresses.data?.data ?? [];
  const profileRows = taxProfiles.data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("profile")}>
        <DescriptionList
          columns={3}
          items={[
            { term: t("phone"), description: customer.phone ?? "–" },
            { term: t("email"), description: customer.email ?? "–" },
            { term: t("via"), description: t(`channels.${customer.createdVia}`) },
            { term: t("since"), description: <When at={customer.createdAt} absoluteOnly /> },
            { term: t("spend12m"), description: loyalty ? format.thb(loyalty.spend12m) : "–" },
          ]}
        />
      </Section>
      <Section title={t("addresses")}>
        {addresses.isError ? <QueryError error={addresses.error} onRetry={() => void addresses.refetch()} /> : null}
        {addresses.isSuccess && addressRows.length === 0 ? (
          <p className="text-muted text-sm">{t("noAddresses")}</p>
        ) : null}
        <ul className="divide-border divide-y text-sm">
          {addressRows.map((address) => (
            <li key={address.id} className="flex flex-wrap items-start gap-2 py-2">
              <Badge size="sm">{t(`addressKinds.${address.kind}`)}</Badge>
              {address.isDefault ? (
                <Badge size="sm" tone="primary">
                  {t("default")}
                </Badge>
              ) : null}
              <div className="min-w-0">
                <p className="font-medium">
                  {address.label} · {address.recipientName} · {address.phone}
                </p>
                <p className="text-muted">
                  {[address.line1, address.line2, geo(address.subdistrict), geo(address.province), address.postcode]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("taxProfiles")}>
        {taxProfiles.isError ? (
          <QueryError error={taxProfiles.error} onRetry={() => void taxProfiles.refetch()} />
        ) : null}
        {taxProfiles.isSuccess && profileRows.length === 0 ? (
          <p className="text-muted text-sm">{t("noTaxProfiles")}</p>
        ) : null}
        <ul className="divide-border divide-y text-sm">
          {profileRows.map((profile) => (
            <li key={profile.id} className="py-2">
              <p className="font-medium">
                {profile.name}{" "}
                {profile.isDefault ? (
                  <Badge size="sm" tone="primary">
                    {t("default")}
                  </Badge>
                ) : null}
              </p>
              <p className="text-muted">
                <span className="font-mono">{profile.taxId}</span> ·{" "}
                {profile.branchType === "head_office" ? t("headOffice") : t("branch", { code: profile.branchCode })}
                {profile.withholdsTax ? ` · ${t("withholds")}` : ""}
              </p>
              <p className="text-muted">
                {[profile.line1, profile.line2, geo(profile.subdistrict), geo(profile.province), profile.postcode]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Points({ customerId }: { customerId: string }) {
  const t = useTranslations("customers.points");
  const format = useFormat();
  const loyalty = useLoyalty(customerId);
  const ledger = useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId, "points"),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/loyalty/ledger", {
          params: { path: { customerId }, query: { perPage: 100 } },
        })
      ).data!,
  });
  if (ledger.isError) return <QueryError error={ledger.error} onRetry={() => void ledger.refetch()} />;
  const balance = loyalty.data;
  // The summary lists each expiring batch; the tile shows their sum and the first date.
  const expiring = balance?.expiringSoon ?? [];
  const expiringPoints = expiring.reduce((sum, batch) => sum + batch.points, 0);
  const expiringFirst = [...expiring].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0]?.expiresAt ?? null;

  const columns: DataTableColumn<PointsEntry>[] = [
    { id: "createdAt", header: t("when"), cell: (row) => <When at={row.createdAt} /> },
    { id: "entryType", header: t("entry"), cell: (row) => t(`types.${row.entryType}`) },
    {
      id: "order",
      header: t("order"),
      // The entry names its order by code only, so it is shown, not linked (CONTRACT-GAP admin.customer-loyalty).
      cell: (row) => <span className="font-mono">{row.orderCode ?? row.groupCode ?? "–"}</span>,
    },
    {
      id: "points",
      header: t("points"),
      numeric: true,
      cell: (row) => (
        <span className={row.points < 0 ? "text-danger" : undefined}>
          {row.points > 0 ? "+" : ""}
          {format.number(row.points)}
        </span>
      ),
    },
    { id: "value", header: t("value"), numeric: true, cell: (row) => format.thb(row.bahtValue) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusChip map={POINTS_STATUS} value={row.status} />,
    },
    {
      id: "dates",
      header: t("dates"),
      cell: (row) =>
        row.status === "pending" && row.availableAt ? (
          <span className="text-sm">
            {t("availableOn")} <When at={row.availableAt} absoluteOnly />
          </span>
        ) : row.expiresAt ? (
          <span className="text-sm">
            {t("expiresOn")} <When at={row.expiresAt} absoluteOnly />
          </span>
        ) : (
          "–"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {balance ? (
        <dl className="grid gap-3 sm:grid-cols-4">
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("available")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(balance.availablePoints)}</dd>
            <dd className="text-muted text-xs">{t("worth", { value: format.thb(balance.availableValue) })}</dd>
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("pending")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(balance.pendingPoints)}</dd>
            <dd className="text-muted text-xs">{t("pendingNote")}</dd>
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("expiringSoon")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(expiringPoints)}</dd>
            {expiringFirst ? (
              <dd className="text-muted text-xs">
                <When at={expiringFirst} absoluteOnly />
              </dd>
            ) : null}
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("tier")}</dt>
            <dd className="text-xl font-semibold">{t(`tiers.${balance.tier}`)}</dd>
            <dd className="text-muted text-xs">{t("spend", { value: format.thb(balance.spend12m) })}</dd>
          </div>
        </dl>
      ) : null}
      <DataTable
        caption={t("ledger")}
        columns={columns}
        rows={ledger.data?.data ?? []}
        getRowId={(row) => row.id}
        loading={ledger.isPending}
        density="compact"
        empty={<EmptyState icon="star" title={t("empty")} />}
      />
    </div>
  );
}

function Consents({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.consents");
  const consents = useQuery({
    queryKey: queryKeys.related("admin", "customer", customer.id, "consents"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/customers/{customerId}/consents", { path: { customerId: customer.id } }),
  });
  if (consents.isError) return <QueryError error={consents.error} onRetry={() => void consents.refetch()} />;

  const columns: DataTableColumn<CustomerConsent>[] = [
    {
      id: "purpose",
      header: t("purpose"),
      cell: (row) => (
        <span>
          {t.has(`purposes.${row.purpose}`) ? t(`purposes.${row.purpose}`) : row.purpose}
          {row.required ? (
            <Badge size="sm" className="ms-2">
              {t("required")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "granted",
      header: t("decision"),
      cell: (row) =>
        row.granted === null ? (
          <span className="text-muted">{t("notAsked")}</span>
        ) : (
          <Badge tone={row.granted ? "success" : "neutral"} icon={row.granted ? "check" : "ban"} size="sm">
            {row.granted ? t("granted") : t("declined")}
          </Badge>
        ),
    },
    {
      id: "version",
      header: t("version"),
      cell: (row) =>
        row.versionNo === null ? (
          "–"
        ) : (
          <span>
            {t("versionNo", { no: row.versionNo })}
            {row.outdated ? (
              <Badge tone="warning" size="sm" className="ms-2">
                {t("outdated")}
              </Badge>
            ) : null}
          </span>
        ),
    },
    { id: "source", header: t("source"), cell: (row) => (row.source ? t(`sources.${row.source}`) : "–") },
    { id: "recordedAt", header: t("when"), cell: (row) => (row.recordedAt ? <When at={row.recordedAt} /> : "–") },
  ];

  return (
    <Section title={t("title")} description={t("note")}>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={consents.data ?? []}
        getRowId={(row) => row.purpose}
        loading={consents.isPending}
        density="compact"
      />
    </Section>
  );
}
