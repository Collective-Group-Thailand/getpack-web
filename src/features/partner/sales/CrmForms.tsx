"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { bangkokToday, useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { plainNumber } from "@/features/partner/erp/format";
import { Select } from "@/features/partner/select";
import { problemMessage } from "@/features/shared/actions";
import { useFormat } from "@/features/shared/format/useFormat";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

import { erpPost, erpSave } from "./api";
import { SalesActions } from "./SalesActions";

type Lead = Schemas["ErpLeadDto"];
type Opportunity = Schemas["ErpOpportunityDto"];
type Activity = Schemas["ErpActivityDto"];
type Source = Schemas["ErpLeadSource"];
type ActivityKind = Schemas["ErpActivityKind"];
type People = { id: string; name: string }[];
type Customers = { id: string; code: string; name: string }[];
const SOURCES: Source[] = ["phone", "line", "facebook", "website", "walk_in", "referral", "exhibition", "getpack", "other"];
const OPEN_LEAD = ["new", "contacted", "qualified"] as const;
const OPEN_OPP = ["prospecting", "proposal", "negotiation"] as const;
const KINDS: ActivityKind[] = ["call", "visit", "meeting", "line", "email", "task", "note"];
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

function useSave() {
  const tCommon = useTranslations("partnerSales.common");
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  async function run<T>(work: () => Promise<T>, done: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await work();
      toast.success(done);
      return result;
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

/** A lead — someone who may buy (D-359): who, how to reach them, where they came from, what it may be worth. */
export function LeadForm({ lead, etag, people }: { lead?: Lead; etag?: string | null; people: People }) {
  const t = useTranslations("partnerSales.crm.leadForm");
  const tStage = useTranslations("status.erpLead");
  const tSource = useTranslations("partnerSales.crm.sources");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [v, setV] = useState({
    name: lead?.name ?? "",
    contactName: lead?.contactName ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    lineId: lead?.lineId ?? "",
    address: lead?.address ?? "",
    source: (lead?.source ?? "phone") as Source,
    stage: (lead && (OPEN_LEAD as readonly string[]).includes(lead.stage) ? lead.stage : "new") as (typeof OPEN_LEAD)[number],
    expectedValue: lead?.expectedValue ?? "",
    salespersonId: lead?.salesperson?.id ?? "",
    note: lead?.note ?? "",
  });
  const [error, setError] = useState<string>();
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (v.name.trim().length < 2) return setError(t("nameRequired"));
    if (v.expectedValue && !MONEY.test(plainNumber(v.expectedValue))) return setError(t("valueInvalid"));
    setError(undefined);
    const body = {
      name: v.name.trim(),
      contactName: v.contactName.trim() || null,
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      lineId: v.lineId.trim() || null,
      address: v.address.trim() || null,
      source: v.source,
      stage: v.stage,
      expectedValue: v.expectedValue ? plainNumber(v.expectedValue) : null,
      salespersonId: v.salespersonId || null,
      note: v.note.trim() || null,
    };
    const result = await run(
      () =>
        lead
          ? erpSave<{ id: string }>("PUT", factoryId, "/leads/{leadId}", { leadId: lead.id }, body, etag)
          : erpPost<{ id: string }>(factoryId, "/leads", {}, body),
      t("saved"),
    );
    if (result) {
      router.push(`/crm/leads/${result.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("name")} hint={t("nameHint")} error={error} required requiredLabel={tCommon("required")}>
        <Input value={v.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("contactName")}>
          <Input value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label={t("phone")}>
          <Input type="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label={t("lineId")}>
          <Input value={v.lineId} onChange={(e) => set({ lineId: e.target.value })} />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label={t("source")}>
          <Select value={v.source} onValueChange={(source) => set({ source: source as Source })} options={SOURCES.map((s) => ({ value: s, label: tSource(s) }))} />
        </Field>
        <Field label={t("stage")}>
          <Select
            value={v.stage}
            onValueChange={(stage) => set({ stage: stage as (typeof OPEN_LEAD)[number] })}
            options={OPEN_LEAD.map((s) => ({ value: s, label: tStage(s) }))}
          />
        </Field>
        <Field label={t("expectedValue")}>
          <NumberInput step="any" min={0} unit="฿" value={v.expectedValue} onChange={(e) => set({ expectedValue: e.target.value })} />
        </Field>
        <Field label={tCommon("salesperson")}>
          <Select
            value={v.salespersonId || null}
            placeholder={t("salespersonPlaceholder")}
            onValueChange={(salespersonId) => set({ salespersonId })}
            options={people.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
      </div>
      <Field label={t("address")}>
        <Textarea rows={2} value={v.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Field label={t("note")}>
        <Textarea rows={3} value={v.note} placeholder={t("notePlaceholder")} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

/** An opportunity — a deal with a customer or lead (D-359): its value, stage, chance and when it may close. */
export function OpportunityForm({
  opportunity,
  etag,
  people,
  customers,
  preset = {},
}: {
  opportunity?: Opportunity;
  etag?: string | null;
  people: People;
  customers: Customers;
  preset?: { customerId?: string; leadId?: string };
}) {
  const t = useTranslations("partnerSales.crm.opportunityForm");
  const tStage = useTranslations("status.erpOpportunity");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [v, setV] = useState({
    title: opportunity?.title ?? "",
    customerId: opportunity?.customer?.id ?? preset.customerId ?? "",
    stage: (opportunity && (OPEN_OPP as readonly string[]).includes(opportunity.stage) ? opportunity.stage : "prospecting") as (typeof OPEN_OPP)[number],
    value: opportunity?.value ?? "",
    probabilityPct: opportunity ? String(opportunity.probabilityPct) : "",
    expectedCloseOn: opportunity?.expectedCloseOn ?? "",
    salespersonId: opportunity?.salesperson?.id ?? "",
    note: opportunity?.note ?? "",
  });
  const [error, setError] = useState<string>();
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (v.title.trim().length < 2) return setError(t("titleRequired"));
    if (!opportunity && !v.customerId && !preset.leadId) return setError(t("customerRequired"));
    if (v.value && !MONEY.test(plainNumber(v.value))) return setError(t("valueInvalid"));
    setError(undefined);
    const body = {
      title: v.title.trim(),
      ...(v.customerId ? { customerId: v.customerId } : {}),
      ...(preset.leadId && !opportunity ? { leadId: preset.leadId } : {}),
      stage: v.stage,
      ...(v.value ? { value: plainNumber(v.value) } : {}),
      ...(v.probabilityPct ? { probabilityPct: Number.parseInt(v.probabilityPct, 10) } : {}),
      expectedCloseOn: v.expectedCloseOn || null,
      salespersonId: v.salespersonId || null,
      note: v.note.trim() || null,
    };
    const result = await run(
      () =>
        opportunity
          ? erpSave<{ id: string }>("PUT", factoryId, "/opportunities/{opportunityId}", { opportunityId: opportunity.id }, body, etag)
          : erpPost<{ id: string }>(factoryId, "/opportunities", {}, body),
      t("saved"),
    );
    if (result) {
      router.push(`/crm/opportunities/${result.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" noValidate>
      <Field label={t("title")} hint={t("titleHint")} error={error} required requiredLabel={tCommon("required")}>
        <Input value={v.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {!preset.leadId ? (
          <Field label={tCommon("customer")}>
            <Select
              value={v.customerId || null}
              placeholder={t("customerPlaceholder")}
              onValueChange={(customerId) => set({ customerId })}
              options={customers.map((c) => ({ value: c.id, label: c.name, description: c.code }))}
            />
          </Field>
        ) : null}
        <Field label={t("stage")} hint={t("stageHint")}>
          <Select
            value={v.stage}
            onValueChange={(stage) => set({ stage: stage as (typeof OPEN_OPP)[number] })}
            options={OPEN_OPP.map((s) => ({ value: s, label: tStage(s) }))}
          />
        </Field>
        <Field label={t("value")}>
          <NumberInput step="any" min={0} unit="฿" value={v.value} onChange={(e) => set({ value: e.target.value })} />
        </Field>
        <Field label={t("probability")} hint={t("probabilityHint")}>
          <NumberInput min={0} max={100} unit="%" value={v.probabilityPct} onChange={(e) => set({ probabilityPct: e.target.value })} />
        </Field>
        <Field label={t("expectedCloseOn")}>
          <Input type="date" value={v.expectedCloseOn} onChange={(e) => set({ expectedCloseOn: e.target.value })} />
        </Field>
        <Field label={tCommon("salesperson")}>
          <Select
            value={v.salespersonId || null}
            placeholder={t("salespersonPlaceholder")}
            onValueChange={(salespersonId) => set({ salespersonId })}
            options={people.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
      </div>
      <Field label={t("note")}>
        <Textarea rows={3} value={v.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <Button type="submit" size="xl" loading={busy} iconStart="save" className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

/** A lead's actions (D-359): edit, convert into a customer (optionally opening a deal), mark lost. */
export function LeadActions({ lead, customers }: { lead: Lead; customers: Customers }) {
  const t = useTranslations("partnerSales.crm.leadActions");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const { run, busy } = useSave();
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState("");
  const [taxId, setTaxId] = useState("");
  const [terms, setTerms] = useState("30");
  const [deal, setDeal] = useState(true);
  const [key, setKey] = useState(newIdempotencyKey);
  const params = { leadId: lead.id };

  async function convert() {
    const result = await run(
      () =>
        erpPost<{ customer: { id: string }; opportunityId: string | null }>(
          factoryId,
          "/leads/{leadId}/actions/convert",
          params,
          existing
            ? { customerId: existing, openOpportunity: deal }
            : {
                ...(taxId.trim() ? { taxId: taxId.trim(), branchCode: "00000" } : {}),
                paymentTermDays: Number.parseInt(terms, 10) || 0,
                openOpportunity: deal,
              },
          { idempotencyKey: key },
        ),
      t("converted"),
    );
    if (result) {
      setOpen(false);
      router.push(result.opportunityId ? `/crm/opportunities/${result.opportunityId}` : `/crm/leads/${lead.id}`);
      router.refresh();
    }
  }

  return (
    <>
      <SalesActions
        offered={lead.nextActions}
        actions={[
          {
            key: "erp_lead.convert",
            kind: "dialog",
            primary: true,
            open: () => {
              setKey(newIdempotencyKey());
              setOpen(true);
            },
          },
          { key: "erp_lead.edit", kind: "link", href: `/crm/leads/${lead.id}/edit` },
          {
            key: "erp_lead.lose",
            kind: "post",
            path: "/leads/{leadId}/actions/lose",
            params,
            body: (reason) => ({ reason }),
            title: t("loseTitle"),
            description: t("loseBody", { name: lead.name }),
            reason: { label: t("loseReason"), placeholder: t("losePlaceholder") },
            done: t("lost"),
          },
        ]}
      />
      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title={t("convertTitle", { name: lead.name })}
          description={t("convertBody")}
          closeLabel={tCommon("close")}
          footer={
            <Button iconStart="user-plus" loading={busy} onClick={() => void convert()}>
              {t("convertConfirm")}
            </Button>
          }
        >
          <div className="grid gap-3">
            <Field label={t("existing")} hint={t("existingHint")}>
              <Select
                value={existing || null}
                placeholder={t("newCustomer")}
                onValueChange={setExisting}
                options={[{ value: "", label: t("newCustomer") }, ...customers.map((c) => ({ value: c.id, label: c.name, description: c.code }))]}
              />
            </Field>
            {!existing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("taxId")}>
                  <Input inputMode="numeric" maxLength={13} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                </Field>
                <Field label={t("terms")}>
                  <NumberInput min={0} max={365} unit={t("days")} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </Field>
              </div>
            ) : null}
            <Checkbox checked={deal} onCheckedChange={(on) => setDeal(on === true)} label={t("openDeal")} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** An opportunity's actions (D-359): quote it, edit, mark it won or lost. */
export function OpportunityActions({ opportunity }: { opportunity: Opportunity }) {
  const t = useTranslations("partnerSales.crm.opportunityActions");
  const format = useFormat();
  const params = { opportunityId: opportunity.id };
  const query = new URLSearchParams({ opportunity: opportunity.id, ...(opportunity.customer ? { customer: opportunity.customer.id } : {}) });
  return (
    <SalesActions
      offered={opportunity.nextActions}
      actions={[
        { key: "erp_opportunity.quote", kind: "link", primary: true, href: `/quotations/new?${query.toString()}` },
        { key: "erp_opportunity.edit", kind: "link", href: `/crm/opportunities/${opportunity.id}/edit` },
        {
          key: "erp_opportunity.win",
          kind: "post",
          path: "/opportunities/{opportunityId}/actions/win",
          params,
          title: t("winTitle"),
          description: t("winBody", { title: opportunity.title, value: format.thb(opportunity.value) }),
          done: t("won"),
        },
        {
          key: "erp_opportunity.lose",
          kind: "post",
          path: "/opportunities/{opportunityId}/actions/lose",
          params,
          body: (reason) => ({ reason }),
          title: t("loseTitle"),
          description: t("loseBody", { title: opportunity.title }),
          reason: { label: t("loseReason"), placeholder: t("losePlaceholder") },
          done: t("lost"),
        },
      ]}
    />
  );
}

/**
 * Follow-ups (D-359): calls, visits and tasks about a lead, deal or customer, with a due time; a done one keeps
 * its outcome. The form adds one; each open one can be marked done.
 */
export function Activities({
  activities,
  subject,
  people,
  canManage,
  showSubject = false,
}: {
  activities: Activity[];
  subject?: { leadId?: string; opportunityId?: string; customerId?: string };
  people: People;
  canManage: boolean;
  showSubject?: boolean;
}) {
  const t = useTranslations("partnerSales.crm.activities");
  const tKinds = useTranslations("partnerSales.crm.activityKinds");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const format = useFormat();
  const [refresh] = useRefresh();
  const { run, busy } = useSave();
  const [kind, setKind] = useState<ActivityKind>("call");
  const [subjectText, setSubjectText] = useState("");
  const [due, setDue] = useState(`${bangkokToday(1)}T10:00`);
  const [assigneeId, setAssigneeId] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (subjectText.trim().length < 2) return setError(t("subjectRequired"));
    setError(undefined);
    const ok = await run(
      () =>
        erpPost(factoryId, "/activities", {}, {
          kind,
          subject: subjectText.trim(),
          ...subject,
          ...(assigneeId ? { assigneeId } : {}),
          dueAt: done || !due ? null : new Date(`${due}:00+07:00`).toISOString(),
          done,
        }),
      t("added"),
    );
    if (ok !== undefined) {
      setSubjectText("");
      refresh();
    }
  }

  async function complete(activity: Activity) {
    const ok = await run(
      () => erpPost(factoryId, "/activities/{activityId}/actions/complete", { activityId: activity.id }, {}),
      t("completed"),
    );
    if (ok !== undefined) refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && subject ? (
        <form onSubmit={(event) => void add(event)} className="border-border bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[10rem_1fr_14rem] md:p-4" noValidate>
          <Field label={t("kind")}>
            <Select value={kind} onValueChange={(k) => setKind(k as ActivityKind)} options={KINDS.map((k) => ({ value: k, label: tKinds(k) }))} />
          </Field>
          <Field label={t("subject")} error={error}>
            <Input value={subjectText} placeholder={t("subjectPlaceholder")} onChange={(e) => setSubjectText(e.target.value)} />
          </Field>
          <Field label={t("due")}>
            <Input type="datetime-local" value={due} disabled={done} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label={t("assignee")}>
            <Select
              value={assigneeId || null}
              placeholder={t("me")}
              onValueChange={setAssigneeId}
              options={people.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <div className="flex items-end gap-3 md:col-span-2">
            <Checkbox checked={done} onCheckedChange={(on) => setDone(on === true)} label={t("alreadyDone")} />
            <Button type="submit" loading={busy} iconStart="plus" className="ms-auto">
              {t("add")}
            </Button>
          </div>
        </form>
      ) : null}
      {activities.length ? (
        <ul className="flex flex-col gap-2">
          {activities.map((a) => (
            <li key={a.id} className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <Badge tone={a.doneAt ? "neutral" : a.overdue ? "danger" : "info"}>{tKinds(a.kind)}</Badge>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={a.doneAt ? "text-muted line-through" : "font-medium"}>{a.subject}</span>
                <span className="text-muted text-sm">
                  {[
                    showSubject ? a.about.name : null,
                    a.assignee.name,
                    a.doneAt
                      ? t("doneAt", { at: format.dateTime(a.doneAt) })
                      : a.dueAt
                        ? t(a.overdue ? "overdueAt" : "dueAt", { at: format.dateTime(a.dueAt) })
                        : null,
                    a.outcome,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {!a.doneAt && canManage ? (
                <Button size="sm" variant="secondary" iconStart="check" disabled={busy} onClick={() => void complete(a)}>
                  {t("complete")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">{t("none")}</p>
      )}
      <span className="sr-only">{tCommon("noData")}</span>
    </div>
  );
}

/** A salesperson's monthly target and commission rate (D-369). */
export function TargetForm({ people, month }: { people: People; month: string }) {
  const t = useTranslations("partnerSales.crm.target");
  const { factoryId } = useFactory();
  const [refresh] = useRefresh();
  const { run, busy } = useSave();
  const [salespersonId, setSalespersonId] = useState("");
  const [target, setTarget] = useState("");
  const [pct, setPct] = useState("");
  const [error, setError] = useState<string>();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!salespersonId) return setError(t("personRequired"));
    if (!MONEY.test(plainNumber(target))) return setError(t("targetInvalid"));
    setError(undefined);
    const ok = await run(
      () =>
        erpSave("PUT", factoryId, "/sales/targets", {}, {
          salespersonId,
          month,
          targetNet: plainNumber(target),
          ...(pct ? { commissionPct: plainNumber(pct) } : {}),
        }, null),
      t("saved"),
    );
    if (ok !== undefined) refresh();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="grid items-end gap-3 md:grid-cols-[1fr_12rem_9rem_auto]" noValidate>
      <Field label={t("person")} error={error}>
        <Select value={salespersonId || null} placeholder={t("personPlaceholder")} onValueChange={setSalespersonId} options={people.map((p) => ({ value: p.id, label: p.name }))} />
      </Field>
      <Field label={t("target")}>
        <NumberInput step="any" min={0} unit="฿" value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <Field label={t("commission")}>
        <NumberInput step="any" min={0} max={100} unit="%" value={pct} onChange={(e) => setPct(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy} iconStart="save">
        {t("save")}
      </Button>
    </form>
  );
}
