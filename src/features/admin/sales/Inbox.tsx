"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SALES_INBOUND_STATUS } from "@/domain/status";
import { useFormat } from "@/features/shared/format";
import { displayPhone, toE164 } from "@/features/shared/sales/phone";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { DropdownMenu, type MenuItem } from "@/ui/components/DropdownMenu";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { toast } from "@/ui/components/Toast";

import {
  adminBrowserApis,
  FormDialog,
  problemMessage,
  QueueTabs,
  ResourceList,
  StatusChip,
  useCan,
  useSlaFormat,
  type FilterDef,
  type InitialPage,
} from "../console";
import { DISQUALIFY_REASONS, INBOUND_SOURCES, INBOUND_STATUSES, inboundList, type SalesInbound } from "./resources";

type Dialog =
  | { kind: "assign"; rows: SalesInbound[] }
  | { kind: "contacted"; row: SalesInbound }
  | { kind: "disqualify"; row: SalesInbound }
  | { kind: "create" };

/** The reps a manager may assign to (`admin.salesReps.list`), with their open load. */
export function useReps(enabled = true) {
  return useQuery({
    queryKey: queryKeys.list("admin", "sales_rep", {}),
    queryFn: async () => (await adminBrowserApis().contract.GET("/v1/admin/sales/reps")).data!,
    enabled,
    staleTime: 30_000,
  });
}

/**
 * The inbound pool (D-469): sales enquiries from the contact form (sales topics), RFQs from non-customers and manual
 * entries, soonest first response due first, each with its SLA timer. A manager assigns — one, many at once, by name
 * or round robin — and moving an enquiry away from another rep asks why. The rep sees only what is theirs (the API
 * scopes the list) and works it: contacted, convert to a lead, or disqualify with a reason.
 */
export function Inbox({ initial }: { initial: InitialPage<SalesInbound> | null }) {
  const t = useTranslations("sales.inbox");
  const tStatus = useTranslations("status");
  const format = useFormat();
  const sla = useSlaFormat();
  const manage = useCan("sales.pipeline.manage");
  const client = useQueryClient();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const refresh = () => void client.invalidateQueries({ queryKey: ["admin", "sales_inbound_lead"] });

  const act = async (row: SalesInbound, action: "convert") => {
    try {
      await adminBrowserApis().contract.POST("/v1/admin/sales/inbound/{inboundId}/actions/convert", {
        params: { path: { inboundId: row.id } },
      });
      toast.success(t(`done.${action}`, { name: row.contactName }));
      refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("failed")));
    }
  };

  const closed = (row: SalesInbound) => row.status === "converted_to_lead" || row.status === "disqualified";

  const columns: DataTableColumn<SalesInbound>[] = [
    {
      id: "contact",
      header: t("columns.contact"),
      cell: (row) => (
        <div className="flex max-w-[20rem] min-w-0 flex-col">
          <span className="truncate font-semibold">{row.contactName}</span>
          {row.organisationName ? <span className="text-muted truncate text-xs">{row.organisationName}</span> : null}
          {row.need ? <span className="text-muted line-clamp-1 text-xs">{row.need}</span> : null}
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
            {row.contactPhone ? (
              <a href={`tel:${row.contactPhone}`} className="text-link whitespace-nowrap tabular-nums hover:underline">
                {displayPhone(row.contactPhone)}
              </a>
            ) : null}
            {row.contactEmail ? (
              <a href={`mailto:${row.contactEmail}`} className="text-link max-w-56 truncate hover:underline">
                {row.contactEmail}
              </a>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      id: "source",
      header: t("columns.source"),
      cell: (row) => (
        <div className="flex flex-col text-sm">
          <span className="whitespace-nowrap">{t(`sources.${row.source}`)}</span>
          {row.sourceRef ? (
            <span className="text-muted text-xs whitespace-nowrap tabular-nums">{row.sourceRef}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.statusOwner"),
      cell: (row) => (
        <div className="flex max-w-[16rem] flex-col items-start gap-1">
          <StatusChip map={SALES_INBOUND_STATUS} value={row.status} />
          {row.leadRefusal ? <span className="text-warning-subtle-fg text-xs">{t("leadRefused")}</span> : null}
          {row.disqualifiedReason ? (
            <span className="text-muted text-xs">{t(`disqualify.reasons.${row.disqualifiedReason}`)}</span>
          ) : null}
          {row.assignee ? (
            <span className="text-xs">{t("ownerLine", { name: row.assignee.displayName })}</span>
          ) : (
            <span className="text-warning-subtle-fg text-xs font-medium">{t("unassigned")}</span>
          )}
        </div>
      ),
    },
    {
      id: "sla",
      header: t("columns.sla"),
      cell: (row) =>
        row.firstRespondedAt ? (
          <span className={row.slaBreached ? "text-danger text-xs font-medium" : "text-muted text-xs"}>
            {row.slaBreached ? t("answeredLate") : t("answered")} ·{" "}
            {format.dateTime(row.firstRespondedAt, { style: "dayMonth" })}
          </span>
        ) : closed(row) ? (
          <span className="text-muted text-xs">—</span>
        ) : (
          <SlaTimer
            dueAt={row.firstResponseDueAt}
            state={row.slaBreached ? "breached" : undefined}
            format={sla}
            absolute={t("dueAt", { at: format.dateTime(row.firstResponseDueAt) })}
          />
        ),
    },
    {
      id: "actions",
      header: t("columns.actions"),
      cell: (row) => {
        const items: MenuItem[] = [];
        if (manage && !closed(row))
          items.push({
            id: "assign",
            label: row.assignee ? t("reassign") : t("assign"),
            icon: "user",
            onSelect: () => setDialog({ kind: "assign", rows: [row] }),
          });
        if (row.status === "assigned")
          items.push({
            id: "contacted",
            label: t("markContacted"),
            icon: "phone",
            onSelect: () => setDialog({ kind: "contacted", row }),
          });
        if (row.status === "assigned" || row.status === "contacted")
          items.push({
            id: "convert",
            label: t("convert"),
            icon: "user-plus",
            disabled: Boolean(row.leadRefusal),
            description: row.leadRefusal ? t("leadRefusedHint") : undefined,
            onSelect: () => void act(row, "convert"),
          });
        if (!closed(row))
          items.push({
            id: "disqualify",
            label: t("disqualify.action"),
            icon: "ban",
            tone: "destructive",
            separatorBefore: true,
            onSelect: () => setDialog({ kind: "disqualify", row }),
          });
        return (
          <div className="flex items-center justify-end gap-2">
            {row.leadId && !row.leadRefusal ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/sales/leads/${row.leadId}`}>{t("openLead")}</Link>
              </Button>
            ) : null}
            {items.length ? (
              <DropdownMenu
                label={t("actionsFor", { name: row.contactName })}
                items={items}
                align="end"
                trigger={
                  <Button size="sm" variant="secondary" iconStart="more">
                    <span className="sr-only">{t("actionsFor", { name: row.contactName })}</span>
                  </Button>
                }
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  const filters: FilterDef[] = [
    {
      id: "source",
      label: t("columns.source"),
      kind: "select",
      options: INBOUND_SOURCES.filter((source) => source !== "line_chat").map((source) => ({
        value: source,
        label: t(`sources.${source}`),
      })),
    },
    { id: "breached", label: t("sla"), kind: "select", options: [{ value: "true", label: t("breachedOnly") }] },
    ...(manage
      ? [
          {
            id: "unassigned",
            label: t("columns.assignee"),
            kind: "select" as const,
            options: [{ value: "true", label: t("unassignedOnly") }],
          },
        ]
      : []),
  ];

  return (
    <>
      <ResourceList
        views={
          <QueueTabs
            countFrom={inboundList}
            hideEmpty
            label={t("statusesLabel")}
            param="status"
            tabs={[
              { value: null, label: t("all") },
              ...INBOUND_STATUSES.map((status) => ({
                value: status,
                label: tStatus(SALES_INBOUND_STATUS[status].labelKey),
              })),
            ]}
          />
        }
        resource={inboundList}
        columns={columns}
        caption={t("title")}
        filters={filters}
        initial={initial}
        searchLabel={t("search")}
        savedViews={false}
        rowTone={(row) => (row.slaBreached && !closed(row) ? "danger" : row.status === "new" ? "warning" : undefined)}
        bulkActions={
          manage
            ? (ids, clear) => (
                <Button
                  size="sm"
                  iconStart="user"
                  onClick={() => {
                    const rows = client
                      .getQueriesData<{ data: SalesInbound[] }>({ queryKey: ["admin", "sales_inbound_lead"] })
                      .flatMap(([, page]) => page?.data ?? [])
                      .filter(
                        (row, at, all) => ids.includes(row.id) && all.findIndex((other) => other.id === row.id) === at,
                      );
                    setDialog({ kind: "assign", rows });
                    clear();
                  }}
                >
                  {t("bulkAssign", { count: ids.length })}
                </Button>
              )
            : undefined
        }
        toolbarEnd={
          <Button iconStart="plus" onClick={() => setDialog({ kind: "create" })}>
            {t("create.action")}
          </Button>
        }
        empty={{
          title: t("empty"),
          description: manage ? t("emptyManager") : t("emptyRep"),
          action: (
            <Button variant="secondary" iconStart="plus" onClick={() => setDialog({ kind: "create" })}>
              {t("create.action")}
            </Button>
          ),
        }}
      />
      {dialog?.kind === "assign" ? (
        <AssignDialog rows={dialog.rows} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog?.kind === "contacted" ? (
        <ContactedDialog row={dialog.row} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog?.kind === "disqualify" ? (
        <DisqualifyDialog row={dialog.row} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog?.kind === "create" ? <CreateDialog onClose={() => setDialog(null)} onDone={refresh} /> : null}
    </>
  );
}

const ROUND_ROBIN = "round_robin";

/** Assign one or many enquiries: round robin (the API picks the least loaded rep) or a named rep, with a reason to move. */
function AssignDialog({ rows, onClose, onDone }: { rows: SalesInbound[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("sales.inbox.assignDialog");
  const reps = useReps();
  const [rep, setRep] = useState<string>(ROUND_ROBIN);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const moving = rows.some((row) => row.assignee && row.assignee.id !== rep);
  const options = [
    { value: ROUND_ROBIN, label: t("roundRobin"), description: t("roundRobinHint") },
    ...(reps.data ?? []).map((candidate) => ({
      value: candidate.userId,
      label: candidate.displayName,
      description: candidate.assignable
        ? t("load", { inbound: candidate.openInbound, leads: candidate.openLeads })
        : t("notAssignable"),
      disabled: !candidate.assignable,
      badge: candidate.agent ? candidate.agent.code : undefined,
    })),
  ];
  return (
    <FormDialog
      title={
        rows.length > 1 ? t("titleMany", { count: rows.length }) : t("title", { name: rows[0]?.contactName ?? "" })
      }
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (moving && rep !== ROUND_ROBIN && !reason.trim()) {
          setError(t("reasonRequired"));
          throw new Error("reason");
        }
        const body = {
          ...(rep === ROUND_ROBIN ? {} : { repUserId: rep }),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        };
        try {
          if (rows.length > 1) {
            const result = (
              await adminBrowserApis().contract.POST("/v1/admin/sales/inbound/actions/bulk-assign", {
                body: { ids: rows.map((row) => row.id), ...body },
              })
            ).data!;
            toast.success(t("doneMany", { assigned: result.assigned.length, skipped: result.skipped.length }));
          } else {
            const result = (
              await adminBrowserApis().contract.POST("/v1/admin/sales/inbound/{inboundId}/actions/assign", {
                params: { path: { inboundId: rows[0]!.id } },
                body,
              })
            ).data!;
            toast.success(t("done", { name: result.contactName, rep: result.assignee?.displayName ?? "" }));
          }
          onDone();
        } catch (failure) {
          toast.error(problemMessage(failure, t("failed")));
          throw failure;
        }
      }}
    >
      <Field label={t("rep")}>
        <RadioCards options={options} value={rep} onValueChange={setRep} columns={2} />
      </Field>
      {moving ? (
        <Field label={t("reason")} hint={t("reasonHint")} error={error ?? undefined} required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
        </Field>
      ) : null}
    </FormDialog>
  );
}

function ContactedDialog({ row, onClose, onDone }: { row: SalesInbound; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("sales.inbox.contactedDialog");
  const [note, setNote] = useState("");
  return (
    <FormDialog
      title={t("title", { name: row.contactName })}
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        try {
          await adminBrowserApis().contract.POST("/v1/admin/sales/inbound/{inboundId}/actions/mark-contacted", {
            params: { path: { inboundId: row.id } },
            body: note.trim() ? { note: note.trim() } : {},
          });
          toast.success(t("done", { name: row.contactName }));
          onDone();
        } catch (failure) {
          toast.error(problemMessage(failure, t("failed")));
          throw failure;
        }
      }}
    >
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </Field>
    </FormDialog>
  );
}

function DisqualifyDialog({ row, onClose, onDone }: { row: SalesInbound; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("sales.inbox.disqualify");
  const [reason, setReason] = useState<Schemas["SalesInboundDisqualifyReason"] | undefined>(undefined);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      destructive
      title={t("title", { name: row.contactName })}
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!reason) {
          setError(t("reasonRequired"));
          throw new Error("reason");
        }
        try {
          await adminBrowserApis().contract.POST("/v1/admin/sales/inbound/{inboundId}/actions/disqualify", {
            params: { path: { inboundId: row.id } },
            body: { reason, ...(note.trim() ? { note: note.trim() } : {}) },
          });
          toast.success(t("done", { name: row.contactName }));
          onDone();
        } catch (failure) {
          toast.error(problemMessage(failure, t("failed")));
          throw failure;
        }
      }}
    >
      <Field label={t("reason")} error={error ?? undefined} required>
        <RadioCards
          options={DISQUALIFY_REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }))}
          value={reason}
          onValueChange={setReason}
          columns={2}
        />
      </Field>
      <Field label={t("note")}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </Field>
    </FormDialog>
  );
}

/** A manual enquiry (a call, a walk-in): a rep's own is theirs; a manager may name a rep or leave it to the mode. */
function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("sales.inbox.create");
  const manage = useCan("sales.pipeline.manage");
  const reps = useReps(manage);
  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    organisationName: "",
    need: "",
  });
  const [assignee, setAssignee] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!form.contactPhone.trim() && !form.contactEmail.trim()) {
          setError(t("reachRequired"));
          throw new Error("reach");
        }
        const phone = form.contactPhone.trim() ? toE164(form.contactPhone) : null;
        if (form.contactPhone.trim() && !phone) {
          setError(t("phoneInvalid"));
          throw new Error("phone");
        }
        try {
          await adminBrowserApis().contract.POST("/v1/admin/sales/inbound", {
            body: {
              contactName: form.contactName.trim(),
              contactPhone: phone,
              contactEmail: form.contactEmail.trim() || null,
              organisationName: form.organisationName.trim() || null,
              need: form.need.trim() || null,
              ...(manage && assignee ? { assigneeUserId: assignee } : {}),
            },
          });
          toast.success(t("done", { name: form.contactName.trim() }));
          onDone();
        } catch (failure) {
          toast.error(problemMessage(failure, t("failed")));
          throw failure;
        }
      }}
    >
      <Field label={t("contactName")} required>
        <Input value={form.contactName} onChange={set("contactName")} autoComplete="name" required />
      </Field>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1.5 text-sm font-medium">{t("reach")}</legend>
        <Field label={t("contactPhone")} error={error ?? undefined}>
          <Input
            value={form.contactPhone}
            onChange={set("contactPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
          />
        </Field>
        <Field label={t("contactEmail")}>
          <Input
            value={form.contactEmail}
            onChange={set("contactEmail")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
          />
        </Field>
      </fieldset>
      <Field label={t("organisationName")}>
        <Input value={form.organisationName} onChange={set("organisationName")} autoComplete="organization" />
      </Field>
      <Field label={t("need")}>
        <Textarea value={form.need} onChange={set("need")} rows={2} />
      </Field>
      {manage ? (
        <Field label={t("assignee")} hint={t("assigneeHint")}>
          <RadioCards
            options={[
              { value: "", label: t("byMode") },
              ...(reps.data ?? [])
                .filter((candidate) => candidate.assignable)
                .map((candidate) => ({ value: candidate.userId, label: candidate.displayName })),
            ]}
            value={assignee}
            onValueChange={setAssignee}
            columns={2}
          />
        </Field>
      ) : (
        <Callout tone="info" title={t("yours")} />
      )}
    </FormDialog>
  );
}
