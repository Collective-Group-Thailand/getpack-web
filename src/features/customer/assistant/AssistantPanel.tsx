"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { queryKeys } from "@/lib/api/query-keys";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Textarea } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Tool = Schemas["AssistantTool"];
type Outcome = Schemas["AssistantTurnOutcome"];
type NewLine =
  | { who: "you"; text: string }
  | { who: "assistant"; text: string; outcome: Outcome; tools: Schemas["AssistantToolUseDto"][] };
type Line = NewLine & { id: number };

/** Where each tool's facts come from on the storefront — the page a customer can check them on. */
export const TOOL_SOURCE: Record<Tool, string> = {
  search_styles: "/styles",
  recommend_structure: "/products",
  get_quote: "/products",
  get_order_status: "/account/orders",
  lookup_glossary: "/help/glossary",
  search_help: "/learn",
  create_handoff: "/account/messages",
};

const UNAVAILABLE = new Set(["assistant.disabled", "assistant.not_configured"]);

/**
 * Packio Assistant (U5.5, D-304–D-306): Thai-first, labelled as AI, answering only from packio-api's
 * seven tools. Each answer names the tools it came from, each linked to the page where the same
 * facts can be checked; an answer the API blocked (`blocked_unsupported_fact`), refused or handed to
 * the team says so and offers a person. Logging can be switched off for the session (D-305).
 * Nothing here computes or states a fact of its own.
 */
export function AssistantPanel({ signedIn, signInHref }: { signedIn: boolean; signInHref: string }) {
  const t = useTranslations("assistant");
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [optOut, setOptOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const seq = useRef(0);
  const list = useRef<HTMLOListElement>(null);

  // CONTRACT-REQUEST store.assistant-availability
  const availability = useQuery({
    queryKey: queryKeys.related("customer", "assistant", "me", "availability"),
    queryFn: async () => await browserRequests().call("GET /v1/store/assistant/availability"),
    enabled: signedIn,
    retry: false,
  });

  if (!signedIn)
    return (
      <div className="flex flex-col gap-3 text-sm">
        <AiNote />
        <p>{t("signIn")}</p>
        <Button asChild className="self-start">
          <Link href={signInHref}>{t("signInAction")}</Link>
        </Button>
      </div>
    );

  const off =
    unavailable ??
    (availability.data && !availability.data.available ? (availability.data.reason ?? "disabled") : null);
  if (off)
    return (
      <div className="flex flex-col gap-3 text-sm">
        <Callout tone="info" title={t(`unavailable.${off === "rate_limited" ? "rate_limited" : "off"}`)} />
        <Button asChild variant="secondary" className="self-start" iconStart="chat">
          <Link href="/account/messages">{t("talkToTeam")}</Link>
        </Button>
      </div>
    );

  const push = (line: NewLine) => setLines((current) => [...current, { ...line, id: ++seq.current }]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setProblem(null);
    push({ who: "you", text: question });
    setText("");
    try {
      const api = browserApi();
      let id = sessionId;
      if (!id) {
        const { data } = await api.POST("/v1/store/assistant/sessions", {
          params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { loggingOptOut: optOut },
        });
        id = data!.id;
        setSessionId(id);
      }
      const { data: turn } = await api.POST("/v1/store/assistant/sessions/{sessionId}/messages", {
        params: { path: { sessionId: id }, header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { text: question },
      });
      push({ who: "assistant", text: turn!.reply, outcome: turn!.outcome, tools: turn!.tools });
      if (turn!.sessionStatus !== "open") setSessionId(null);
    } catch (error) {
      if (isApiError(error) && UNAVAILABLE.has(error.code)) setUnavailable("disabled");
      else if (isApiError(error) && error.code === "assistant.session_ended") {
        setSessionId(null);
        setProblem(t("sessionEnded"));
      } else setProblem(isApiError(error) ? error.detail : t("failed"));
      setText(question);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => list.current?.lastElementChild?.scrollIntoView({ block: "nearest" }));
    }
  }

  async function toggleLogging(next: boolean) {
    setOptOut(next);
    if (!sessionId) return;
    try {
      await browserApi().PUT("/v1/store/assistant/sessions/{sessionId}/logging", {
        params: { path: { sessionId } },
        body: { optOut: next },
      });
    } catch {
      setOptOut(!next);
      setProblem(t("failed"));
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <AiNote retentionDays={availability.data?.logRetentionDays ?? null} />
      <Switch label={t("optOut")} checked={optOut} onCheckedChange={(next) => void toggleLogging(next)} />
      <ol
        ref={list}
        className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto"
        aria-live="polite"
        aria-label={t("conversation")}
      >
        {lines.length === 0 ? <li className="text-muted">{t("empty")}</li> : null}
        {lines.map((line) =>
          line.who === "you" ? (
            <li
              key={line.id}
              className="bg-primary-subtle max-w-[85%] self-end rounded-xl px-3 py-2 whitespace-pre-line"
            >
              <span className="sr-only">{t("you")}: </span>
              {line.text}
            </li>
          ) : (
            <li key={line.id} className="bg-bg-subtle flex max-w-[90%] flex-col gap-2 self-start rounded-xl px-3 py-2">
              <span className="text-muted flex items-center gap-1 text-xs">
                <Icon name="sparkles" size={12} /> {t("assistant")}
              </span>
              <p className="whitespace-pre-line">{line.text}</p>
              {line.tools.length > 0 ? (
                <ul className="flex flex-wrap gap-1" aria-label={t("sources")}>
                  {line.tools.map((tool) => (
                    <li key={tool.name}>
                      <Link href={TOOL_SOURCE[tool.name]} className="inline-flex">
                        <Badge size="sm" tone={tool.ok ? "info" : "neutral"} icon={tool.ok ? "link" : "warning"}>
                          {t(`tools.${tool.name}`)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {line.outcome !== "answered" ? (
                <p className={cn("text-xs", line.outcome === "failed" ? "text-danger" : "text-muted")}>
                  {t(`outcomes.${line.outcome}`)}{" "}
                  <Link href="/account/messages" className="text-primary underline underline-offset-4">
                    {t("talkToTeam")}
                  </Link>
                </p>
              ) : null}
            </li>
          ),
        )}
      </ol>
      {problem ? <Callout tone="danger" title={problem} /> : null}
      <form onSubmit={(event) => void send(event)} className="flex flex-col gap-2">
        <label htmlFor="assistant-text" className="sr-only">
          {t("ask")}
        </label>
        <Textarea
          id="assistant-text"
          rows={2}
          maxLength={1000}
          value={text}
          placeholder={t("placeholder")}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Link href="/account/messages" className="text-primary text-xs underline-offset-4 hover:underline">
            {t("talkToTeam")}
          </Link>
          <Button type="submit" size="sm" iconStart="send" loading={busy} disabled={!text.trim()}>
            {t("send")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AiNote({ retentionDays = null }: { retentionDays?: number | null }) {
  const t = useTranslations("assistant");
  return (
    <div className="border-border flex flex-col gap-1 rounded-lg border p-3 text-xs">
      <p className="flex items-center gap-2 font-medium">
        <Badge size="sm" tone="info" icon="sparkles">
          {t("aiLabel")}
        </Badge>
        {t("aiTitle")}
      </p>
      <p className="text-muted">{t("aiBody")}</p>
      <p className="text-muted">
        {retentionDays !== null ? t("retention", { days: retentionDays }) : t("retentionPolicy")}
      </p>
    </div>
  );
}
