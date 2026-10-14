import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { RuleEditor, RuleVersionActions } from "@/features/partner/ledger/RuleEditor";
import { type AccountOption, ledgerAccounts } from "@/features/partner/ledger/server";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.accounts.views"))("rules") };
}

type Version = Schemas["ErpGlRuleVersionDto"];
type TemplateLine = Schemas["ErpGlTemplateLineDto"];

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { approved: "success", proposed: "warning", rejected: "danger" };

/** One posting rule (D-388, D-398): the version in force, every version with its decision, and the editor. */
export default async function RulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  const [t, tc, tv, format, context] = await Promise.all([
    getTranslations("partnerLedger.rules"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.accounts.views"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const back = { href: "/ledger/accounts?view=rules", label: t("back") };
  const read = await attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/rules/{ruleId}", { params: { path: { ...path, ruleId } } })).data!);
  if (!read.data)
    return (
      <PartnerPage title={tv("rules")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const rule = read.data;
  const editing = rule.nextActions.some((a) => a.key === "erp_rule.propose");
  const [accounts, settings] = await Promise.all([
    ledgerAccounts(contract, context.factoryId, false),
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/settings", { params: { path } })).data!),
  ]);
  const names = new Map(accounts.map((a) => [a.code, a.nameTh]));
  const current = rule.versions.find((v) => v.current) ?? null;
  const pending = rule.versions.find((v) => v.status === "proposed") ?? null;
  const day = (v: Version) => (v.effectiveFrom.startsWith("1970-01-01") ? t("fromStart") : format.date(v.effectiveFrom));

  const fixed: AccountOption[] = accounts.filter((a) => a.status === "active" && a.isPostable).map((a) => ({ id: a.code, label: `${a.code} ${a.nameTh}` }));
  const methods = (settings?.data?.methodAccounts ?? {}) as Record<string, string>;
  const documentAccounts: AccountOption[] = [
    ...rule.purposes.map((p) => {
      const code = methods[p] ?? "";
      return { id: `accounts.${p}`, label: t("purposeAccount", { code, name: names.get(code) ?? "" }), hint: `accounts.${p}` };
    }),
    ...rule.variables.filter((v) => v.kind === "account").map((v) => ({ id: v.path, label: v.label, hint: v.path })),
  ];

  const account = (l: TemplateLine) =>
    l.accountCode ? (
      <span>
        <span className="font-mono">{l.accountCode}</span> {names.get(l.accountCode) ?? ""}
      </span>
    ) : l.accountPath?.startsWith("accounts.") ? (
      <span>
        <span className="font-mono">{methods[l.accountPath.slice(9)] ?? ""}</span> {names.get(methods[l.accountPath.slice(9)] ?? "") ?? ""} <span className="text-muted font-mono text-xs">{l.accountPath}</span>
      </span>
    ) : (
      <span>
        {rule.variables.find((v) => v.path === l.accountPath)?.label ?? ""} <span className="text-muted font-mono text-xs">{l.accountPath}</span>
      </span>
    );
  const lines = (v: Version, caption: string) => (
    <PartnerTable
      caption={caption}
      rows={v.template.lines.map((l, i) => ({ ...l, id: String(i) }))}
      rowKey={(row) => row.id}
      columns={[
        { key: "a", header: t("account"), primary: true, cell: (row) => account(row) },
        { key: "s", header: t("side"), cell: (row) => (row.side === "debit" ? tc("debit") : tc("credit")) },
        { key: "m", header: t("amount"), cell: (row) => <span className="font-mono text-sm">{row.amount}</span> },
        {
          key: "w",
          header: t("condition"),
          hideOnPhone: true,
          cell: (row) => (
            <span className="text-sm">
              {row.forEach ? t("forEach", { list: rule.variables.find((x) => x.path === row.forEach)?.label ?? row.forEach }) : null}
              {row.when ? t("when", { field: rule.variables.find((x) => x.path === row.when!.field)?.label ?? row.when.field, op: t(`ops.${row.when.op}` as never), value: row.when.value, sep: row.forEach ? " " : "" }) : null}
              {!row.forEach && !row.when ? t("always") : null}
            </span>
          ),
        },
        { key: "x", header: t("taxCode"), hideOnPhone: true, cell: (row) => (row.taxCode ? t("taxOn", { code: t(`taxCodes.${row.taxCode}` as never), base: row.taxBase ?? "" }) : "") },
      ]}
    />
  );

  return (
    <PartnerPage
      full
      back={back}
      title={t("title", { key: rule.key, name: rule.name })}
      description={t("eventIs", { event: rule.eventType })}
    >
      <p className="text-muted text-sm">{tc("cpaCaveat")}</p>
      {pending ? <Callout tone="warning">{t("pendingBanner", { n: pending.versionNo, date: day(pending) })}</Callout> : null}

      <PartnerSection title={t("current")} description={current ? t("currentBody", { n: current.versionNo, date: day(current) }) : t("noCurrent")}>
        {current ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{t("entryTextIs", { text: current.template.description })}</p>
            {lines(current, t("current"))}
          </div>
        ) : null}
      </PartnerSection>

      {editing ? (
        <PartnerSection title={t("edit")}>
          <RuleEditor key={`${current?.id ?? "none"}-${pending?.id ?? "none"}`} rule={rule} current={current} accounts={fixed} documentAccounts={documentAccounts} />
        </PartnerSection>
      ) : null}

      <PartnerSection title={t("variables")} description={t("variablesBody")}>
        <PartnerTable
          caption={t("variables")}
          rows={rule.variables}
          rowKey={(row) => row.path}
          columns={[
            { key: "p", header: t("value"), primary: true, cell: (row) => <span className="font-mono text-sm">{row.path}</span> },
            { key: "l", header: tc("description"), cell: (row) => row.label },
            { key: "k", header: t("kind"), hideOnPhone: true, cell: (row) => t(`kinds.${row.kind}` as never) },
          ]}
        />
      </PartnerSection>

      <PartnerSection title={t("versions")} description={t("versionsBody")}>
        <div className="flex flex-col gap-4">
          {rule.versions.map((v) => (
            <article key={v.id} className="border-border flex flex-col gap-2 rounded-lg border p-3" data-testid="rule-version">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{t("versionNo", { n: v.versionNo })}</h3>
                <Badge tone={STATUS_TONE[v.status] ?? "neutral"}>{t(`statuses.${v.status}` as never)}</Badge>
                {v.current ? <Badge tone="info">{t("inForce")}</Badge> : null}
                <span className="text-muted text-sm">{t("effectiveOn", { date: day(v) })}</span>
              </div>
              <p className="text-sm">{t("reasonIs", { reason: v.reason })}</p>
              <p className="text-muted text-xs">
                {t("proposedBy", { name: v.createdBy ?? t("system"), date: format.dateTime(v.createdAt) })}
                {v.decidedAt && v.status !== "proposed" ? t("andDecided", { decided: t("decidedBy", { name: v.decidedBy ?? t("system"), date: format.dateTime(v.decidedAt) }) }) : null}
              </p>
              {v.status === "proposed" ? (
                <>
                  <p className="text-sm">{t("entryTextIs", { text: v.template.description })}</p>
                  {lines(v, t("versionNo", { n: v.versionNo }))}
                  <RuleVersionActions ruleId={rule.id} version={v} />
                </>
              ) : null}
            </article>
          ))}
        </div>
      </PartnerSection>
    </PartnerPage>
  );
}
