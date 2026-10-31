"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FACTORY_STATUS } from "@/domain/status";
import { ifMatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { RecordNav } from "@/ui/components/RecordNav";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, QueryError, StatusChip, useCan } from "../console";
import { adminBrowserApis } from "../console/api";
import { loose } from "../catalogue/api";
import { useFactoryRefresh } from "./hooks";
import { FormDialog } from "./parts";
import type { Factory, FactoryTab } from "./resources";
import { Compliance } from "./tabs/Compliance";
import { Onboarding } from "./tabs/Onboarding";
import { FactoryHours } from "./tabs/Hours";
import { Operations } from "./tabs/Operations";
import { Processes } from "./tabs/Processes";
import { Pricing } from "./tabs/Pricing";
import { Profile } from "./tabs/Profile";
import { ErpSupport } from "./tabs/ErpSupport";
import { SiteVisits } from "./tabs/SiteVisits";
import { Terms } from "./tabs/Terms";
import { FactoryRateCard } from "../shipping";

type Action = Schemas["FactoryStatusAction"];

/**
 * Which status changes the contract documents from each status (`POST …/actions/{action}`,
 * B2.2). The API checks again; this only avoids offering one it is certain to refuse. Trial →
 * active is not here: it is an activation request, approved by the Partner team (D-041).
 */
const OFFERED: Record<Factory["status"], Action[]> = {
  applied: ["start-review", "offboard"],
  under_review: ["start-trial", "return-to-applicant", "offboard"],
  trial: ["suspend", "offboard"],
  active: ["suspend", "offboard"],
  suspended: ["reinstate", "start-trial", "offboard"],
  offboarded: [],
};
const DESTRUCTIVE = new Set<Action>(["suspend", "offboard"]);

export async function factoryWithEtag(factoryId: string) {
  const { data, response } = await loose(adminBrowserApis().contract).GET("/v1/admin/factories/{factoryId}", {
    params: { path: { factoryId } },
  });
  return { factory: data as Factory, etag: response.headers.get("etag") ?? "" };
}

/**
 * One partner factory (F2 2.6): who it is, where onboarding stands, its documents and bank
 * account, what it can make and how much, its commercial terms, site visits and prices. The
 * header restates code and status on every tab and carries the status changes.
 */
export function FactoryWorkspace({
  factoryId,
  initial,
  tab,
}: {
  factoryId: string;
  initial: Factory | null;
  tab: FactoryTab;
}) {
  const t = useTranslations("partners.detail");
  const pathname = usePathname();
  const canManage = useCan("partners.manage");
  const canBuyPrices = useCan("factory_buy_prices.read");
  const refresh = useFactoryRefresh(factoryId);
  const [current, setCurrent] = useState<string>(tab);
  const [action, setAction] = useState<Action | "activate" | "owner" | null>(null);
  const [owner, setOwner] = useState({ email: "", displayName: "", initialPassword: "" });

  const query = useQuery({
    queryKey: queryKeys.detail("admin", "factory", factoryId),
    queryFn: async () => (await factoryWithEtag(factoryId)).factory,
    initialData: initial ?? undefined,
  });
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const factory = query.data;
  if (!factory) return null;
  const name = factory.tradeName ?? factory.legalName;

  const go = (next: string) => {
    setCurrent(next);
    window.history.replaceState(null, "", next === "onboarding" ? pathname : `${pathname}?tab=${next}`);
  };

  const parts: { value: string; label: string; content: React.ReactNode }[] = [
    { value: "onboarding", label: t("tabs.onboarding"), content: <Onboarding factory={factory} /> },
    { value: "profile", label: t("tabs.profile"), content: <Profile factory={factory} /> },
    { value: "compliance", label: t("tabs.compliance"), content: <Compliance factory={factory} /> },
    { value: "operations", label: t("tabs.operations"), content: <Operations factory={factory} /> },
    { value: "processes", label: t("tabs.processes"), content: <Processes factory={factory} /> },
    { value: "hours", label: t("tabs.hours"), content: <FactoryHours factory={factory} /> },
    { value: "terms", label: t("tabs.terms"), content: <Terms factory={factory} /> },
    { value: "visits", label: t("tabs.visits"), content: <SiteVisits factory={factory} /> },
    { value: "pricing", label: t("tabs.pricing"), content: <Pricing factory={factory} /> },
    ...(canBuyPrices
      ? [{ value: "shipping", label: t("tabs.shipping"), content: <FactoryRateCard factoryId={factory.id} /> }]
      : []),
    { value: "erp", label: t("tabs.erp"), content: <ErpSupport factory={factory} /> },
  ];
  const offered = canManage ? OFFERED[factory.status] : [];
  // Eleven parts in four groups beside the record (CAPTURE-PLAN-ADMIN G2): who it is, what it can make, the
  // commercial terms, and getpack's oversight — one column of items, not a row of eleven tabs.
  const GROUPS: { key: string; items: readonly FactoryTab[] }[] = [
    { key: "profile", items: ["onboarding", "profile", "compliance"] },
    { key: "capability", items: ["operations", "processes", "hours"] },
    { key: "commercial", items: ["terms", "pricing", "shipping"] },
    { key: "oversight", items: ["visits", "erp"] },
  ];
  const shown = new Map(parts.map((part) => [part.value as string, part]));
  const open = shown.get(current) ?? parts[0]!;
  const complete = factory.onboarding.total > 0 && factory.onboarding.done >= factory.onboarding.total;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/partners", label: t("partners") }}
        title={name}
        meta={
          <>
            <span className="text-muted text-sm tabular-nums">{factory.code}</span>
            <StatusChip map={FACTORY_STATUS} value={factory.status} size="md" />
            {/* Where onboarding stands, in one badge (was a heavy progress bar under the title). */}
            <Badge tone={complete ? "success" : "warning"} icon={complete ? "check" : "clock"}>
              {t("steps", { done: factory.onboarding.done, total: factory.onboarding.total })}
            </Badge>
            <Badge>{t(`modes.${factory.onboardingMode}`)}</Badge>
          </>
        }
        description={factory.status === "trial" ? t("trialJobs", { count: factory.trialJobsCompleted }) : undefined}
        actions={
          canManage ? (
            <>
              {offered.length > 0 ? (
                <DropdownMenu
                  label={t("statusActions")}
                  align="end"
                  items={offered.map((item) => ({
                    id: item,
                    label: t(`actions.${item}.label`),
                    tone: DESTRUCTIVE.has(item) ? "destructive" : "default",
                    onSelect: () => setAction(item),
                  }))}
                  trigger={
                    <Button variant="secondary" iconEnd="chevron-down">
                      {t("statusActions")}
                    </Button>
                  }
                />
              ) : null}
              <Button variant="secondary" iconStart="user-plus" onClick={() => setAction("owner")}>
                {t("owner.open")}
              </Button>
              {factory.status === "trial" ? (
                <Button iconStart="stamp" onClick={() => setAction("activate")}>
                  {t("activate.open")}
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <RecordNav
        label={t("tabsLabel")}
        current={open.value}
        onSelect={go}
        groups={GROUPS.map((group) => ({
          key: group.key,
          label: t(`groups.${group.key}`),
          items: group.items.flatMap((key) => {
            const part = shown.get(key);
            return part ? [{ key, label: part.label }] : [];
          }),
        })).filter((group) => group.items.length > 0)}
      >
        {open.content}
      </RecordNav>

      {action && action !== "activate" && action !== "owner" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t(`actions.${action}.title`)}
          description={t(`actions.${action}.body`, { code: factory.code, name })}
          confirmLabel={t(`actions.${action}.label`)}
          tone={DESTRUCTIVE.has(action) ? "destructive" : "primary"}
          confirmationPhrase={DESTRUCTIVE.has(action) ? factory.code : undefined}
          reason={{ label: t("reason"), required: true, minLength: 3, hint: t("reasonHint") }}
          onConfirm={async ({ reason }) => {
            try {
              const { etag } = await factoryWithEtag(factoryId);
              await loose(adminBrowserApis().contract).POST("/v1/admin/factories/{factoryId}/actions/{action}", {
                params: { path: { factoryId, action } },
                body: { reason },
                headers: ifMatch(etag),
              });
              toast.success(t("statusChanged"));
              refresh();
            } catch (error) {
              toast.error(problemMessage(error, t("actionFailed")));
              throw error;
            }
          }}
        />
      ) : null}

      {action === "activate" ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setAction(null))}
          title={t("activate.title")}
          description={t("activate.body", { code: factory.code, name })}
          confirmLabel={t("activate.confirm")}
          reason={{ label: t("reason"), required: true, minLength: 3, hint: t("activate.hint") }}
          onConfirm={async ({ reason }) => {
            try {
              await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/activation-requests", {
                params: { path: { factoryId } },
                body: { reason },
              });
              toast.success(t("activate.done"));
              refresh();
            } catch (error) {
              toast.error(problemMessage(error, t("actionFailed")));
              throw error;
            }
          }}
        />
      ) : null}

      {action === "owner" ? (
        <FormDialog
          title={t("owner.title")}
          description={t("owner.body", { name })}
          submitLabel={t("owner.confirm")}
          onClose={() => setAction(null)}
          onSubmit={async () => {
            await adminBrowserApis().contract.POST("/v1/admin/factories/{factoryId}/owner-account", {
              params: { path: { factoryId } },
              body: owner,
            });
            toast.success(t("owner.done", { email: owner.email }));
          }}
        >
          <Field label={t("owner.email")} required>
            <Input
              type="email"
              value={owner.email}
              onChange={(event) => setOwner({ ...owner, email: event.target.value })}
            />
          </Field>
          <Field label={t("owner.name")} required>
            <Input
              value={owner.displayName}
              onChange={(event) => setOwner({ ...owner, displayName: event.target.value })}
            />
          </Field>
          <Field label={t("owner.password")} hint={t("owner.passwordHint")} required>
            <Input
              type="password"
              autoComplete="new-password"
              value={owner.initialPassword}
              onChange={(event) => setOwner({ ...owner, initialPassword: event.target.value })}
            />
          </Field>
        </FormDialog>
      ) : null}
    </div>
  );
}
