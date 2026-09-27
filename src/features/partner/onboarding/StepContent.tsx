import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { BANK_ACCOUNT_STATUS, CHANGE_REQUEST_STATUS, KYC_STATUS, SITE_VISIT_RESULT } from "@/domain/status";
import { formatTaxId } from "@/domain/tax-id";
import { attempt, canAt, partnerServerApis, type FactoryContext } from "@/features/partner/context/server";
import { PageError, PartnerSection } from "@/features/partner/frame";
import { ChangeRequestForm } from "@/features/partner/requests/ChangeRequestForm";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";

import {
  AcceptAgreement,
  AddressForm,
  BankAccountForm,
  CompanyForm,
  ContactForm,
  KycUpload,
  SubmitApplication,
} from "./forms";
import type { OnboardingStep } from "./steps";

type Props = { context: FactoryContext };

/** The factory's own catalogue names: product types and price references (`partner.references`). */
export async function factoryReferences(factoryId: string) {
  const { requests } = await partnerServerApis();
  const { data } = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/references", { path: { factoryId } }),
  );
  const types = new Map((data?.productTypes ?? []).map((type) => [type.id, type]));
  const byCode = new Map((data?.productTypes ?? []).map((type) => [type.code, type]));
  return {
    productTypes: data?.productTypes ?? [],
    typeName: (idOrCode: string | null | undefined) =>
      (idOrCode && (types.get(idOrCode)?.name ?? byCode.get(idOrCode)?.name)) || idOrCode || "—",
    columns: data?.columns ?? [],
  };
}

/** Editable while applying (B2.2): afterwards the factory asks the Partner team instead. */
const editable = (context: Props["context"]) =>
  ["applied", "under_review"].includes(context.factory?.status ?? "") && canAt(context, "factory_profile.manage");

export async function StepContent({ step, context }: { step: OnboardingStep } & Props) {
  switch (step) {
    case "application":
      return <Application context={context} />;
    case "kyc":
      return <Kyc context={context} />;
    case "bank_account":
      return <BankAccounts context={context} />;
    case "capability":
      return <Capabilities context={context} />;
    case "capacity":
      return <Capacity context={context} />;
    case "delivery_zones":
      return <DeliveryZones context={context} />;
    case "pricing_arrangement":
      return <PricingArrangement context={context} />;
    case "tolerance":
      return <Tolerance context={context} />;
    case "payout_policy":
      return <PayoutPolicy context={context} />;
    case "agreement":
      return <Agreements context={context} />;
    case "site_visit":
      return <SiteVisits context={context} />;
    case "trial":
      return <Trial context={context} />;
    default:
      return <Activation context={context} />;
  }
}

/* ------------------------------------------------------------------------ application */

async function Application({ context }: Props) {
  const t = await getTranslations("partnerOnboarding");
  const { contract } = await partnerServerApis();
  const path = { params: { path: { factoryId: context.factoryId } } };
  const [factory, addresses, contacts] = await Promise.all([
    attempt(async () => {
      const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}", path);
      return { factory: data!, etag: response.headers.get("etag") };
    }),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/addresses", path)).data ?? []),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/contacts", path)).data ?? []),
  ]);
  if (!factory.data) return <PageError error={factory.error} />;
  const { factory: own, etag } = factory.data;
  const canEdit = editable(context);

  return (
    <>
      <PartnerSection title={t("company.title")} description={canEdit ? t("company.editable") : t("company.locked")}>
        <Card padding="lg">
          {canEdit ? (
            <CompanyForm
              etag={etag}
              initial={{
                legalName: own.legalName,
                tradeName: own.tradeName,
                juristicType: own.juristicType,
                taxId: own.taxId,
                branchCode: own.branchCode,
                isVatRegistered: own.isVatRegistered,
                vatRegisteredOn: own.vatRegisteredOn,
              }}
            />
          ) : (
            <DescriptionList
              items={[
                { term: t("company.legalName"), description: own.legalName },
                { term: t("company.tradeName"), description: own.tradeName ?? "—" },
                { term: t("company.taxId"), description: formatTaxId(own.taxId) },
                { term: t("company.branchCode"), description: own.branchCode },
                {
                  term: t("company.vatRegistered"),
                  description: own.isVatRegistered ? t("company.yes") : t("company.no"),
                },
              ]}
            />
          )}
        </Card>
      </PartnerSection>

      <PartnerSection title={t("addresses.title")}>
        {addresses.data?.length ? (
          <ul className="flex flex-col gap-2">
            {addresses.data.map((address) => (
              <li key={address.id}>
                <Card padding="md">
                  <Badge size="sm">{t(`addresses.kinds.${address.kind}`)}</Badge>
                  <p className="mt-2">{[address.line1, address.line2, address.postcode].filter(Boolean).join(" ")}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("addresses.empty")}</p>
        )}
        {canEdit ? (
          <Card padding="lg">
            <AddressForm />
          </Card>
        ) : null}
      </PartnerSection>

      <PartnerSection title={t("contacts.title")}>
        {contacts.data?.length ? (
          <ul className="flex flex-col gap-2">
            {contacts.data.map((contact) => (
              <li key={contact.id}>
                <Card padding="md">
                  <p className="font-medium">
                    {contact.name}{" "}
                    {contact.isPrimary ? (
                      <Badge size="sm" tone="primary">
                        {t("contacts.primaryBadge")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted text-sm">
                    {[contact.roleTitle, contact.phone, contact.email].filter(Boolean).join(" · ")}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("contacts.empty")}</p>
        )}
        {canEdit ? (
          <Card padding="lg">
            <ContactForm />
          </Card>
        ) : null}
      </PartnerSection>

      {own.status === "applied" ? (
        <PartnerSection title={t("submit.sectionTitle")} description={t("submit.sectionBody")}>
          <SubmitApplication etag={etag} factoryName={own.tradeName ?? own.legalName} />
        </PartnerSection>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------------- KYC */

async function Kyc({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.kyc");
  const format = await getFormat();
  const { contract } = await partnerServerApis();
  const docs = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/kyc-documents", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data ?? [],
  );
  if (!docs.data) return <PageError error={docs.error} />;
  return (
    <>
      <PartnerSection title={t("title")} description={t("body")}>
        {docs.data.length ? (
          <ul className="flex flex-col gap-2">
            {docs.data.map((doc) => (
              <li key={doc.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-medium">{t(`types.${doc.docType}`)}</span>
                  <StatusChip map={KYC_STATUS} value={doc.status} size="md" />
                  <p className="text-muted w-full text-sm">
                    {t("dates", { issued: format.date(doc.issuedOn), expires: format.date(doc.expiresOn) })}
                  </p>
                  {doc.note ? <p className="w-full text-sm">{doc.note}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="document" title={t("empty")} description={t("emptyBody")} />
        )}
      </PartnerSection>
      {editable(context) ? (
        <PartnerSection title={t("addTitle")}>
          <Card padding="lg">
            <KycUpload />
          </Card>
        </PartnerSection>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------------- bank account */

async function BankAccounts({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.bank");
  const format = await getFormat();
  const { contract } = await partnerServerApis();
  const banks = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/bank-accounts", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data ?? [],
  );
  if (!banks.data) return <PageError error={banks.error} />;
  const pending = banks.data.some((bank) => bank.status === "pending_approval");
  return (
    <>
      <PartnerSection title={t("title")} description={t("body")}>
        {banks.data.length ? (
          <ul className="flex flex-col gap-2">
            {banks.data.map((bank) => (
              <li key={bank.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-mono">
                    {t("masked", { bank: bank.bankCode, last4: bank.accountNoLast4 })}
                  </span>
                  <StatusChip map={BANK_ACCOUNT_STATUS} value={bank.status} size="md" />
                  <p className="text-muted w-full text-sm">
                    {bank.accountName}
                    {bank.branchName ? ` · ${bank.branchName}` : ""} ·{" "}
                    {bank.effectiveFrom
                      ? t("effective", { date: format.date(bank.effectiveFrom) })
                      : t("proposedOn", { date: format.date(bank.createdAt) })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="wallet" title={t("empty")} />
        )}
      </PartnerSection>
      {canAt(context, "factory_bank_account.propose") ? (
        <PartnerSection title={t("changeTitle")} description={t("changeBody")}>
          {pending ? (
            <Callout tone="info" title={t("pendingTitle")}>
              {t("pendingBody")}
            </Callout>
          ) : (
            <Card padding="lg">
              <BankAccountForm defaultName={context.factory?.legalName ?? ""} />
            </Card>
          )}
        </PartnerSection>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ recorded by Packio */

async function RecordedNote() {
  const t = await getTranslations("partnerOnboarding");
  return (
    <Callout tone="info" icon="info">
      {t("recordedByPackio")}
    </Callout>
  );
}

async function Capabilities({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.capability");
  const format = await getFormat();
  const { contract } = await partnerServerApis();
  const [capabilities, references] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/capabilities", {
            params: { path: { factoryId: context.factoryId } },
          })
        ).data ?? [],
    ),
    factoryReferences(context.factoryId),
  ]);
  if (!capabilities.data) return <PageError error={capabilities.error} />;
  const range = (min: number | null, max: number | null) =>
    min === null && max === null
      ? "—"
      : t("qtyRange", { min: min === null ? "—" : format.number(min), max: max === null ? "—" : format.number(max) });
  return (
    <>
      <RecordedNote />
      <PartnerSection title={t("title")}>
        <ul className="flex flex-col gap-2">
          {capabilities.data.map((capability) => (
            <li key={capability.id}>
              <Card padding="md">
                <p className="font-medium">{references.typeName(capability.productTypeId)}</p>
                <DescriptionList
                  className="mt-2"
                  items={[
                    { term: t("orderQty"), description: range(capability.minOrderQty, capability.maxOrderQty) },
                    {
                      term: t("maxSheet"),
                      description:
                        capability.maxSheetWidthMm && capability.maxSheetLengthMm
                          ? t("sheetMm", {
                              width: format.number(capability.maxSheetWidthMm),
                              length: format.number(capability.maxSheetLengthMm),
                            })
                          : "—",
                    },
                  ]}
                />
              </Card>
            </li>
          ))}
        </ul>
      </PartnerSection>
      <PartnerSection title={t("askTitle")} description={t("askBody")}>
        <Card padding="lg">
          <ChangeRequestForm
            topic="capability"
            productTypes={references.productTypes}
            placeholder={t("askPlaceholder")}
          />
        </Card>
      </PartnerSection>
    </>
  );
}

async function Capacity({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.capacity");
  const format = await getFormat();
  const { contract } = await partnerServerApis();
  const [config, references] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/configuration", {
            params: { path: { factoryId: context.factoryId } },
          })
        ).data!,
    ),
    factoryReferences(context.factoryId),
  ]);
  if (!config.data) return <PageError error={config.error} />;
  const weeks = await Promise.all(
    config.data.capacities.map((capacity) =>
      attempt(
        async () =>
          (
            await contract.GET("/v1/partner/factories/{factoryId}/capacity", {
              params: {
                path: { factoryId: context.factoryId },
                query: { productTypeId: capacity.productTypeId, weeks: 6 },
              },
            })
          ).data ?? [],
      ),
    ),
  );
  return (
    <>
      <RecordedNote />
      {config.data.capacities.map((capacity, index) => (
        <PartnerSection key={capacity.productTypeId} title={references.typeName(capacity.productTypeId)}>
          <Card padding="md">
            <p>
              {capacity.current
                ? t("weekly", {
                    amount: format.number(Number(capacity.current.weeklyCapacity)),
                    unit: t(`units.${capacity.current.capacityUnit}`),
                  })
                : t("none")}
            </p>
            {capacity.upcoming.map((version) => (
              <p key={version.versionNo} className="text-muted text-sm">
                {t("upcoming", {
                  amount: format.number(Number(version.weeklyCapacity)),
                  unit: t(`units.${version.capacityUnit}`),
                  date: format.date(version.effectiveFrom),
                })}
              </p>
            ))}
            {weeks[index]?.data?.length ? (
              <table className="mt-3 w-full text-sm tabular-nums">
                <caption className="sr-only">{t("weeksCaption")}</caption>
                <thead>
                  <tr className="text-muted text-start">
                    <th scope="col" className="py-1 text-start font-medium">
                      {t("week")}
                    </th>
                    <th scope="col" className="py-1 text-end font-medium">
                      {t("booked")}
                    </th>
                    <th scope="col" className="py-1 text-end font-medium">
                      {t("free")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weeks[index]!.data!.map((week) => (
                    <tr key={week.weekStart} className="border-border border-t">
                      <td className="py-2">{format.date(week.weekStart)}</td>
                      <td className="py-2 text-end">{format.number(Number(week.booked))}</td>
                      <td className="py-2 text-end">{format.number(Number(week.free))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </Card>
        </PartnerSection>
      ))}
      <PartnerSection title={t("askTitle")} description={t("askBody")}>
        <Card padding="lg">
          <ChangeRequestForm
            topic="capacity"
            productTypes={references.productTypes}
            placeholder={t("askPlaceholder")}
          />
        </Card>
      </PartnerSection>
    </>
  );
}

async function DeliveryZones({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.zones");
  const { contract } = await partnerServerApis();
  const zones = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/delivery-zones", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data ?? [],
  );
  if (!zones.data) return <PageError error={zones.error} />;
  return (
    <>
      <RecordedNote />
      <PartnerSection title={t("title")} description={t("body")}>
        <ul className="grid gap-2 md:grid-cols-2">
          {zones.data.map((zone) => (
            <li key={zone.zoneId}>
              <Card padding="md" className="flex items-center gap-2">
                <span className="flex-1 font-medium">{zone.zoneCode}</span>
                {zone.serves ? (
                  <Badge tone="success" icon="check">
                    {zone.extraLeadDays ? t("servesExtra", { days: zone.extraLeadDays }) : t("serves")}
                  </Badge>
                ) : (
                  <Badge tone="neutral">{t("notServed")}</Badge>
                )}
              </Card>
            </li>
          ))}
        </ul>
        {canAt(context, "factory_prices.read") ? (
          <Link href="/prices/shipping" className="text-primary inline-flex min-h-12 items-center underline">
            {t("shippingRates")}
          </Link>
        ) : null}
      </PartnerSection>
      <PartnerSection title={t("askTitle")}>
        <Card padding="lg">
          <ChangeRequestForm topic="delivery_zones" placeholder={t("askPlaceholder")} />
        </Card>
      </PartnerSection>
    </>
  );
}

async function configurationOf(context: FactoryContext) {
  const { contract } = await partnerServerApis();
  return attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/configuration", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
}

async function PricingArrangement({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.pricing");
  const format = await getFormat();
  const [config, references] = await Promise.all([configurationOf(context), factoryReferences(context.factoryId)]);
  if (!config.data) return <PageError error={config.error} />;
  const mode = config.data.pricingArrangement.current?.ownershipMode;
  return (
    <>
      <PartnerSection title={t("modeTitle")}>
        <Card padding="lg">
          <p className="text-lg font-medium">{mode ? t(`modes.${mode}.title`) : t("modeNone")}</p>
          {mode ? <p className="text-muted mt-2">{t(`modes.${mode}.body`)}</p> : null}
          {config.data.pricingArrangement.upcoming.map((version) => (
            <p key={version.versionNo} className="mt-2 text-sm">
              {t("modeUpcoming", {
                mode: t(`modes.${version.ownershipMode}.title`),
                date: format.date(version.effectiveFrom),
              })}
            </p>
          ))}
        </Card>
      </PartnerSection>
      <PartnerSection title={t("tiersTitle")} description={t("tiersBody")}>
        <ul className="flex flex-col gap-2">
          {config.data.participations.map((participation) => {
            const tier = participation.current?.tier;
            return (
              <li key={participation.productTypeId}>
                <Card padding="md">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-medium">{references.typeName(participation.productTypeId)}</span>
                    {tier ? (
                      <Badge tone={tier === "A" ? "success" : tier === "B" ? "primary" : "neutral"}>
                        {t("tierBadge", { tier })}
                      </Badge>
                    ) : null}
                  </div>
                  {tier ? <p className="text-muted mt-2 text-sm">{t(`tiers.${tier}`)}</p> : null}
                  {participation.current?.envelopeNote ? (
                    <p className="mt-1 text-sm">{t("envelope", { note: participation.current.envelopeNote })}</p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
        {canAt(context, "factory_prices.read") ? (
          <Link href="/prices" className="text-primary inline-flex min-h-12 items-center underline">
            {t("openPrices")}
          </Link>
        ) : null}
      </PartnerSection>
      <PartnerSection title={t("askTitle")} description={t("askBody")}>
        <Card padding="lg">
          <ChangeRequestForm
            topic="participation_tier"
            productTypes={references.productTypes}
            placeholder={t("askPlaceholder")}
          />
        </Card>
      </PartnerSection>
    </>
  );
}

async function Tolerance({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.tolerance");
  const format = await getFormat();
  const [config, references] = await Promise.all([configurationOf(context), factoryReferences(context.factoryId)]);
  if (!config.data) return <PageError error={config.error} />;
  return (
    <>
      <PartnerSection title={t("title")} description={t("body")}>
        <ul className="flex flex-col gap-2">
          {config.data.tolerances.map((policy) => (
            <li key={policy.productTypeId ?? "default"}>
              <Card padding="md">
                <p className="font-medium">
                  {policy.productTypeId ? references.typeName(policy.productTypeId) : t("default")}
                </p>
                <p className="mt-1">
                  {policy.current
                    ? t("band", {
                        shortage: format.percent(policy.current.shortagePct),
                        overage: format.percent(policy.current.overagePct),
                      })
                    : t("platformDefault")}
                </p>
                {policy.upcoming.map((version) => (
                  <p key={version.versionNo} className="text-muted mt-1 text-sm">
                    {t("upcoming", {
                      shortage: format.percent(version.shortagePct),
                      overage: format.percent(version.overagePct),
                      date: format.date(version.effectiveFrom),
                    })}
                  </p>
                ))}
              </Card>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">{t("rule")}</p>
      </PartnerSection>
      <PartnerSection title={t("askTitle")} description={t("askBody")}>
        <Card padding="lg">
          <ChangeRequestForm
            topic="tolerance"
            productTypes={references.productTypes}
            placeholder={t("askPlaceholder")}
          />
        </Card>
      </PartnerSection>
    </>
  );
}

async function PayoutPolicy({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.payout");
  const format = await getFormat();
  const config = await configurationOf(context);
  if (!config.data) return <PageError error={config.error} />;
  const policy = config.data.payoutPolicy.current;
  return (
    <PartnerSection title={t("title")} description={t("body")}>
      <Card padding="lg">
        {policy ? (
          <DescriptionList
            columns={1}
            items={[
              {
                term: t("advance"),
                description: t("advanceValue", {
                  pct: format.percent(policy.advancePct),
                  trigger: t(`triggers.${policy.advanceTrigger}`),
                }),
              },
              { term: t("balance"), description: t(`triggers.${policy.balanceTrigger}`) },
              { term: t("claimWindow"), description: t("days", { days: policy.claimWindowDays }) },
              {
                term: t("retention"),
                description: t("retentionValue", {
                  pct: format.percent(policy.retentionPct),
                  days: policy.retentionReleaseDays,
                }),
              },
              { term: t("terms"), description: t("days", { days: policy.paymentTermsDays }) },
              { term: t("since"), description: format.date(policy.effectiveFrom) },
            ]}
          />
        ) : (
          <p>{t("platformDefaults")}</p>
        )}
      </Card>
    </PartnerSection>
  );
}

async function Agreements({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.agreement");
  const format = await getFormat();
  const locale = await getLocale();
  const { contract } = await partnerServerApis();
  const agreements = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/agreements", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data ?? [],
  );
  if (!agreements.data) return <PageError error={agreements.error} />;
  return (
    <>
      {agreements.data.map((agreement: Schemas["AgreementStatusDto"]) => {
        const text = (locale === "en" ? agreement.textEn : agreement.textTh) ?? agreement.textTh ?? agreement.textEn;
        return (
          <PartnerSection key={agreement.key} title={agreement.name}>
            <Card padding="lg" className="flex flex-col gap-3">
              <p className="text-muted text-sm">
                {agreement.versionNo === null
                  ? t("notPublished")
                  : t("version", { version: agreement.versionNo, date: format.date(agreement.effectiveFrom) })}
              </p>
              {text ? (
                <div
                  className="bg-surface-subtle max-h-64 overflow-y-auto rounded-md p-3 text-sm whitespace-pre-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={t("textLabel", { name: agreement.name })}
                >
                  {text}
                </div>
              ) : null}
              {agreement.accepted ? (
                <Callout tone="success" icon="check">
                  {t(agreement.method === "signed_upload" ? "acceptedSigned" : "acceptedOnline", {
                    date: format.dateTime(agreement.acceptedAt),
                  })}
                </Callout>
              ) : agreement.versionNo !== null ? (
                <AcceptAgreement agreementKey={agreement.key} name={agreement.name} versionNo={agreement.versionNo} />
              ) : null}
            </Card>
          </PartnerSection>
        );
      })}
    </>
  );
}

async function SiteVisits({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.visit");
  const format = await getFormat();
  const { requests } = await partnerServerApis();
  const path = { path: { factoryId: context.factoryId } };
  const [visits, asks] = await Promise.all([
    attempt(() => requests.call("GET /v1/partner/factories/{factoryId}/site-visits", path)),
    attempt(() => requests.call("GET /v1/partner/factories/{factoryId}/change-requests", path)),
  ]);
  const scheduled = (asks.data ?? []).filter((ask) => ask.topic === "site_visit");
  return (
    <>
      <PartnerSection title={t("title")} description={t("body")}>
        {visits.data?.length ? (
          <ul className="flex flex-col gap-2">
            {visits.data.map((visit) => (
              <li key={visit.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 font-medium">{format.date(visit.visitedOn)}</span>
                  <StatusChip map={SITE_VISIT_RESULT} value={visit.result} size="md" />
                  {visit.notes ? <p className="w-full text-sm">{visit.notes}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : visits.error ? (
          <PageError error={visits.error} />
        ) : (
          <EmptyState icon="calendar" title={t("empty")} />
        )}
      </PartnerSection>
      {scheduled.length ? (
        <PartnerSection title={t("requestsTitle")}>
          <ul className="flex flex-col gap-2">
            {scheduled.map((ask) => (
              <li key={ask.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">
                    {t("preferred", { dates: ask.preferredDates.map((day) => format.date(day)).join(", ") })}
                  </span>
                  <StatusChip map={CHANGE_REQUEST_STATUS} value={ask.status} size="md" />
                  {ask.response ? <p className="w-full text-sm">{ask.response}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}
      <PartnerSection title={t("askTitle")} description={t("askBody")}>
        <Card padding="lg">
          <ChangeRequestForm topic="site_visit" visit placeholder={t("askPlaceholder")} submitLabel={t("askSubmit")} />
        </Card>
      </PartnerSection>
    </>
  );
}

async function Trial({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.trial");
  return (
    <PartnerSection title={t("title")} description={t("body")}>
      <Card padding="lg">
        <p className="text-lg">{t("completed", { count: context.factory?.trialJobsCompleted ?? 0 })}</p>
      </Card>
    </PartnerSection>
  );
}

async function Activation({ context }: Props) {
  const t = await getTranslations("partnerOnboarding.activation");
  const format = await getFormat();
  const active = context.factory?.activatedAt;
  return (
    <PartnerSection title={t("title")} description={t("body")}>
      <Card padding="lg">
        <p className="text-lg">{active ? t("activeSince", { date: format.date(active) }) : t("notYet")}</p>
      </Card>
    </PartnerSection>
  );
}
