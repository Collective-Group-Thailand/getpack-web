"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Composer } from "@/features/shared/conversations/ThreadView";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Sheet } from "@/ui/components/Sheet";

import { uploadAttachment } from "./hooks";

type Subject = { type: "support" } | { type: "order" | "design" | "rfq"; id: string; label: string };

async function open(subject: Subject, draft: { body?: string; fileIds?: string[] }) {
  const card: Schemas["ContextCardInputDto"] | undefined =
    subject.type === "support" ? undefined : { type: subject.type, id: subject.id };
  const { data } = await browserApi().POST("/v1/store/conversations", {
    params: { header: { "Idempotency-Key": newIdempotencyKey() } },
    body: {
      subjectType: subject.type,
      ...(subject.type === "support" ? {} : { subjectId: subject.id }),
      ...(draft.body ? { body: draft.body } : {}),
      ...(draft.fileIds?.length ? { fileIds: draft.fileIds } : {}),
      ...(card ? { contextCard: card } : {}),
    },
  });
  return data!.conversationId;
}

/**
 * A new message to getpack's team, inline (the messages page's support thread). Continues the live
 * thread when there is one (the API keeps one per subject, D-300).
 */
export function NewSupportMessage({ quickReplies }: { quickReplies: string[] }) {
  const t = useTranslations("account.messages");
  const router = useRouter();
  return (
    <Composer
      label={t("compose")}
      sendLabel={t("send")}
      quickReplies={quickReplies}
      upload={uploadAttachment}
      onSend={async (draft) => {
        try {
          const id = await open({ type: "support" }, draft);
          router.push(`/account/messages/${id}`);
        } catch (error) {
          throw new Error(isApiError(error) ? error.detail : "");
        }
      }}
    />
  );
}

/**
 * "Ask about this" on an order, a design or an RFQ (U5.3 §2): the question goes to that record's
 * thread with its card attached, so the team never has to ask which order it is.
 */
export function AskAbout({
  subject,
  variant = "secondary",
}: {
  subject: Exclude<Subject, { type: "support" }>;
  variant?: "secondary" | "ghost";
}) {
  const t = useTranslations("account.messages");
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" iconStart="chat" onClick={() => setOpenSheet(true)}>
        {t("askAbout")}
      </Button>
      <Sheet
        open={openSheet}
        onOpenChange={setOpenSheet}
        title={t("askTitle", { label: subject.label })}
        description={t("askBody")}
        closeLabel={t("close")}
      >
        <Composer
          label={t("compose")}
          sendLabel={t("send")}
          upload={uploadAttachment}
          onSend={async (draft) => {
            try {
              const id = await open(subject, draft);
              router.push(`/account/messages/${id}`);
            } catch (error) {
              throw new Error(isApiError(error) ? error.detail : "");
            }
          }}
        />
      </Sheet>
    </>
  );
}
