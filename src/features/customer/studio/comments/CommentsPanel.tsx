"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { readAnchor, type CommentAnchor } from "@/features/designer/comments/anchor";
import { useCommentPins, type PickedPlace } from "@/features/designer/comments/pins";
import { formatDateTime } from "@/i18n/format";
import { isApiError } from "@/lib/api/problem";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

import { threadsOf, useComments, type CommentSource } from "./api";

export interface CommentsPanelProps {
  source: CommentSource;
  /** A picked place as an anchor (a face anchor for a 3D pick, a flat one otherwise). */
  toAnchor: (place: PickedPlace) => CommentAnchor | null;
  /** An anchor's point on the sheet (mm), to draw its pin. */
  toPoint: (anchor: CommentAnchor) => [number, number] | null;
  /** Where an anchor is, in words ("on ฝาบน", "on the flat sheet"). */
  placeOf: (anchor: CommentAnchor) => string;
  /** Who can be @mentioned: the company's members (none outside a company). */
  members?: { id: string; displayName: string }[];
  versionNo?: number | null;
}

/**
 * Comments on a design (U4.7, D-285): threads pinned to the 3D box (a face and a point on it) or to
 * a point of the flat sheet — "ปักหมุด" arms a click on either view — with replies, @mentions of
 * the company's members (notified by packio-api) and resolving. Each thread is numbered as its pin.
 */
export function CommentsPanel({ source, toAnchor, toPoint, placeOf, members = [], versionNo }: CommentsPanelProps) {
  const t = useTranslations("studio.comments");
  const locale = useLocale() as "th" | "en";
  const { list, add, resolve } = useComments(source);
  const placing = useCommentPins((s) => s.placing);
  const picked = useCommentPins((s) => s.picked);
  const active = useCommentPins((s) => s.active);
  const [showResolved, setShowResolved] = useState(false);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const threads = useMemo(() => threadsOf(list.data ?? []), [list.data]);
  const numbered = useMemo(() => threads.map((thread, i) => ({ ...thread, n: i + 1 })), [threads]);
  const shown = useMemo(
    () => numbered.filter((thread) => showResolved || !thread.root.resolvedAt),
    [numbered, showResolved],
  );
  const anchor = picked ? toAnchor(picked) : null;

  // The pins follow the threads shown; leaving the panel takes them away.
  useEffect(() => {
    const pins = shown.flatMap(({ root, n }) => {
      const a = readAnchor(root.anchor);
      const at = a ? toPoint(a) : null;
      return at ? [{ id: root.id, n, xMm: at[0], yMm: at[1], resolved: !!root.resolvedAt }] : [];
    });
    // Only a real change: the views redraw on every new array.
    const store = useCommentPins.getState();
    if (JSON.stringify(store.pins) !== JSON.stringify(pins)) store.setPins(pins);
  }, [shown, toPoint]);
  useEffect(
    () => () => {
      const pins = useCommentPins.getState();
      pins.setPins([]);
      pins.setPlacing(false);
      pins.clearPicked();
      pins.setActive(null);
    },
    [],
  );
  useEffect(() => {
    if (!placing) return;
    const cancel = (event: KeyboardEvent) => event.key === "Escape" && useCommentPins.getState().setPlacing(false);
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [placing]);

  const send = async (input: Parameters<typeof add>[0], done: () => void) => {
    setBusy(true);
    try {
      await add(input);
      done();
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? null;

  if (list.isError)
    return (
      <Callout
        tone={isApiError(list.error) && list.error.status === 401 ? "info" : "danger"}
        title={t(isApiError(list.error) && list.error.status === 401 ? "signIn" : "loadFailed")}
      />
    );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button
          size="sm"
          className="w-full"
          iconStart="map-pin"
          variant={placing ? "secondary" : "primary"}
          aria-pressed={placing}
          onClick={() => useCommentPins.getState().setPlacing(!placing)}
        >
          {placing ? t("cancelPlacing") : t("place")}
        </Button>
        {placing ? (
          <p className="text-muted text-xs" role="status">
            {t("placingHint")}
          </p>
        ) : null}
      </div>

      {picked ? (
        <form
          className="border-border space-y-2 rounded-md border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) return;
            void send(
              {
                body: body.trim(),
                ...(anchor ? { anchor } : {}),
                mentions,
                ...(versionNo ? { versionNo } : {}),
              },
              () => {
                setBody("");
                setMentions([]);
                useCommentPins.getState().clearPicked();
              },
            );
          }}
        >
          <p className="text-muted text-xs">{anchor ? t("pinnedAt", { place: placeOf(anchor) }) : t("unpinned")}</p>
          <Field label={t("body")}>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} autoFocus />
          </Field>
          {members.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">{t("mention")}</legend>
              {members.map((member) => (
                <Checkbox
                  key={member.id}
                  label={`@${member.displayName}`}
                  checked={mentions.includes(member.id)}
                  onCheckedChange={(on) =>
                    setMentions((ids) => (on ? [...ids, member.id] : ids.filter((id) => id !== member.id)))
                  }
                />
              ))}
            </fieldset>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
              {t("send")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => useCommentPins.getState().clearPicked()}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("threads", { count: shown.length })}</h3>
        <Switch checked={showResolved} onCheckedChange={setShowResolved} label={t("showResolved")} />
      </div>
      {list.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {list.isSuccess && shown.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}

      <ol className="space-y-3">
        {shown.map(({ root, replies, n }) => {
          const a = readAnchor(root.anchor);
          return (
            <li
              key={root.id}
              className={
                root.id === active
                  ? "border-primary space-y-2 rounded-md border-2 p-3"
                  : "border-border space-y-2 rounded-md border p-3"
              }
            >
              <button
                type="button"
                className="focus-visible:ring-focus-ring w-full rounded text-start outline-none focus-visible:ring-2"
                onClick={() => useCommentPins.getState().setActive(root.id === active ? null : root.id)}
                aria-label={t("threadLabel", { n, author: root.author.displayName })}
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={root.resolvedAt ? "neutral" : "warning"}>{n}</Badge>
                  <span className="font-medium">{root.author.displayName}</span>
                  <span className="text-muted text-xs">{formatDateTime(root.createdAt, locale)}</span>
                  {root.resolvedAt ? <Badge tone="success">{t("resolved")}</Badge> : null}
                </span>
                {a ? <span className="text-muted block text-xs">{placeOf(a)}</span> : null}
              </button>
              <p className="text-sm whitespace-pre-line">{root.body}</p>
              {root.mentions.length ? (
                <p className="text-muted text-xs">
                  {t("mentioned", { names: root.mentions.map((id) => `@${nameOf(id) ?? id.slice(0, 8)}`).join(", ") })}
                </p>
              ) : null}
              {replies.length ? (
                <ul className="border-border space-y-2 border-s-2 ps-3">
                  {replies.map((r) => (
                    <li key={r.id} className="text-sm">
                      <span className="font-medium">{r.author.displayName}</span>{" "}
                      <span className="text-muted text-xs">{formatDateTime(r.createdAt, locale)}</span>
                      <p className="whitespace-pre-line">{r.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {replyTo === root.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!reply.trim()) return;
                    void send({ body: reply.trim(), parentId: root.id }, () => {
                      setReply("");
                      setReplyTo(null);
                    });
                  }}
                >
                  <Field label={t("reply")}>
                    <Textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} autoFocus />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={busy} disabled={!reply.trim()}>
                      {t("send")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" iconStart="chat" onClick={() => setReplyTo(root.id)}>
                    {t("reply")}
                  </Button>
                  {resolve && !root.resolvedAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconStart="check"
                      aria-label={t("resolveLabel", { n })}
                      onClick={() =>
                        void resolve(root.id).catch((error: unknown) =>
                          toast.error(isApiError(error) ? error.detail : t("failed")),
                        )
                      }
                    >
                      {t("resolve")}
                    </Button>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
