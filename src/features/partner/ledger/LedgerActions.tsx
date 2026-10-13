"use client";

import { useTranslations } from "next-intl";

import { SalesActions } from "@/features/partner/sales/SalesActions";
import type { Schemas } from "@/lib/api/types";

import { MatchBankLine } from "./AssetBankForms";
import { ReverseJournal } from "./LedgerForms";

type Journal = Schemas["ErpGlJournalDto"];
type Period = Schemas["ErpGlPeriodDto"];
type Change = Schemas["ErpGlAccountChangeDto"];
type Line = Schemas["ErpGlBankLineDto"];

/** D-389: what may be done to a journal entry — only what its `nextActions` offer. */
export function JournalActions({ journal: j, etag }: { journal: Journal; etag: string | null }) {
  const t = useTranslations("partnerLedger.journal");
  const tc = useTranslations("partnerLedger.common");
  const post = (key: string, action: string, title: string, description: string, done: string, reason = false) => ({
    key,
    kind: "post" as const,
    path: `/ledger/journals/{entryId}/actions/${action}`,
    params: { entryId: j.id },
    title,
    description,
    done,
    ...(reason ? { reason: { label: tc("reasonLabel") }, body: (r: string) => ({ reason: r }) } : {}),
  });
  return (
    <div className="flex flex-wrap gap-2">
      <SalesActions
        offered={j.nextActions}
        etag={etag}
        actions={[
          { key: "erp_journal.edit", kind: "link", href: `/ledger/journals/new?edit=${j.id}` },
          { ...post("erp_journal.submit", "submit", t("submitTitle"), t("submitBody"), t("submitDone")), primary: true },
          { ...post("erp_journal.approve", "approve", t("approveTitle"), t("approveBody"), t("approveDone")), primary: true },
          post("erp_journal.reject", "reject", t("rejectTitle"), t("rejectBody"), t("rejectDone"), true),
          {
            key: "erp_journal.delete",
            kind: "delete",
            path: "/ledger/journals/{entryId}",
            params: { entryId: j.id },
            title: t("deleteTitle"),
            description: t("deleteBody"),
            done: t("deleteDone"),
            next: () => "/ledger/journals",
          },
        ]}
      />
      {j.nextActions.some((a) => a.key === "erp_journal.reverse" && !a.disabledReason) ? <ReverseJournal journal={j} /> : null}
    </div>
  );
}

/** D-390: a period's transitions and, on the last month, the year-end close. */
export function PeriodActions({ period }: { period: Period }) {
  const t = useTranslations("partnerLedger.period");
  const tc = useTranslations("partnerLedger.common");
  const transition = (key: string, action: string, title: string, description: string, reason = false) => ({
    key,
    kind: "post" as const,
    path: "/ledger/periods/{periodId}/actions/transition",
    params: { periodId: period.id },
    title,
    description,
    body: (note: string) => ({ action, ...(note ? { note } : {}) }),
    ...(reason ? { reason: { label: tc("reasonLabel") } } : {}),
    done: t("done"),
  });
  return (
    <SalesActions
      offered={period.nextActions}
      actions={[
        transition("erp_period.soft_close", "soft_close", t("softClose", { month: period.month }), t("softCloseBody")),
        { ...transition("erp_period.close", "close", t("close", { month: period.month }), t("closeBody")), primary: true },
        transition("erp_period.lock", "lock", t("lock", { month: period.month }), t("lockBody")),
        transition("erp_period.reopen", "reopen", t("reopen", { month: period.month }), t("reopenBody"), true),
        {
          key: "erp_period.close_year",
          kind: "post",
          path: "/ledger/fiscal-years/{yearId}/actions/close",
          params: { yearId: period.fiscalYearId },
          title: t("closeYear", { label: period.fiscalYear }),
          description: t("closeYearBody"),
          done: t("closeYearDone"),
        },
      ]}
    />
  );
}

/** D-386: approve or reject a proposed chart change (never one's own — the API says so). */
export function ChangeDecision({ change }: { change: Change }) {
  const t = useTranslations("partnerLedger.accounts");
  const tc = useTranslations("partnerLedger.common");
  return (
    <SalesActions
      offered={change.nextActions}
      actions={[
        {
          key: "erp_account_change.approve",
          kind: "post",
          path: "/ledger/account-changes/{changeId}/actions/approve",
          params: { changeId: change.id },
          title: t("approveTitle"),
          description: t("approveBody"),
          body: () => ({}),
          done: t("decided"),
          primary: true,
        },
        {
          key: "erp_account_change.reject",
          kind: "post",
          path: "/ledger/account-changes/{changeId}/actions/reject",
          params: { changeId: change.id },
          title: t("rejectTitle"),
          description: change.reason,
          reason: { label: tc("noteLabel") },
          body: (note: string) => ({ note }),
          done: t("decided"),
        },
      ]}
    />
  );
}

/** D-394: match, ignore or undo a statement line. */
export function BankLineActions({ line }: { line: Line }) {
  const t = useTranslations("partnerLedger.bank");
  const tc = useTranslations("partnerLedger.common");
  return (
    <div className="flex flex-wrap gap-2">
      {line.nextActions.some((a) => a.key === "erp_bank_line.match") ? <MatchBankLine line={line} /> : null}
      <SalesActions
        offered={line.nextActions.filter((a) => a.key !== "erp_bank_line.match")}
        actions={[
          {
            key: "erp_bank_line.ignore",
            kind: "post",
            path: "/ledger/bank-lines/{lineId}/actions/ignore",
            params: { lineId: line.id },
            title: t("ignoreTitle"),
            description: t("ignoreBody"),
            reason: { label: tc("reasonLabel") },
            body: (reason: string) => ({ reason }),
            done: t("ignored"),
          },
          { key: "erp_bank_line.unmatch", kind: "post", path: "/ledger/bank-lines/{lineId}/actions/unmatch", params: { lineId: line.id }, title: t("unmatchTitle"), description: t("unmatchBody"), done: t("unmatched") },
        ]}
      />
    </div>
  );
}
