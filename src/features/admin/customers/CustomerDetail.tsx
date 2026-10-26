"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import Link from "next/link";

import { POINTS_STATUS, REFERRAL_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { DataTable, type DataTableColumn } from "@/ui/components/DataTable";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Field } from "@/ui/components/Field";
import { PageHeader } from "@/ui/components/PageHeader";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { Tabs } from "@/ui/components/Tabs";

import { adminBrowserApis, QueryError, Section, StatusChip, useCan } from "../console";
import { PartyOrders } from "../orders";
import { AdjustPointsButton, EditAddressButton } from "./CustomerActions";
import { useGeoName } from "./geo";
import type { Customer, CustomerConsent, CustomerTab, Loyalty, PointsEntry, Referral } from "./resources";

/**
 * One customer (F2 2.7): profile with addresses and tax profiles, orders, points (balance and
 * the append-only ledger, D-130…D-135) and consents (PDPA) — all read-only here: the customer
 * changes their own details and consents in the store.
 *
 * Composed from the published customer (with its company, order count, last order and referral
 * code, v0.5.0), its addresses, tax profiles, loyalty summary, the referrals it made
 * (`admin.referrals.list?referrerId`) and its consents (`admin.consentPurposes.customerConsents`).
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
              <span className="text-muted text-sm tabular-nums">{customer.customerCode}</span>
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
          { value: "referrals", label: t("tabs.referrals"), content: <Referrals customer={customer} /> },
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
            ...(customer.companyName ? [{ term: t("company"), description: customer.companyName }] : []),
            { term: t("via"), description: t(`channels.${customer.createdVia}`) },
            { term: t("since"), description: <When at={customer.createdAt} absoluteOnly /> },
            { term: t("orders"), description: format.number(customer.ordersCount) },
            {
              term: t("lastOrder"),
              description: customer.lastOrderAt ? <When at={customer.lastOrderAt} absoluteOnly /> : t("never"),
            },
            { term: t("spend12m"), description: loyalty ? format.thb(loyalty.spend12m) : "–" },
            {
              term: t("referralCode"),
              description: <span className="tabular-nums">{customer.referralCode ?? "–"}</span>,
            },
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
              <span className="ms-auto">
                <EditAddressButton customerId={customer.id} address={address} />
              </span>
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
                <span className="tabular-nums">{profile.taxId}</span> ·{" "}
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

const ENTRY_TYPES: PointsEntry["entryType"][] = [
  "earn_order",
  "earn_signup",
  "earn_line_link",
  "earn_review",
  "earn_referral",
  "earn_bonus",
  "redeem",
  "redeem_reversal",
  "reversal_claim_refund",
  "expire",
  "adjust",
];

function Points({ customerId }: { customerId: string }) {
  const t = useTranslations("customers.points");
  const tFilters = useTranslations("console.filters");
  const format = useFormat();
  const loyalty = useLoyalty(customerId);
  const [entryType, setEntryType] = useState<PointsEntry["entryType"] | null>(null);
  const ledger = useQuery({
    queryKey: queryKeys.related("admin", "customer", customerId, `points:${entryType ?? "all"}`),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/loyalty/ledger", {
          params: { path: { customerId }, query: { perPage: 100, ...(entryType ? { entryType } : {}) } },
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
      cell: (row) =>
        row.orderId && row.orderCode ? (
          <Link href={`/orders/${row.orderId}`} className="text-primary tabular-nums hover:underline">
            {row.orderCode}
          </Link>
        ) : (
          <span className="tabular-nums">{row.orderCode ?? row.groupCode ?? "–"}</span>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t("entryFilter")} className="w-60">
          <SearchableSelect
            value={entryType ?? ANY}
            onValueChange={(next) => setEntryType(next === ANY ? null : (next as PointsEntry["entryType"]))}
            options={[
              { value: ANY, label: tFilters("any") },
              ...ENTRY_TYPES.map((value) => ({ value, label: t(`types.${value}`) })),
            ]}
          />
        </Field>
        <AdjustPointsButton customerId={customerId} available={balance?.availablePoints ?? 0} />
      </div>
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

/** Radix Select cannot hold an empty value: "any" is a sentinel that never reaches the API. */
const ANY = "__any";

/**
 * The friends this customer referred (`admin.referrals.list?referrerId`, D-136), with the reward
 * and the fraud flags the API raised. The list needs `promotions.read`; a role without it is told so.
 */
function Referrals({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.referrals");
  const format = useFormat();
  const allowed = useCan("promotions.read");
  const referrals = useQuery({
    queryKey: queryKeys.list("admin", "referral", { referrerId: customer.id }),
    enabled: allowed,
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/referrals", {
          params: { query: { referrerId: customer.id, perPage: 100 } },
        })
      ).data!,
  });
  if (!allowed) return <EmptyState icon="users" title={t("unreadable")} />;
  if (referrals.isError) return <QueryError error={referrals.error} onRetry={() => void referrals.refetch()} />;
  const columns: DataTableColumn<Referral>[] = [
    { id: "referee", header: t("referee"), cell: (row) => row.referee.displayName },
    { id: "attributedAt", header: t("when"), cell: (row) => <When at={row.attributedAt} absoluteOnly /> },
    {
      id: "firstOrder",
      header: t("firstOrder"),
      cell: (row) =>
        row.firstOrderGroupCode ? (
          <div className="text-sm">
            <p className="tabular-nums">{row.firstOrderGroupCode}</p>
            <p className="text-muted text-xs tabular-nums">
              {format.thb(row.firstOrderGrossAmount)}
              {row.firstOrderClaimWindowEndsAt ? (
                <>
                  {" · "}
                  {t("claimWindow")} <When at={row.firstOrderClaimWindowEndsAt} absoluteOnly />
                </>
              ) : null}
            </p>
          </div>
        ) : (
          "–"
        ),
    },
    { id: "reward", header: t("reward"), numeric: true, cell: (row) => format.number(row.rewardPoints) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusChip map={REFERRAL_STATUS} value={row.status} />
          {row.fraudFlags.map((flag) => (
            <Badge key={flag} size="sm" tone="warning">
              {t(`flags.${flag}`)}
            </Badge>
          ))}
        </div>
      ),
    },
  ];
  return (
    <Section
      title={t("title", { code: customer.referralCode ?? "–" })}
      description={t("note")}
      actions={
        <Link href="/marketing/referrals?status=under_review" className="text-primary text-sm hover:underline">
          {t("queue")}
        </Link>
      }
    >
      <DataTable
        caption={t("title", { code: customer.referralCode ?? "–" })}
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
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/customers/{customerId}/consents", {
          params: { path: { customerId: customer.id } },
        })
      ).data!,
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
      // The version the decision was for, and the one in force when a newer text supersedes it.
      cell: (row) =>
        row.decidedVersionNo === null ? (
          "–"
        ) : (
          <span>
            {t("versionNo", { no: row.decidedVersionNo })}
            {row.outdated ? (
              <Badge tone="warning" size="sm" className="ms-2">
                {row.versionNo === null ? t("outdated") : t("outdatedVersion", { no: row.versionNo })}
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
