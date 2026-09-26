"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

type Message = ResponseOf<Requests, "GET /v1/store/rfqs/{rfqId}/messages">["data"][number];

/**
 * The conversation with CS about one RFQ. Staff appear as the team, never by name; an answer to a
 * request for information puts the RFQ back in front of CS (B2.5). The draft survives a failure.
 */
export function RfqThread({
  rfqId,
  messages,
  askedForInfo,
}: {
  rfqId: string;
  messages: Message[];
  askedForInfo: boolean;
}) {
  const t = useTranslations("quoteRequests.thread");
  const format = useFormat();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await browserRequests().call("POST /v1/store/rfqs/{rfqId}/messages", {
        path: { rfqId },
        body: { body: body.trim() },
      });
      setBody("");
      router.refresh();
    } catch (failure) {
      setError(isApiError(failure) ? failure.detail : t("failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {askedForInfo ? <Callout tone="warning">{t("askedForInfo")}</Callout> : null}
      {messages.length === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-3 text-sm",
                message.authorKind === "customer" ? "bg-primary-subtle self-end" : "bg-bg-subtle self-start",
              )}
            >
              <p className="text-muted text-xs">
                {message.authorName} · {format.dateTime(message.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-line">{message.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(event) => void send(event)} className="flex flex-col gap-2">
        <Field label={t("reply")} error={error ?? undefined}>
          <Textarea rows={3} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <Button type="submit" className="self-end" loading={sending} disabled={!body.trim()} iconStart="send">
          {t("send")}
        </Button>
      </form>
    </div>
  );
}
