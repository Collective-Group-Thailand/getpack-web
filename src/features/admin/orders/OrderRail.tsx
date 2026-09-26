"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";
import type { IconName } from "@/ui/icons";

import { problemMessage, useRoleLabel } from "../console";

const KIND_ICONS: Record<string, IconName> = {
  order: "package",
  payment: "wallet",
  slip: "receipt",
  proof: "file-check",
  artwork: "image",
  milestone: "factory",
  production: "factory",
  shipment: "truck",
};

/**
 * The right rail (F2 A.3): the unified timeline — customer-visible and internal events alike,
 * with promised against actual for milestones — and the team's internal notes.
 */
export function OrderRail({ orderId }: { orderId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Notes orderId={orderId} />
      <OrderTimeline orderId={orderId} />
    </div>
  );
}

function OrderTimeline({ orderId }: { orderId: string }) {
  const t = useTranslations("orders.rail");
  const format = useFormat();
  const feed = useInfiniteQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "timeline"),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      browserRequests().call("GET /v1/admin/orders/{orderId}/timeline", {
        path: { orderId },
        query: { cursor: pageParam, limit: 30 },
      }),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: STALE_TIME.transactional,
  });
  const entries = feed.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>{t("timeline")}</CardTitle>
      </CardHeader>
      {feed.isError ? <p className="text-danger text-sm">{problemMessage(feed.error, t("timelineFailed"))}</p> : null}
      <Timeline
        label={t("timeline")}
        items={entries.map((entry) => {
          const late = entry.promisedAt && Date.parse(entry.at) > Date.parse(entry.promisedAt);
          return {
            id: entry.id,
            title: (
              <span className="flex flex-wrap items-center gap-1">
                {entry.title}
                {entry.visibility === "internal" ? <Badge size="sm">{t("internal")}</Badge> : null}
              </span>
            ),
            time: <When at={entry.at} />,
            actor: entry.actor?.displayName,
            icon: KIND_ICONS[entry.kind.split(".")[0] ?? ""] ?? "circle",
            tone: late
              ? "warning"
              : entry.kind.endsWith("rejected") || entry.kind.endsWith("cancelled")
                ? "danger"
                : undefined,
            description:
              [
                entry.detail,
                entry.promisedAt
                  ? t(late ? "promisedLate" : "promisedOnTime", { at: format.dateTime(entry.promisedAt) })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined,
          };
        })}
      />
      {feed.hasNextPage ? (
        <Button
          variant="link"
          size="sm"
          className="mt-2"
          loading={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {t("more")}
        </Button>
      ) : null}
    </Card>
  );
}

function Notes({ orderId }: { orderId: string }) {
  const t = useTranslations("orders.rail");
  const tCommon = useTranslations("common");
  const roleLabel = useRoleLabel();
  const queryClient = useQueryClient();
  const key = queryKeys.related("admin", "order", orderId, "notes");
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<ComboboxOption[]>([]);
  const [picking, setPicking] = useState<ComboboxOption | null>(null);
  const [query, setQuery] = useState("");

  const notes = useQuery({
    queryKey: key,
    queryFn: () => browserRequests().call("GET /v1/admin/orders/{orderId}/notes", { path: { orderId } }),
  });
  const people = useQuery({
    queryKey: queryKeys.list("admin", "staff_directory", { q: query }),
    queryFn: () =>
      browserRequests().call("GET /v1/admin/staff-directory", { query: { q: query || undefined, limit: 10 } }),
    staleTime: STALE_TIME.reference,
  });

  const add = useMutation({
    mutationFn: () =>
      browserRequests().call("POST /v1/admin/orders/{orderId}/notes", {
        path: { orderId },
        // Only people still named in the text are notified — deleting "@สมชาย" un-mentions them.
        body: {
          body: body.trim(),
          mentions: mentioned.filter((person) => body.includes(`@${person.label}`)).map((person) => person.value),
        },
      }),
    onSuccess: () => {
      setBody("");
      setMentioned([]);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(problemMessage(error, t("noteFailed"))),
  });

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>{t("notes")}</CardTitle>
      </CardHeader>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <Field label={t("newNote")} hint={t("noteHint")}>
          <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <Field label={t("mention")}>
          <Combobox
            value={picking}
            onValueChange={(person) => {
              if (!person) return setPicking(null);
              setMentioned((current) =>
                current.some((item) => item.value === person.value) ? current : [...current, person],
              );
              setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@${person.label} `);
              setPicking(null);
            }}
            query={query}
            onQueryChange={setQuery}
            loading={people.isFetching}
            options={(people.data?.data ?? []).map((person) => ({
              value: person.id,
              label: person.displayName,
              description: person.roles.map(roleLabel).join(", "),
            }))}
            placeholder={t("mentionPlaceholder")}
            labels={{ loading: tCommon("state.loading"), empty: t("noPeople"), clear: t("clearMention") }}
          />
        </Field>
        <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
          {t("addNote")}
        </Button>
      </form>
      <ul className="mt-4 space-y-3">
        {(notes.data?.data ?? []).map((note) => (
          <li key={note.id} className="border-border border-t pt-3 text-sm">
            <p className="text-muted text-xs">
              {note.author.displayName} · <When at={note.createdAt} />
            </p>
            <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
