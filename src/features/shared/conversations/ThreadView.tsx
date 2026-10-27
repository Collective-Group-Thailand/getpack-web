"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export type ThreadMessage = Schemas["MessageDto"];
export type ContextCard = NonNullable<ThreadMessage["contextCard"]>;

/** Whose side of the thread is looking: the customer, or getpack's staff. */
export type Perspective = "customer" | "staff";

/**
 * One conversation's messages, oldest first, for either side (U5.3, D-300). The customer's own
 * messages are `inbound`; getpack's are `outbound` and appear as the team on the customer's side,
 * by name on the staff side. Internal notes (staff only — the API never sends them to the
 * customer) are marked as such. A message of mine shows whether the other side has read it.
 *
 * Files and context cards are drawn by the zone (`renderFile`, `cardHref`): each zone downloads
 * through its own BFF and links a card to its own page for that record.
 */
export function ThreadView({
  messages,
  perspective,
  renderFile,
  cardHref,
  className,
}: {
  messages: readonly ThreadMessage[];
  perspective: Perspective;
  renderFile: (file: NonNullable<ThreadMessage["file"]>) => React.ReactNode;
  cardHref: (card: ContextCard) => string | null;
  className?: string;
}) {
  const t = useTranslations("common.conversation");
  const format = useFormat();
  const mine = (message: ThreadMessage) =>
    perspective === "customer" ? message.direction === "inbound" : message.direction === "outbound";

  if (messages.length === 0) return <p className={cn("text-muted text-sm", className)}>{t("empty")}</p>;

  return (
    <ol className={cn("flex flex-col gap-3", className)} aria-label={t("messages")}>
      {messages.map((message) => {
        const own = mine(message);
        const internal = message.visibility === "internal";
        const who = own
          ? t("you")
          : message.direction === "inbound"
            ? t("customer")
            : perspective === "customer"
              ? t("team")
              : (message.sender?.displayName ?? t("team"));
        if (message.kind === "system")
          return (
            <li key={message.id} className="text-muted self-center text-xs">
              {message.body} · {format.dateTime(message.sentAt)}
            </li>
          );
        return (
          <li
            key={message.id}
            className={cn(
              "flex max-w-[85%] flex-col gap-1 rounded-xl px-4 py-3 text-sm",
              internal
                ? "bg-warning-subtle self-stretch border border-dashed"
                : own
                  ? "bg-primary-subtle self-end"
                  : "bg-bg-subtle self-start",
            )}
          >
            <p className="text-muted flex flex-wrap items-center gap-x-2 text-xs">
              <span>{who}</span>
              <span>{format.dateTime(message.sentAt)}</span>
              {message.via === "line" ? (
                <Badge size="sm" tone="neutral">
                  {t("viaLine")}
                </Badge>
              ) : null}
              {internal ? (
                <Badge size="sm" tone="warning" icon="lock">
                  {t("internal")}
                </Badge>
              ) : null}
            </p>
            {message.body ? <p className="whitespace-pre-line">{message.body}</p> : null}
            {message.contextCard ? <CardChip card={message.contextCard} href={cardHref(message.contextCard)} /> : null}
            {message.file ? <div>{renderFile(message.file)}</div> : null}
            {own && !internal ? (
              <p className="text-muted self-end text-xs">{message.readAt ? t("read") : t("sent")}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function CardChip({ card, href }: { card: ContextCard; href: string | null }) {
  const t = useTranslations("common.conversation");
  const body = (
    <span className="border-border bg-surface flex items-center gap-2 rounded-lg border px-3 py-2">
      <Icon name={card.type === "design" ? "image" : card.type === "order" ? "package" : "document"} size={16} />
      <span className="flex flex-col">
        <span className="text-muted text-xs">{t(`cards.${card.type}`)}</span>
        <span className="font-mono font-medium">{card.label}</span>
      </span>
    </span>
  );
  return href ? (
    <a href={href} className="self-start underline-offset-4 hover:underline">
      {body}
    </a>
  ) : (
    <span className="self-start">{body}</span>
  );
}

export interface Draft {
  body: string;
  fileIds: string[];
}

/**
 * The reply box for either side. Files are uploaded first (api-conventions §3) by the zone's
 * `upload`, then sent as ids; quick replies fill the box rather than sending, so nothing leaves
 * without the sender seeing it. The draft survives a failed send. Sticky at the bottom on a phone,
 * where the thumb is (U5.7).
 */
export function Composer({
  onSend,
  upload,
  quickReplies = [],
  label,
  sendLabel,
  disabled,
  extra,
}: {
  onSend: (draft: Draft) => Promise<void>;
  upload?: (file: File) => Promise<{ id: string; name: string }>;
  quickReplies?: readonly string[];
  label: string;
  sendLabel: string;
  disabled?: boolean;
  /** More controls beside send (e.g. "add as an internal note" on the staff side). */
  extra?: React.ReactNode;
}) {
  const t = useTranslations("common.conversation");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState<"send" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const ready = (body.trim().length > 0 || files.length > 0) && busy === null && !disabled;

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ready) return;
    setBusy("send");
    setError(null);
    try {
      const sent = { body, fileIds: files.map((file) => file.id) };
      await onSend({ body: sent.body.trim(), fileIds: sent.fileIds });
      // Only what was sent is cleared: text typed while the send was in flight stays in the box.
      setBody((current) => (current === sent.body ? "" : current));
      setFiles((current) => current.filter((file) => !sent.fileIds.includes(file.id)));
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function attach(list: FileList | null) {
    if (!list?.length || !upload) return;
    setBusy("upload");
    setError(null);
    try {
      const added = await Promise.all([...list].map((file) => upload(file)));
      setFiles((current) => [...current, ...added]);
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setBusy(null);
      if (picker.current) picker.current.value = "";
    }
  }

  return (
    <form
      onSubmit={(event) => void send(event)}
      className="bg-surface border-border sticky bottom-0 flex flex-col gap-2 border-t pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:pb-0"
    >
      {quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("quickReplies")}>
          {quickReplies.map((reply) => (
            <Button key={reply} type="button" size="sm" variant="secondary" onClick={() => setBody(reply)}>
              {reply}
            </Button>
          ))}
        </div>
      ) : null}
      <label className="sr-only" htmlFor="composer-body">
        {label}
      </label>
      <Textarea
        id="composer-body"
        rows={3}
        maxLength={5000}
        value={body}
        placeholder={label}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/⌘ + Enter sends; Enter alone is a new line (Thai IMEs confirm with Enter).
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
        }}
      />
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label={t("attached")}>
          {files.map((file) => (
            <li key={file.id} className="bg-bg-subtle rounded-control flex items-center gap-1 px-3 py-1">
              <Icon name="paperclip" size={14} />
              {file.name}
              <button
                type="button"
                className="text-muted hover:text-fg ms-1"
                aria-label={t("removeFile", { name: file.name })}
                onClick={() => setFiles((current) => current.filter((f) => f.id !== file.id))}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <Callout tone="danger" title={error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {upload ? (
            <>
              <input
                ref={picker}
                type="file"
                multiple
                className="sr-only"
                accept="image/*,application/pdf"
                aria-label={t("attach")}
                onChange={(event) => void attach(event.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconStart="paperclip"
                loading={busy === "upload"}
                onClick={() => picker.current?.click()}
              >
                {t("attach")}
              </Button>
            </>
          ) : null}
          {extra}
        </div>
        <Button type="submit" iconStart="send" loading={busy === "send"} disabled={!ready}>
          {sendLabel}
        </Button>
      </div>
    </form>
  );
}
