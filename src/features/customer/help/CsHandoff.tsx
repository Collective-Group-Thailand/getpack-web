"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { usePathname } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { PhoneInput } from "@/ui/components/PhoneInput";

type Ticket = Schemas["SupportTicketDto"];

export interface CsHandoffProps {
  /** A signed-in customer is reached through the account; a guest leaves a name and a phone. */
  signedIn: boolean;
  headingLevel?: "h2" | "h3";
  /** What the customer already said, carried to CS so nobody asks twice (D-221). */
  context?: Pick<Schemas["SupportHandoffDto"], "answers" | "recommended" | "note">;
}

/**
 * Hand the conversation to a person (`store.support.handoff`, D-221): chat in LINE, or a call
 * back. The ticket carries the page the customer was on — and, from guided help, what they
 * answered — so the team starts where the customer is. The reply target is the API's
 * (`respondBy`, on the business calendar), never a promise made here.
 */
export function CsHandoff({ signedIn, headingLevel = "h2", context }: CsHandoffProps) {
  const t = useTranslations("help.guided");
  const format = useFormat();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"line" | "callback" | null>(null);
  const key = useRef(newIdempotencyKey());
  const Heading = headingLevel;

  async function handoff(channel: "line" | "callback") {
    if (!signedIn && !name.trim()) {
      setFailure(t("nameNeeded"));
      return;
    }
    if ((channel === "callback" || !signedIn) && !/^0\d{8,9}$/.test(phone)) {
      setFailure(t("phoneNeeded"));
      return;
    }
    setBusy(channel);
    setFailure(null);
    try {
      const { data: created } = await browserApi().POST("/v1/store/support/actions/handoff", {
        params: { header: { "Idempotency-Key": key.current } },
        body: {
          page: pathname,
          callback: channel === "callback",
          ...(signedIn ? {} : { contact: { name: name.trim(), phone } }),
          ...context,
        },
      });
      key.current = newIdempotencyKey();
      setTicket(created!);
      if (channel === "line" && created!.lineUrl) window.open(created!.lineUrl, "_blank", "noopener");
    } catch (error) {
      key.current = newIdempotencyKey();
      setFailure(
        isApiError(error) && error.status === 429 ? t("rateLimited") : isApiError(error) ? error.detail : t("failed"),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="guided-handoff" className="bg-surface-subtle flex flex-col gap-3 rounded-xl p-4">
      <Heading id="guided-handoff" className="font-semibold">
        {t("handoffTitle")}
      </Heading>
      <p className="text-muted text-sm">{context ? t("handoffBody") : t("handoffPageBody")}</p>
      {failure ? (
        <Callout tone="danger" role="alert">
          {failure}
        </Callout>
      ) : null}
      {ticket ? (
        <Callout tone="success" role="status" title={t("handedOff", { ticket: ticket.ticketNo })}>
          {ticket.lineUrl ? (
            <a href={ticket.lineUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {t("openLine")}
            </a>
          ) : (
            t("replyBy", { date: format.dateTime(ticket.respondBy) })
          )}
        </Callout>
      ) : (
        <>
          {!signedIn ? (
            <Field label={t("name")}>
              <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <Field label={signedIn ? t("phone") : t("guestPhone")} className="min-w-48 flex-1">
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
            <Button
              variant="secondary"
              iconStart="phone"
              loading={busy === "callback"}
              onClick={() => void handoff("callback")}
            >
              {t("callback")}
            </Button>
          </div>
          <Button
            variant="secondary"
            iconStart="chat"
            className="self-start"
            loading={busy === "line"}
            onClick={() => void handoff("line")}
          >
            {t("line")}
          </Button>
        </>
      )}
    </section>
  );
}
