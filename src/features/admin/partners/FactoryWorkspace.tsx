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
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Meter } from "@/ui/components/Meter";
import { PageHeader } from "@/ui/components/PageHeader";
import { Tabs } from "@/ui/components/Tabs";
import { toast } from "@/ui/components/Toast";

import { ConfirmAction, problemMessage, QueryError, StatusChip, useCan } from "../console";
import { adminBrowserApis } from "../console/api";
import { loose } from "../catalogue/api";
import { useFactoryRefresh } from "./hooks";
import { FormDialog } from "./parts";
import type { Factory, FactoryTab } from "./resources";
import { Compliance } from "./tabs/Compliance";
import { Onboarding } from "./tabs/Onboarding";
import { Operations } from "./tabs/Operations";
import { Pricing } from "./tabs/Pricing";
import { Profile } from "./tabs/Profile";
import { ErpSupport } from "./tabs/ErpSupport";
import { SiteVisits } from "./tabs/SiteVisits";
import { Terms } from "./tabs/Terms";

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

  const tabs = [
    { value: "onboarding", label: t("tabs.onboarding"), content: <Onboarding factory={factory} /> },
    { value: "profile", label: t("tabs.profile"), content: <Profile factory={factory} /> },
    { value: "compliance", label: t("tabs.compliance"), content: <Compliance factory={factory} /> },
    { value: "operations", label: t("tabs.operations"), content: <Operations factory={factory} /> },
    { value: "terms", label: t("tabs.terms"), content: <Terms factory={factory} /> },
    { value: "visits", label: t("tabs.visits"), content: <SiteVisits factory={factory} /> },
    { value: "pricing", label: t("tabs.pricing"), content: <Pricing factory={factory} /> },
    { value: "erp", label: t("tabs.erp"), content: <ErpSupport factory={factory} /> },
  ];
  const offered = canManage ? OFFERED[factory.status] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            label={t("breadcrumb")}
            items={[{ label: t("partners"), href: "/partners" }, { label: factory.code }]}
          />
        }
        title={name}
        meta={
          <>
            <span className="text-muted font-mono text-sm">{factory.code}</span>
            <StatusChip map={FACTORY_STATUS} value={factory.status} size="md" />
            <Badge>{t(`modes.${factory.onboardingMode}`)}</Badge>
          </>
        }
        description={
          <>
            {t("steps", { done: factory.onboarding.done, total: factory.onboarding.total })}
            {factory.status === "trial" ? ` · ${t("trialJobs", { count: factory.trialJobsCompleted })}` : null}
          </>
        }
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

      {/* Not inside the header's description: a meter is a block, and a <p> cannot hold one. */}
      <div className="-mt-3 max-w-sm">
        <Meter
          label={t("onboarding")}
          value={factory.onboarding.total ? Math.round((factory.onboarding.done / factory.onboarding.total) * 100) : 0}
          valueText={t("steps", { done: factory.onboarding.done, total: factory.onboarding.total })}
        />
      </div>

      <Tabs label={t("tabsLabel")} items={tabs} value={current} onValueChange={go} />

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
