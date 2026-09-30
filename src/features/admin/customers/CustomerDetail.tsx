"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { POINTS_STATUS, REFERRAL_STATUS } from "@/domain/status";
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

import { QueryError, Section, StatusChip, useCan } from "../console";
import type { Referral } from "../marketing/resources";
import { PartyOrders } from "../orders";
import type { Customer, CustomerConsent, CustomerTab, PointsEntry } from "./resources";

/**
 * One customer (F2 2.7): profile with addresses and tax profiles, orders, points (balance and
 * the append-only ledger, D-130…D-135), referrals they made (D-136), and consents (PDPA) — all
 * read-only here: the customer changes their own details and consents in the store.
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
    queryFn: () => browserRequests().call("GET /v1/admin/customers/{customerId}", { path: { customerId } }),
    initialData: initial ?? undefined,
  });
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
            items={[{ label: t("customers"), href: "/customers" }, { label: customer.customerCode }]}
          />
        }
        title={customer.displayName}
        meta={
          <>
            <span className="text-muted font-mono text-sm">{customer.customerCode}</span>
            <Badge>{t(`types.${customer.customerType}`)}</Badge>
            <Badge tone="primary" icon="star">
              {t(`tiers.${customer.loyalty.tier}`)}
            </Badge>
          </>
        }
        description={customer.companyName ?? undefined}
      />
      <Tabs
        label={t("tabsLabel")}
        value={current}
        onValueChange={go}
        items={[
          { value: "profile", label: t("tabs.profile"), content: <Profile customer={customer} /> },
          { value: "orders", label: t("tabs.orders"), content: <PartyOrders customerId={customer.id} /> },
          { value: "points", label: t("tabs.points"), content: <Points customer={customer} /> },
          { value: "referrals", label: t("tabs.referrals"), content: <Referrals customer={customer} /> },
          { value: "consents", label: t("tabs.consents"), content: <Consents customer={customer} /> },
        ]}
      />
    </div>
  );
}

function Profile({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.detail");
  const format = useFormat();
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
            {
              term: t("lastOrder"),
              description: customer.lastOrderAt ? <When at={customer.lastOrderAt} /> : t("never"),
            },
            { term: t("orders"), description: format.number(customer.ordersCount) },
            { term: t("spend12m"), description: format.thb(customer.loyalty.spend12m) },
            { term: t("referralCode"), description: <span className="font-mono">{customer.referralCode}</span> },
          ]}
        />
      </Section>
      <Section title={t("addresses")}>
        {customer.addresses.length === 0 ? <p className="text-muted text-sm">{t("noAddresses")}</p> : null}
        <ul className="divide-border divide-y text-sm">
          {customer.addresses.map((address) => (
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
                  {[
                    address.line1,
                    address.line2,
                    address.subdistrict,
                    address.district,
                    address.province,
                    address.postcode,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("taxProfiles")}>
        {customer.taxProfiles.length === 0 ? <p className="text-muted text-sm">{t("noTaxProfiles")}</p> : null}
        <ul className="divide-border divide-y text-sm">
          {customer.taxProfiles.map((profile) => (
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
              <p className="text-muted">{profile.address}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Points({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.points");
  const format = useFormat();
  const points = useQuery({
    queryKey: queryKeys.related("admin", "customer", customer.id, "points"),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/customers/{customerId}/points", {
        path: { customerId: customer.id },
        query: { perPage: 100 },
      }),
  });
  if (points.isError) return <QueryError error={points.error} onRetry={() => void points.refetch()} />;
  const balance = points.data?.balance;

  const columns: DataTableColumn<PointsEntry>[] = [
    { id: "createdAt", header: t("when"), cell: (row) => <When at={row.createdAt} /> },
    { id: "entryType", header: t("entry"), cell: (row) => t(`types.${row.entryType}`) },
    {
      id: "order",
      header: t("order"),
      cell: (row) =>
        row.order ? (
          <Link href={`/orders/${row.order.id}`} className="text-primary font-mono hover:underline">
            {row.order.orderCode}
          </Link>
        ) : (
          "–"
        ),
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
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={POINTS_STATUS} value={row.status} /> },
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
            <dd className="text-xl font-semibold tabular-nums">{format.number(balance.available)}</dd>
            <dd className="text-muted text-xs">{t("worth", { value: format.thb(balance.availableBahtValue) })}</dd>
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("pending")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(balance.pending)}</dd>
            <dd className="text-muted text-xs">{t("pendingNote")}</dd>
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("expiringSoon")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{format.number(balance.expiringSoon)}</dd>
            {balance.expiringSoonAt ? (
              <dd className="text-muted text-xs">
                <When at={balance.expiringSoonAt} absoluteOnly />
              </dd>
            ) : null}
          </div>
          <div className="bg-surface rounded-md border p-3">
            <dt className="text-muted text-xs">{t("tier")}</dt>
            <dd className="text-xl font-semibold">{t(`tiers.${customer.loyalty.tier}`)}</dd>
            <dd className="text-muted text-xs">{t("spend", { value: format.thb(customer.loyalty.spend12m) })}</dd>
          </div>
        </dl>
      ) : null}
      <DataTable
        caption={t("ledger")}
        columns={columns}
        rows={points.data?.data ?? []}
        getRowId={(row) => row.id}
        loading={points.isPending}
        density="compact"
        empty={<EmptyState icon="star" title={t("empty")} />}
      />
    </div>
  );
}

function Referrals({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.referrals");
  const format = useFormat();
  const canMarketing = useCan("promotions.read");
  const referrals = useQuery({
    queryKey: queryKeys.list("admin", "referral", { referrerId: customer.id }),
    queryFn: () => browserRequests().call("GET /v1/admin/referrals", { query: { referrerId: customer.id } }),
  });
  if (referrals.isError) return <QueryError error={referrals.error} onRetry={() => void referrals.refetch()} />;

  const columns: DataTableColumn<Referral>[] = [
    {
      id: "referee",
      header: t("referee"),
      cell: (row) => (
        <Link href={`/customers/${row.referee.id}`} className="text-primary hover:underline">
          {row.referee.displayName}
        </Link>
      ),
    },
    { id: "attributedAt", header: t("when"), cell: (row) => <When at={row.attributedAt} /> },
    { id: "status", header: t("status"), cell: (row) => <StatusChip map={REFERRAL_STATUS} value={row.status} /> },
    {
      id: "reward",
      header: t("reward"),
      numeric: true,
      cell: (row) => (row.rewardPoints === null ? "–" : format.number(row.rewardPoints)),
    },
  ];

  return (
    <Section
      title={t("title", { code: customer.referralCode })}
      description={t("note")}
      actions={
        canMarketing ? (
          <Link href="/marketing/referrals" className="text-primary text-sm hover:underline">
            {t("queue")}
          </Link>
        ) : null
      }
    >
      <DataTable
        caption={t("title", { code: customer.referralCode })}
        columns={columns}
        rows={referrals.data?.data ?? []}
        getRowId={(row) => row.id}
        loading={referrals.isPending}
        density="compact"
        empty={<EmptyState icon="users" title={t("empty")} />}
      />
    </Section>
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
