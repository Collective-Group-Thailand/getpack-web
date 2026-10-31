"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CONVERSATION_SLA, CONVERSATION_STATUS } from "@/domain/status";
import { uploadFile } from "@/features/shared/files/upload";
import { Composer, ThreadView } from "@/features/shared/conversations/ThreadView";
import { useFormat } from "@/features/shared/format";
import { newIdempotencyKey } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { SlaTimer } from "@/ui/components/SlaTimer";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { adminBrowserApis, problemMessage, StatusChip, useActor, useCan, useSlaFormat } from "../console";
import { FileItem } from "../prepress/FileItem";
import { adminRecordHref, type Conversation } from "./resources";

const detailKey = (id: string) => queryKeys.detail("admin", "conversation", id);
const messagesKey = (id: string) => queryKeys.related("admin", "conversation", id, "messages");

/**
 * One customer conversation for CS (U5.3 §3, D-300): the thread with internal notes inline, the
 * customer's record and context cards linked to the back office, the first-response clock, and a
 * reply box with canned responses (filled in, never sent unseen) and an internal-note switch.
 * Opening it marks it read (the customer sees that as a read receipt); replying assigns it to me.
 */
export function InboxThread({ initial }: { initial: Conversation }) {
  const t = useTranslations("cs.inbox");
  const locale = useLocale() as "th" | "en";
  const format = useFormat();
  const sla = useSlaFormat();
  const client = useQueryClient();
  const me = useActor();
  const canReply = useCan("conversations.reply");
  const api = adminBrowserApis().contract;
  const [asNote, setAsNote] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [template, setTemplate] = useState<string>("");

  const conversation = useQuery({
    queryKey: detailKey(initial.id),
    queryFn: async () =>
      (await api.GET("/v1/admin/conversations/{conversationId}", { params: { path: { conversationId: initial.id } } }))
        .data!,
    initialData: initial,
  }).data;

  const messages = useQuery({
    queryKey: messagesKey(initial.id),
    queryFn: async () => {
      const { data } = await api.GET("/v1/admin/conversations/{conversationId}/messages", {
        params: { path: { conversationId: initial.id }, query: { limit: 100 } },
      });
      return [...(data?.data ?? [])].reverse();
    },
    refetchInterval: 20_000,
  });

  const canned = useQuery({
    queryKey: queryKeys.list("admin", "canned-response", { archived: false }),
    queryFn: async () =>
      (await api.GET("/v1/admin/canned-responses", { params: { query: { archived: false, perPage: 100 } } })).data!
        .data,
    enabled: canReply,
  });

  useEffect(() => {
    void api
      .POST("/v1/admin/conversations/{conversationId}/actions/mark-read", {
        params: { path: { conversationId: initial.id } },
      })
      .catch(() => undefined);
    // Once per opening: the read position is the API's to keep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: detailKey(initial.id) }),
      client.invalidateQueries({ queryKey: messagesKey(initial.id) }),
    ]);

  async function act(kind: "assign" | "close") {
    setBusy(kind);
    try {
      if (kind === "assign")
        await api.POST("/v1/admin/conversations/{conversationId}/actions/assign", {
          params: { path: { conversationId: initial.id } },
          body: { userId: me.id },
        });
      else
        await api.POST("/v1/admin/conversations/{conversationId}/actions/close", {
          params: { path: { conversationId: initial.id } },
        });
      await refresh();
    } catch (error) {
      toast.error(problemMessage(error, t("actionFailed")));
    } finally {
      setBusy(null);
    }
  }

  const templateBody = (id: string) => {
    const row = canned.data?.find((c) => c.id === id);
    return row ? (locale === "en" ? row.bodyEn : row.bodyTh) : "";
  };

  const subjectHref = conversation.subject ? adminRecordHref(conversation.subject) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* The thread fills the view and the reply box stays at its foot while the thread scrolls (it floated
          mid-page under a short thread). */}
      <div className="flex min-w-0 flex-col gap-4 lg:min-h-[calc(100dvh-15rem)]">
        <div aria-busy={messages.isPending} aria-live="polite" className="min-h-40 flex-1">
          {messages.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-3/5" />
              <Skeleton className="h-12 w-2/5 self-end" />
            </div>
          ) : messages.isError ? (
            <Callout tone="danger" title={t("loadFailed")} />
          ) : (
            <ThreadView
              messages={messages.data ?? []}
              perspective="staff"
              cardHref={adminRecordHref}
              renderFile={(file) => <FileItem fileId={file.id} name={file.name} />}
            />
          )}
        </div>
        {canReply ? (
          <div className="bg-bg border-border sticky bottom-0 z-10 -mx-1 border-t px-1 pt-3 pb-4">
            <Composer
              label={asNote ? t("noteLabel") : t("replyLabel")}
              sendLabel={asNote ? t("addNote") : t("send")}
              quickReplies={template ? [templateBody(template)] : []}
              upload={async (file) => {
                const uploaded = await uploadFile("admin", file, "evidence");
                return { id: uploaded.id, name: file.name };
              }}
              extra={<Switch label={t("asNote")} checked={asNote} onCheckedChange={setAsNote} />}
              onSend={async (draft) => {
                try {
                  if (asNote)
                    await api.POST("/v1/admin/conversations/{conversationId}/notes", {
                      params: {
                        path: { conversationId: initial.id },
                        header: { "Idempotency-Key": newIdempotencyKey() },
                      },
                      body: { body: draft.body, ...(draft.fileIds.length ? { fileIds: draft.fileIds } : {}) },
                    });
                  else
                    await api.POST("/v1/admin/conversations/{conversationId}/messages", {
                      params: {
                        path: { conversationId: initial.id },
                        header: { "Idempotency-Key": newIdempotencyKey() },
                      },
                      body: {
                        ...(draft.body ? { body: draft.body } : {}),
                        ...(draft.fileIds.length ? { fileIds: draft.fileIds } : {}),
                        ...(template && templateBody(template) === draft.body ? { cannedResponseId: template } : {}),
                      },
                    });
                  setTemplate("");
                  // The box frees at once; the thread catches up (U5.7 §2).
                  void refresh();
                } catch (error) {
                  throw new Error(problemMessage(error, t("sendFailed")));
                }
              }}
            />
          </div>
        ) : null}
      </div>

      <aside
        className="border-border bg-surface rounded-card flex flex-col gap-4 border p-4 text-sm lg:sticky lg:top-20"
        aria-label={t("details")}
      >
        <div className="flex flex-wrap gap-2">
          <StatusChip map={CONVERSATION_STATUS} value={conversation.status} />
          {conversation.sla.state ? <StatusChip map={CONVERSATION_SLA} value={conversation.sla.state} /> : null}
        </div>
        {conversation.sla.firstResponseDueAt && !conversation.sla.firstRespondedAt ? (
          <div>
            <p className="text-muted text-xs">{t("firstResponseDue")}</p>
            <SlaTimer
              dueAt={conversation.sla.firstResponseDueAt}
              state={conversation.sla.state === "overdue" ? "breached" : "on_track"}
              absolute={format.dateTime(conversation.sla.firstResponseDueAt)}
              // The distance is negative once the time has passed: "เลยมา 1 วัน 13 ชม.", never "-2261 นาที".
              format={(ms, overdue) => sla(Math.abs(ms), overdue)}
            />
          </div>
        ) : null}
        <dl className="flex flex-col gap-2">
          <div>
            <dt className="text-muted text-xs">{t("columns.customer")}</dt>
            <dd>
              {conversation.customer ? (
                <Link href={`/customers/${conversation.customer.id}`} className="text-primary hover:underline">
                  {conversation.customer.displayName}
                </Link>
              ) : (
                (conversation.lineDisplayName ?? t("unknownCustomer"))
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("columns.subject")}</dt>
            <dd>
              {conversation.subject ? (
                subjectHref ? (
                  <Link href={subjectHref} className="text-primary tabular-nums hover:underline">
                    {t(`subjects.${conversation.subjectType}`)} {conversation.subject.label}
                  </Link>
                ) : (
                  `${t(`subjects.${conversation.subjectType}`)} ${conversation.subject.label}`
                )
              ) : (
                t("subjects.support")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("replyChannel")}</dt>
            <dd>{t(`channels.${conversation.replyChannel}`)}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">{t("columns.assignee")}</dt>
            <dd>{conversation.assignee?.displayName ?? t("unassigned")}</dd>
          </div>
        </dl>
        {canReply ? (
          <div className="flex flex-col gap-2">
            {canned.data?.length ? (
              <SearchableSelect
                aria-label={t("canned")}
                value={template || undefined}
                onValueChange={setTemplate}
                placeholder={t("canned")}
                options={canned.data.map((c) => ({ value: c.id, label: c.title }))}
              />
            ) : null}
            {/* One step forward — take the conversation — and closing it one deliberate step away in "⋯". */}
            <div className="flex items-center gap-2">
              {conversation.assignee?.id !== me.id ? (
                <Button
                  className="flex-1"
                  variant="secondary"
                  loading={busy === "assign"}
                  onClick={() => void act("assign")}
                >
                  {t("assignToMe")}
                </Button>
              ) : null}
              {conversation.status !== "closed" ? (
                <DropdownMenu
                  label={t("close")}
                  align="end"
                  items={[{ id: "close", label: t("close"), icon: "archive", onSelect: () => void act("close") }]}
                  trigger={<IconButton name="more" variant="secondary" label={t("close")} />}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
