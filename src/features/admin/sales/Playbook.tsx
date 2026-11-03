"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SALES_PLAYBOOK_STATUS } from "@/domain/status";
import { useFormat, When } from "@/features/shared/format";
import { PlaybookCard } from "@/features/shared/sales/PlaybookCard";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import type { DataTableColumn } from "@/ui/components/DataTable";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { PageHeader } from "@/ui/components/PageHeader";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { toast } from "@/ui/components/Toast";
import { cn } from "@/ui/lib/cn";

import {
  adminBrowserApis,
  ConfirmAction,
  FormDialog,
  problemMessage,
  QueryError,
  QueueTabs,
  ResourceList,
  StatusChip,
  useActor,
  useCan,
  type FilterDef,
  type InitialPage,
} from "../console";
import { DetailSkeleton } from "../console/DetailSkeleton";
import {
  PLAYBOOK_AUDIENCES,
  PLAYBOOK_CONTEXTS,
  PLAYBOOK_STATUSES,
  playbookList,
  type PlaybookCardAdmin,
} from "./resources";

type Context = Schemas["SalesPlaybookContext"];
type Audience = Schemas["SalesPlaybookAudience"];

/**
 * The cards this browser drafted, edited or submitted. The card DTO names no author or submitter yet (contract
 * request `sales_playbook.card-actors`), so the publish button is held back here for the maker — the API refuses it
 * anyway (`sales_playbook.maker_checker`); this only spares the maker a refusal.
 */
const MADE_HERE = "getpack.salesPlaybook.madeHere";
function madeHere(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MADE_HERE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function markMadeHere(cardId: string, userId: string) {
  try {
    localStorage.setItem(MADE_HERE, JSON.stringify({ ...madeHere(), [cardId]: userId }));
  } catch {
    // Private mode: the API's maker-checker still holds.
  }
}

/** The playbook cards, every version (D-470): what is live, what waits for a publisher, what was retired. */
export function PlaybookList({ initial }: { initial: InitialPage<PlaybookCardAdmin> | null }) {
  const t = useTranslations("sales.playbook");
  const tStatus = useTranslations("status");
  const tContexts = useTranslations("agentSales.playbook.contexts");
  const [creating, setCreating] = useState(false);
  const columns: DataTableColumn<PlaybookCardAdmin>[] = [
    {
      id: "card",
      header: t("columns.card"),
      cell: (row) => (
        <div className="flex max-w-[26rem] min-w-0 flex-col">
          <Link href={`/sales/playbook/${row.id}`} className="text-primary truncate font-medium hover:underline">
            {row.titleTh}
          </Link>
          <span className="text-muted text-xs">{t("keyVersion", { key: row.key, version: row.version })}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip map={SALES_PLAYBOOK_STATUS} value={row.status} />
          {row.status === "draft" && row.submitted ? (
            <span className="text-warning-subtle-fg text-xs font-medium">{t("waitingPublish")}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "audiences",
      header: t("columns.audiences"),
      cell: (row) => (
        <span className="text-sm">{row.audiences.map((audience) => t(`audiences.${audience}`)).join(" · ")}</span>
      ),
    },
    {
      id: "contexts",
      header: t("columns.contexts"),
      cell: (row) => (
        <span className="text-muted line-clamp-2 max-w-[16rem] text-xs">
          {row.contexts.map((context) => tContexts(context)).join(" · ")}
        </span>
      ),
    },
    {
      id: "owner",
      header: t("columns.owner"),
      cell: (row) => <span className="text-sm">{t(`owners.${row.ownerRole}`)}</span>,
    },
    { id: "updatedAt", header: t("columns.updated"), cell: (row) => <When at={row.updatedAt} /> },
  ];
  const filters: FilterDef[] = [
    {
      id: "audience",
      label: t("columns.audiences"),
      kind: "select",
      options: PLAYBOOK_AUDIENCES.map((audience) => ({ value: audience, label: t(`audiences.${audience}`) })),
    },
  ];
  return (
    <>
      <ResourceList
        views={
          <QueueTabs
            countFrom={playbookList}
            label={t("statusesLabel")}
            param="status"
            tabs={[
              { value: null, label: t("all") },
              ...PLAYBOOK_STATUSES.map((status) => ({
                value: status,
                label: tStatus(SALES_PLAYBOOK_STATUS[status].labelKey),
              })),
            ]}
          />
        }
        resource={playbookList}
        columns={columns}
        caption={t("title")}
        filters={filters}
        initial={initial}
        searchLabel={t("search")}
        savedViews={false}
        rowHref={(row) => `/sales/playbook/${row.id}`}
        rowTone={(row) => (row.status === "draft" && row.submitted ? "warning" : undefined)}
        toolbarEnd={
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            {t("new")}
          </Button>
        }
        empty={{
          title: t("empty"),
          action: (
            <Button variant="secondary" iconStart="plus" onClick={() => setCreating(true)}>
              {t("new")}
            </Button>
          ),
        }}
      />
      {creating ? <NewCardDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function NewCardDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sales.playbook.create");
  const actor = useActor();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Schemas["SalesPlaybookOwnerRole"]>(
    actor.roles.includes("sales_manager") ? "sales_manager" : "marketing",
  );
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      title={t("title")}
      description={t("description")}
      submitLabel={t("submit")}
      onClose={onClose}
      onSubmit={async () => {
        if (!/^[a-z0-9-]{3,48}$/.test(key)) {
          setError(t("keyInvalid"));
          throw new Error("key");
        }
        try {
          const card = (
            await adminBrowserApis().contract.POST("/v1/admin/sales/playbook", {
              body: {
                key,
                titleTh: title.trim() || key,
                bodyTh: "",
                ownerRole: owner,
                contexts: ["all"],
                audiences: ["rep"],
              },
            })
          ).data!;
          markMadeHere(card.id, actor.id);
          toast.success(t("done"));
          router.push(`/sales/playbook/${card.id}`);
        } catch (failure) {
          toast.error(problemMessage(failure, t("failed")));
          throw failure;
        }
      }}
    >
      <Field label={t("key")} hint={t("keyHint")} error={error ?? undefined} required>
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value.toLowerCase())}
          autoCapitalize="off"
          spellCheck={false}
        />
      </Field>
      <Field label={t("titleTh")}>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label={t("owner")} hint={t("ownerHint")}>
        <SegmentedControl
          label={t("owner")}
          value={owner}
          onValueChange={setOwner}
          options={(["marketing", "sales_manager"] as const).map((value) => ({ value, label: t(`owners.${value}`) }))}
        />
      </Field>
    </FormDialog>
  );
}

/**
 * One card version (D-470): the editor beside a live preview of how the agent zone shows it (a phone and a desktop
 * frame, the agent zone's own card component), its contexts and audience, every version of the key, and the
 * maker-checker path — save the draft, submit, and someone else publishes; retire a live card.
 */
export function PlaybookEditor({ cardId }: { cardId: string }) {
  const card = useQuery({
    queryKey: queryKeys.detail("admin", "sales_playbook_card", cardId),
    queryFn: async () =>
      (await adminBrowserApis().contract.GET("/v1/admin/sales/playbook/{cardId}", { params: { path: { cardId } } }))
        .data!,
  });
  if (card.isError) return <QueryError error={card.error} onRetry={() => void card.refetch()} />;
  if (!card.data) return <DetailSkeleton />;
  // Keyed by the version's last change: a save, submit or publish starts the form again from what the API holds.
  return (
    <EditorBody
      key={`${card.data.id}:${card.data.updatedAt}:${card.data.status}`}
      c={card.data}
      onChanged={() => void card.refetch()}
    />
  );
}

function EditorBody({ c, onChanged }: { c: PlaybookCardAdmin; onChanged: () => void }) {
  const t = useTranslations("sales.playbook.editor");
  const tPlaybook = useTranslations("sales.playbook");
  const tStatus = useTranslations("status");
  const tContexts = useTranslations("agentSales.playbook.contexts");
  const format = useFormat();
  const actor = useActor();
  const router = useRouter();
  const client = useQueryClient();
  const canPublish = useCan("sales_playbook.publish");
  const versions = useQuery({
    queryKey: queryKeys.list("admin", "sales_playbook_card", { key: c.key }),
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/sales/playbook", {
          params: { query: { key: c.key, perPage: 50 } },
        })
      ).data!,
  });
  const [draft, setDraft] = useState(() => ({
    titleTh: c.titleTh,
    titleEn: c.titleEn ?? "",
    bodyTh: c.bodyTh,
    bodyEn: c.bodyEn ?? "",
    contexts: c.contexts as Context[],
    audiences: c.audiences as Audience[],
    replies: c.suggestedReplies.map((reply) => ({ th: reply.th, en: reply.en ?? "" })),
    changeNote: c.changeNote ?? "",
  }));
  const [frame, setFrame] = useState<"phone" | "desktop">("phone");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "retire" | null>(null);
  const [made, setMade] = useState(() => madeHere()[c.id] === actor.id);
  const [error, setError] = useState<string | null>(null);
  const owner = actor.roles.includes("superadmin") || actor.roles.includes(c.ownerRole);
  const editable = c.status === "draft" && owner;
  const dirty =
    editable &&
    (draft.titleTh !== c.titleTh ||
      draft.titleEn !== (c.titleEn ?? "") ||
      draft.bodyTh !== c.bodyTh ||
      draft.bodyEn !== (c.bodyEn ?? "") ||
      draft.changeNote !== (c.changeNote ?? "") ||
      JSON.stringify(draft.contexts) !== JSON.stringify(c.contexts) ||
      JSON.stringify(draft.audiences) !== JSON.stringify(c.audiences) ||
      JSON.stringify(draft.replies) !==
        JSON.stringify(c.suggestedReplies.map((reply) => ({ th: reply.th, en: reply.en ?? "" }))));
  const preview: Schemas["AgentPlaybookCardDto"] = {
    id: `preview-${c.id}`,
    key: c.key,
    version: c.version,
    contexts: draft.contexts,
    titleTh: draft.titleTh || t("untitled"),
    titleEn: draft.titleEn || null,
    bodyTh: draft.bodyTh,
    bodyEn: draft.bodyEn || null,
    suggestedReplies: draft.replies
      .filter((reply) => reply.th.trim())
      .map((reply) => ({ th: reply.th, en: reply.en || null })),
  };
  const refresh = () => {
    onChanged();
    void client.invalidateQueries({ queryKey: ["admin", "sales_playbook_card"] });
  };
  const run = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setError(null);
    try {
      await action();
      toast.success(done);
      refresh();
    } catch (failure) {
      setError(problemMessage(failure, t("failed")));
    } finally {
      setBusy(null);
    }
  };
  const save = () =>
    run(
      "save",
      async () => {
        await adminBrowserApis().contract.PATCH("/v1/admin/sales/playbook/{cardId}", {
          params: { path: { cardId: c.id } },
          body: {
            titleTh: draft.titleTh.trim(),
            titleEn: draft.titleEn.trim() || null,
            bodyTh: draft.bodyTh,
            bodyEn: draft.bodyEn.trim() || null,
            contexts: draft.contexts,
            audiences: draft.audiences,
            suggestedReplies: draft.replies
              .filter((reply) => reply.th.trim())
              .map((reply) => ({ th: reply.th.trim(), en: reply.en.trim() || null })),
            ...(draft.changeNote.trim() ? { changeNote: draft.changeNote.trim() } : {}),
          },
        });
        markMadeHere(c.id, actor.id);
        setMade(true);
      },
      t("saved"),
    );
  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const latestDraft = versions.data?.data.find((row) => row.status === "draft");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/sales/playbook", label: tPlaybook("title") }}
        title={c.titleTh}
        meta={
          <>
            <StatusChip map={SALES_PLAYBOOK_STATUS} value={c.status} size="md" />
            <span className="text-muted text-sm">
              {tPlaybook("keyVersionOwner", {
                key: c.key,
                version: c.version,
                owner: tPlaybook(`owners.${c.ownerRole}`),
              })}
            </span>
            {c.status === "draft" && c.submitted ? (
              <span className="text-warning-subtle-fg text-sm font-medium">{tPlaybook("waitingPublish")}</span>
            ) : null}
          </>
        }
        actions={
          c.status !== "draft" && owner && !latestDraft ? (
            <Button
              variant="secondary"
              iconStart="edit"
              loading={busy === "new"}
              onClick={() =>
                void run(
                  "new",
                  async () => {
                    const next = (
                      await adminBrowserApis().contract.POST("/v1/admin/sales/playbook", { body: { key: c.key } })
                    ).data!;
                    markMadeHere(next.id, actor.id);
                    router.push(`/sales/playbook/${next.id}`);
                  },
                  t("newDraftDone"),
                )
              }
            >
              {t("newDraft")}
            </Button>
          ) : latestDraft && latestDraft.id !== c.id ? (
            <Button asChild variant="secondary">
              <Link href={`/sales/playbook/${latestDraft.id}`}>{t("openDraft", { version: latestDraft.version })}</Link>
            </Button>
          ) : null
        }
      />
      {error ? <Callout tone="danger" title={error} /> : null}
      {!owner ? <Callout tone="info" title={t("notOwner", { owner: tPlaybook(`owners.${c.ownerRole}`) })} /> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="editor-heading"
          className="border-border bg-surface rounded-card flex min-w-0 flex-col gap-4 border p-4 sm:p-5"
        >
          <h2 id="editor-heading" className="text-base font-semibold">
            {editable ? t("editTitle") : t("readTitle")}
          </h2>
          <fieldset disabled={!editable} className="flex flex-col gap-4">
            <Field label={t("titleTh")} required>
              <Input value={draft.titleTh} onChange={(event) => setDraft({ ...draft, titleTh: event.target.value })} />
            </Field>
            <Field label={t("bodyTh")} hint={t("bodyHint")}>
              <Textarea
                value={draft.bodyTh}
                onChange={(event) => setDraft({ ...draft, bodyTh: event.target.value })}
                rows={8}
              />
            </Field>
            <details className="group">
              <summary className="text-primary cursor-pointer text-sm font-medium">{t("english")}</summary>
              <div className="mt-3 flex flex-col gap-3">
                <Field label={t("titleEn")}>
                  <Input
                    value={draft.titleEn}
                    onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })}
                  />
                </Field>
                <Field label={t("bodyEn")}>
                  <Textarea
                    value={draft.bodyEn}
                    onChange={(event) => setDraft({ ...draft, bodyEn: event.target.value })}
                    rows={5}
                  />
                </Field>
              </div>
            </details>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("contexts")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLAYBOOK_CONTEXTS.map((context) => (
                  <Checkbox
                    key={context}
                    size="sm"
                    label={tContexts(context)}
                    checked={draft.contexts.includes(context)}
                    onCheckedChange={() => setDraft({ ...draft, contexts: toggle(draft.contexts, context) })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("audiences")}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PLAYBOOK_AUDIENCES.map((audience) => (
                  <Checkbox
                    key={audience}
                    size="sm"
                    label={tPlaybook(`audiences.${audience}`)}
                    checked={draft.audiences.includes(audience)}
                    onCheckedChange={() => setDraft({ ...draft, audiences: toggle(draft.audiences, audience) })}
                  />
                ))}
              </div>
              {draft.audiences.includes("agent") ? <p className="text-muted text-xs">{t("agentWording")}</p> : null}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("replies")}</legend>
              {draft.replies.map((reply, at) => (
                <div key={at} className="flex items-start gap-2">
                  <Textarea
                    aria-label={t("replyN", { n: at + 1 })}
                    value={reply.th}
                    rows={2}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        replies: draft.replies.map((row, index) =>
                          index === at ? { ...row, th: event.target.value } : row,
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart="trash"
                    aria-label={t("removeReply", { n: at + 1 })}
                    onClick={() => setDraft({ ...draft, replies: draft.replies.filter((_, index) => index !== at) })}
                  />
                </div>
              ))}
              {draft.replies.length < 10 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart="plus"
                  className="self-start"
                  onClick={() => setDraft({ ...draft, replies: [...draft.replies, { th: "", en: "" }] })}
                >
                  {t("addReply")}
                </Button>
              ) : null}
            </fieldset>
            <Field label={t("changeNote")}>
              <Input
                value={draft.changeNote}
                onChange={(event) => setDraft({ ...draft, changeNote: event.target.value })}
              />
            </Field>
          </fieldset>

          <div className="border-border flex flex-col gap-3 border-t pt-4">
            {c.status === "draft" ? (
              <>
                <ol className="text-muted grid gap-1 text-sm sm:grid-cols-3">
                  <li className={cn(!c.submitted && "text-fg font-medium")}>{t("steps.save")}</li>
                  <li className={cn(c.submitted && "text-fg font-medium")}>{t("steps.submit")}</li>
                  <li>{t("steps.publish")}</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  {editable ? (
                    <Button variant="secondary" loading={busy === "save"} disabled={!dirty} onClick={() => void save()}>
                      {t("save")}
                    </Button>
                  ) : null}
                  {editable && !c.submitted ? (
                    <Button
                      iconStart="send"
                      loading={busy === "submit"}
                      disabled={dirty}
                      onClick={() =>
                        void run(
                          "submit",
                          async () => {
                            await adminBrowserApis().contract.POST("/v1/admin/sales/playbook/{cardId}/actions/submit", {
                              params: { path: { cardId: c.id } },
                            });
                            markMadeHere(c.id, actor.id);
                            setMade(true);
                          },
                          t("submitted"),
                        )
                      }
                    >
                      {t("submit")}
                    </Button>
                  ) : null}
                  {canPublish ? (
                    <Button
                      iconStart="check"
                      disabled={!c.submitted || made || dirty}
                      aria-describedby="publish-why"
                      onClick={() => setConfirm("publish")}
                    >
                      {t("publish")}
                    </Button>
                  ) : null}
                </div>
                <p id="publish-why" className="text-muted text-sm">
                  {!c.submitted
                    ? t("publishNeedsSubmit")
                    : made
                      ? t("publishByOther")
                      : canPublish
                        ? t("publishReady", { at: c.submittedAt ? format.dateTime(c.submittedAt) : "—" })
                        : t("publishByOther")}
                </p>
                {dirty ? <p className="text-warning-subtle-fg text-sm">{t("saveFirst")}</p> : null}
              </>
            ) : c.status === "published" && owner ? (
              <Button
                variant="ghost"
                className="text-danger self-start"
                iconStart="archive"
                onClick={() => setConfirm("retire")}
              >
                {t("retire")}
              </Button>
            ) : (
              <p className="text-muted text-sm">{c.status === "retired" ? t("retiredNote") : t("liveNote")}</p>
            )}
          </div>
        </section>

        <section aria-labelledby="preview-heading" className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="preview-heading" className="text-base font-semibold">
              {t("preview")}
            </h2>
            <SegmentedControl
              label={t("frame")}
              value={frame}
              onValueChange={setFrame}
              options={[
                { value: "phone", label: t("phone"), icon: "smartphone" },
                { value: "desktop", label: t("desktop"), icon: "desktop" },
              ]}
            />
          </div>
          <p className="text-muted text-sm">{t("previewHint")}</p>
          <div
            className="bg-surface-subtle rounded-card flex justify-center overflow-hidden p-4 sm:p-6"
            data-frame={frame}
          >
            {frame === "phone" ? (
              <div className="border-border bg-bg rounded-card w-full max-w-[22.5rem] overflow-hidden border shadow-sm">
                <div className="border-border text-muted flex items-center justify-between border-b px-4 py-2 text-xs">
                  <span>{t("frameApp")}</span>
                  <span>{tPlaybook("audiences.agent")}</span>
                </div>
                <div className="max-h-[36rem] overflow-y-auto p-3">
                  <PlaybookCard card={preview} />
                </div>
              </div>
            ) : (
              <div className="border-border bg-bg rounded-card w-full overflow-hidden border shadow-sm">
                <div className="border-border flex items-center gap-1.5 border-b px-3 py-2">
                  <span className="bg-border-strong size-2 rounded-full" />
                  <span className="bg-border-strong size-2 rounded-full" />
                  <span className="bg-border-strong size-2 rounded-full" />
                  <span className="text-muted ms-2 text-xs">{t("frameUrl")}</span>
                </div>
                <div className="max-h-[36rem] overflow-y-auto p-5">
                  <PlaybookCard card={preview} />
                </div>
              </div>
            )}
          </div>
          <section
            aria-labelledby="versions-heading"
            className="border-border bg-surface rounded-card flex flex-col gap-2 border p-4"
          >
            <h3 id="versions-heading" className="text-sm font-semibold">
              {t("versions")}
            </h3>
            <ul className="divide-border flex flex-col divide-y text-sm">
              {(versions.data?.data ?? [])
                .slice()
                .sort((a, b) => b.version - a.version)
                .map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link
                      href={`/sales/playbook/${version.id}`}
                      aria-current={version.id === c.id ? "page" : undefined}
                      className={cn("hover:underline", version.id === c.id ? "font-semibold" : "text-link")}
                    >
                      {t("versionN", { version: version.version })}
                    </Link>
                    <StatusChip map={SALES_PLAYBOOK_STATUS} value={version.status} />
                    <span className="text-muted max-w-[16rem] truncate text-xs">{version.changeNote ?? "—"}</span>
                    <span className="text-muted text-xs">
                      {format.date(version.publishedAt ?? version.updatedAt, { style: "dayMonth" })}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </section>
      </div>

      <ConfirmAction
        open={confirm !== null}
        onOpenChange={(next) => (next ? undefined : setConfirm(null))}
        title={confirm === "retire" ? t("retireTitle") : t("publishTitle")}
        description={
          confirm === "retire"
            ? t("retireBody")
            : t("publishBody", { audiences: c.audiences.map((a) => tPlaybook(`audiences.${a}`)).join(" · ") })
        }
        confirmLabel={confirm === "retire" ? t("retire") : t("publish")}
        tone={confirm === "retire" ? "destructive" : "primary"}
        onConfirm={async () => {
          try {
            if (confirm === "retire")
              await adminBrowserApis().contract.POST("/v1/admin/sales/playbook/{cardId}/actions/retire", {
                params: { path: { cardId: c.id } },
              });
            else
              await adminBrowserApis().contract.POST("/v1/admin/sales/playbook/{cardId}/actions/publish", {
                params: { path: { cardId: c.id } },
              });
            toast.success(confirm === "retire" ? t("retired") : t("published"));
            refresh();
          } catch (failure) {
            toast.error(problemMessage(failure, t("failed")));
            throw failure;
          }
        }}
      />
      <span className="sr-only" aria-live="polite">
        {c.status === "published" ? tStatus(SALES_PLAYBOOK_STATUS.published.labelKey) : ""}
      </span>
    </div>
  );
}
