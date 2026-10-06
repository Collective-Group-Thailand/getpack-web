"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat, When } from "@/features/shared/format";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/defaults";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import type { ProgressState } from "@/ui/components/ProgressTracker";
import { Timeline } from "@/ui/components/Timeline";
import { toast } from "@/ui/components/Toast";
import type { IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { adminBrowserApis, problemMessage, useRoleLabel, useStaffDirectory } from "../console";
import { StageList } from "../console/StageList";

type Entry = Schemas["StaffTimelineEntryDto"];
type Order = Schemas["AdminOrderDto"];

/** The timeline types the desk has words for (`orders.rail.types`). */
const KNOWN_TYPES = new Set([
  "order.placed",
  "order.cancelled",
  "order.note_added",
  "payment.received",
  "payment.reminder_sent",
  "slip.uploaded",
  "slip.uploaded_by_cs",
  "slip.approved",
  "slip.rejected",
  "artwork.submitted",
  "proof.sent",
  "proof.approved",
  "proof.changes_requested",
  "production.started_manually",
  "shipment.picked_up",
  "shipment.in_transit",
  "shipment.delivered",
]);

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
 * with promised against actual for production steps (`promisedAt`, v0.5.0) — and the team's
 * internal notes.
 */
export function OrderRail({ order }: { order: Order }) {
  return (
    // Sticky beside the tabs on a wide screen (UX audit, order detail: "rail sticky").
    <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
      <OrderStages order={order} />
      <DueCard order={order} />
      <Notes orderId={order.id} />
      <OrderTimeline orderId={order.id} />
    </div>
  );
}

type Stage = "ordered" | "paid" | "artwork" | "production" | "shipping";
const STAGES: Stage[] = ["ordered", "paid", "artwork", "production", "shipping"];

/**
 * Where the order is, in five stages (UX audit: "ไทม์ไลน์สถานะ 5 ขั้น"), read off the order's own
 * status and artwork status — facts the API keeps (B3.1), not a status of the desk's.
 */
function stageStates(order: Order): Record<Stage, ProgressState> {
  const paid = order.status !== "waiting_payment";
  const artworkDone = order.artworkStatus === "approved";
  const produced = order.status === "shipping" || order.status === "completed";
  const state = (done: boolean, current: boolean): ProgressState => (done ? "done" : current ? "current" : "upcoming");
  if (order.status === "cancelled") {
    return { ordered: "done", paid: "skipped", artwork: "skipped", production: "skipped", shipping: "skipped" };
  }
  return {
    ordered: "done",
    paid: state(paid, !paid),
    artwork: state(artworkDone, paid && !artworkDone),
    production: state(produced, order.status === "in_production"),
    shipping: state(order.status === "completed", order.status === "shipping"),
  };
}

function OrderStages({ order }: { order: Order }) {
  const t = useTranslations("orders.rail");
  const states = stageStates(order);
  return (
    <StageList
      title={t("stagesTitle")}
      stages={STAGES.map((stage) => ({ key: stage, label: t(`stages.${stage}`), state: states[stage] }))}
      stateLabels={{
        done: t("stageStates.done"),
        current: t("stageStates.current"),
        upcoming: t("stageStates.upcoming"),
        skipped: t("stageStates.skipped"),
      }}
    />
  );
}

/** The promised ship date, and the estimated delivery when the API has one. */
function DueCard({ order }: { order: Order }) {
  const t = useTranslations("orders.rail");
  const format = useFormat();
  if (!order.promisedShipDate && !order.estimatedDeliveryDate) return null;
  return (
    <Card padding="md">
      <p className="text-muted text-sm">{t("dueTitle")}</p>
      <p className="mt-1 text-2xl font-bold">{format.date(order.promisedShipDate ?? order.estimatedDeliveryDate)}</p>
      {order.estimatedDeliveryDate && order.promisedShipDate ? (
        <p className="text-muted mt-1 text-sm">{t("deliveryBy", { date: format.date(order.estimatedDeliveryDate) })}</p>
      ) : null}
    </Card>
  );
}

/**
 * An entry's title. The API sends what happened (`type`) and an i18n key with params for the client
 * to render; a production milestone names itself (`labelTh`/`labelEn`), the rest are the desk's
 * words per type. CONTRACT-GAP admin.orders — the contract does not list its keys, so a type the
 * desk has no words for shows its note, or "updated".
 */
function useEntryTitle() {
  const t = useTranslations("orders.rail.types");
  const locale = useLocale();
  return (entry: Entry) => {
    const params = entry.params as { labelTh?: unknown; labelEn?: unknown };
    if (entry.type === "production.milestone_reached" && typeof params.labelTh === "string") {
      const label = locale === "en" && typeof params.labelEn === "string" ? params.labelEn : params.labelTh;
      return t("production_milestone", { stage: label });
    }
    return KNOWN_TYPES.has(entry.type) ? t(entry.type.replace(".", "_")) : t("other");
  };
}

function OrderTimeline({ orderId }: { orderId: string }) {
  const t = useTranslations("orders.rail");
  const format = useFormat();
  const title = useEntryTitle();
  const feed = useInfiniteQuery({
    queryKey: queryKeys.related("admin", "order", orderId, "timeline"),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/timeline", {
          params: { path: { orderId }, query: { cursor: pageParam, limit: 30 } },
        })
      ).data!,
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
        items={entries.map((entry) => ({
          id: entry.id,
          title: (
            <span className="flex flex-wrap items-center gap-1">
              {title(entry)}
              {entry.visibility.includes("internal") && !entry.visibility.includes("customer") ? (
                <Badge size="sm">{t("internal")}</Badge>
              ) : null}
            </span>
          ),
          time: <When at={entry.occurredAt} />,
          actor: entry.actor?.displayName ?? undefined,
          icon: KIND_ICONS[entry.type.split(".")[0] ?? ""] ?? "circle",
          tone: entry.type.endsWith("rejected") || entry.type.endsWith("cancelled") ? "danger" : undefined,
          // A production step says when the factory's plan had it due: promised against actual (D-075).
          description:
            entry.body || entry.promisedAt ? (
              <>
                {entry.body ? <span className="block">{entry.body}</span> : null}
                {entry.promisedAt ? (
                  <span
                    className={cn(
                      "block text-xs",
                      Date.parse(entry.occurredAt) > Date.parse(entry.promisedAt) ? "text-danger" : "text-muted",
                    )}
                  >
                    {t(
                      Date.parse(entry.occurredAt) > Date.parse(entry.promisedAt) ? "promisedLate" : "promisedOnTime",
                      {
                        at: format.dateTime(entry.promisedAt),
                      },
                    )}
                  </span>
                ) : null}
              </>
            ) : undefined,
        }))}
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
    queryFn: async () =>
      (
        await adminBrowserApis().contract.GET("/v1/admin/orders/{orderId}/notes", {
          params: { path: { orderId }, query: { perPage: 100 } },
        })
      ).data!,
  });
  const people = useStaffDirectory({ q: query, limit: 10 });

  const add = useMutation({
    mutationFn: async () =>
      (
        await adminBrowserApis().contract.POST("/v1/admin/orders/{orderId}/notes", {
          params: { path: { orderId } },
          // Only people still named in the text are notified — deleting "@สมชาย" un-mentions them.
          body: {
            body: body.trim(),
            mentions: mentioned.filter((person) => body.includes(`@${person.label}`)).map((person) => person.value),
          },
        })
      ).data!,
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
            options={(people.data ?? []).map((person) => ({
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
