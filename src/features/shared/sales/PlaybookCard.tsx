"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { lineShareUrl } from "./line";
import { parseBlocks, type Inline } from "./markdown";
import { useMinWidth } from "./useMinWidth";

type Card = Schemas["AgentPlaybookCardDto"];

function Text({ inline }: { inline: Inline }) {
  return (
    <>
      {inline.map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-semibold">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** A card's body, from the API's Markdown into elements (`./markdown.ts`). */
export function PlaybookBody({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
      {parseBlocks(markdown).map((block, index) => {
        if (block.kind === "paragraph")
          return (
            <p key={index} className="text-pretty">
              <Text inline={block.inline} />
            </p>
          );
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className={cn("flex flex-col gap-1 ps-5", block.ordered ? "list-decimal" : "list-disc")}>
              {block.items.map((item, at) => (
                <li key={at}>
                  <Text inline={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <div
            key={index}
            className="border-border overflow-x-auto rounded-lg border"
            tabIndex={0}
            role="region"
            aria-label={block.header.map((cell) => cell.map((part) => part.text).join("")).join(" · ")}
          >
            <table className="w-full min-w-[20rem] text-sm">
              <thead className="bg-surface-subtle text-muted text-xs">
                <tr>
                  {block.header.map((cell, at) => (
                    <th key={at} scope="col" className="px-3 py-2 text-start font-medium">
                      <Text inline={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, at) => (
                  <tr key={at} className="border-border border-t align-top">
                    {row.map((cell, col) => (
                      <td key={col} className="px-3 py-2">
                        <Text inline={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A playbook card (D-468 §5): title, body, and the suggested replies — each one copied, or sent straight to LINE to
 * pick the chat. English falls back to Thai until Marketing writes it. Read-only for agents.
 */
export function PlaybookCard({
  card,
  compact = false,
  headingLevel = 3,
  className,
}: {
  card: Card;
  /** Collapsed to its title until opened: always (`true`), or only below 1024 px (`"phone"`, beside a form). */
  compact?: boolean | "phone";
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations("agentSales.playbook");
  const locale = useLocale();
  const english = locale === "en";
  const title = (english && card.titleEn) || card.titleTh;
  const body = (english && card.bodyEn) || card.bodyTh;
  const wide = useMinWidth(1024);
  const collapsible = compact === true || (compact === "phone" && !wide);
  const [userOpen, setUserOpen] = useState(false);
  const open = !collapsible || userOpen;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const id = `card-${card.id}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <article
      aria-labelledby={id}
      className={cn("border-border bg-surface rounded-card flex flex-col gap-3 border p-4 sm:p-5", className)}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary-subtle text-primary grid size-9 shrink-0 place-items-center rounded-lg">
          <Icon name="article" size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Heading id={id} className="text-base leading-snug font-semibold text-balance">
            {title}
          </Heading>
        </div>
        {collapsible ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            className="min-h-11 sm:min-h-8"
            onClick={() => setUserOpen((value) => !value)}
          >
            {open ? t("hide") : t("show")}
          </Button>
        ) : null}
      </div>
      <div id={`${id}-body`} hidden={!open} className="flex flex-col gap-4">
        <PlaybookBody markdown={body} />
        {card.suggestedReplies.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{t("replies")}</p>
            <ul className="flex flex-col gap-2">
              {card.suggestedReplies.map((reply, index) => {
                const text = (english && reply.en) || reply.th;
                return (
                  <li key={index} className="bg-surface-subtle flex flex-col gap-2 rounded-lg p-3">
                    <p className="text-[0.9375rem] text-pretty">{t("quoted", { text })}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        iconStart="copy"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => void copy(text)}
                      >
                        {t("copy")}
                      </Button>
                      <Button asChild size="sm" variant="secondary" iconStart="chat" className="min-h-11 sm:min-h-8">
                        <a href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer">
                          {t("sendLine")}
                        </a>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
