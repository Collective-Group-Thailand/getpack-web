"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FileLink } from "@/features/customer/files/FileLink";
import { Composer, ThreadView } from "@/features/shared/conversations/ThreadView";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

import { uploadAttachment, usePostMessage, useThreadMessages } from "./hooks";
import { storeCardHref } from "./paths";

/**
 * One of my conversations with Packio (U5.3, D-300): the messages, a reply box with photos and
 * files, the quick asks people make most, and where Packio's answers go — here, or my LINE when it
 * is linked. Packio's staff appear as the team; a message of mine says when Packio has read it.
 */
export function ConversationPanel({
  thread,
  quickReplies,
}: {
  thread: Schemas["StoreThreadDto"];
  quickReplies: string[];
}) {
  const t = useTranslations("account.messages");
  const tc = useTranslations("common.conversation");
  const messages = useThreadMessages(thread.id);
  const post = usePostMessage(thread.id);
  const [channel, setChannel] = useState(thread.replyChannel);

  async function chooseChannel(next: Schemas["ReplyChannel"]) {
    const before = channel;
    setChannel(next);
    try {
      await browserApi().PUT("/v1/store/conversations/{conversationId}/reply-channel", {
        params: { path: { conversationId: thread.id } },
        body: { replyChannel: next },
      });
    } catch (error) {
      setChannel(before);
      toast.error(isApiError(error) ? error.detail : t("channelFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div aria-busy={messages.isPending} aria-live="polite" className="min-h-40">
        {messages.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-3/5" />
            <Skeleton className="h-12 w-2/5 self-end" />
            <Skeleton className="h-16 w-1/2" />
          </div>
        ) : messages.isError ? (
          <Callout tone="danger" title={t("loadFailed")} />
        ) : (
          <ThreadView
            messages={messages.data ?? []}
            perspective="customer"
            cardHref={storeCardHref}
            renderFile={(file) => (
              <FileLink
                fileId={file.id}
                label={file.name}
                openLabel={tc("open", { name: file.name })}
                failed={tc("uploadFailed")}
              />
            )}
          />
        )}
      </div>
      {thread.status === "closed" ? <p className="text-muted text-sm">{t("closedNote")}</p> : null}
      <Composer
        label={t("compose")}
        sendLabel={t("send")}
        quickReplies={quickReplies}
        upload={uploadAttachment}
        onSend={async (draft) => {
          try {
            await post(draft);
          } catch (error) {
            throw new Error(isApiError(error) ? error.detail : "");
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted text-sm" aria-hidden>
          {t("replyChannel")}
        </span>
        <SegmentedControl
          label={t("replyChannel")}
          value={channel}
          onValueChange={(value) => void chooseChannel(value as Schemas["ReplyChannel"])}
          options={(["web", "line"] as const).map((value) => ({ value, label: t(`channels.${value}`) }))}
        />
      </div>
    </div>
  );
}
