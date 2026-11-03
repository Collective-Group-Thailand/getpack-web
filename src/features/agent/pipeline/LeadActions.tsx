"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { lineShareUrl } from "@/features/agent/share/line";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { MobileActionBar } from "@/ui/components/MobileActionBar";
import { RadioCards } from "@/ui/components/RadioCards";
import { toast } from "@/ui/components/Toast";
import { Icon, type IconName } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { fromLocalInput, quickFollowUp, toLocalInput } from "./dates";
import { toLocalPhone } from "./phone";
import { useProblemText } from "./problem";

type Lead = Schemas["AgentLeadDto"];
type EntryKind = Schemas["AgentLeadActivityEntryKind"];
const KINDS: readonly { kind: EntryKind; icon: IconName }[] = [
  { kind: "call", icon: "phone" },
  { kind: "line", icon: "line" },
  { kind: "visit", icon: "map-pin" },
  { kind: "email", icon: "mail" },
  { kind: "note", icon: "edit" },
];

/** LINE: the contact's own LINE id opens their profile; without one, a message to pick a chat for. */
export function lineHref(lead: Pick<Lead, "lineId" | "contactName">, greeting: string): string {
  const id = lead.lineId?.trim().replace(/^@?/, "");
  return id ? `https://line.me/R/ti/p/~${encodeURIComponent(id)}` : lineShareUrl(greeting);
}

/**
 * A lead's actions (PROMPT P3 Web 3): โทร (`tel:`) · LINE (deep link) · ส่งใบเสนอราคา · บันทึกการติดต่อ. On a phone a sticky
 * bar above the tab bar, every action an icon over a label (≥ 56 px tall); from 640 px a row of buttons in the header.
 * A closed lead keeps the call and LINE only.
 */
export function LeadActionBar({ lead, closed }: { lead: Lead; closed: boolean }) {
  const t = useTranslations("agentSales.lead");
  const [log, setLog] = useState(false);
  const tel = lead.phone ? `tel:${toLocalPhone(lead.phone)}` : null;
  const line = lineHref(lead, t("lineGreeting", { name: lead.contactName }));
  const quoteHref = `/quotes/new?leadId=${lead.id}`;

  const phoneAction = (props: { icon: IconName; label: string; href?: string | null; onClick?: () => void; external?: boolean }) => {
    const body = (
      <>
        <Icon name={props.icon} size={20} aria-hidden="true" />
        <span className="text-xs leading-tight font-medium">{props.label}</span>
      </>
    );
    const className =
      "focus-visible:ring-focus-ring active:bg-bg-subtle flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center outline-none transition-colors duration-100 focus-visible:ring-2 aria-disabled:opacity-40";
    if (props.onClick)
      return (
        <button type="button" onClick={props.onClick} className={className}>
          {body}
        </button>
      );
    if (!props.href)
      return (
        <span aria-disabled="true" className={className}>
          {body}
        </span>
      );
    return props.external ? (
      <a href={props.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    ) : props.href.startsWith("tel:") ? (
      <a href={props.href} className={className}>
        {body}
      </a>
    ) : (
      <Link href={props.href} className={className}>
        {body}
      </Link>
    );
  };

  return (
    <>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {tel ? (
          <Button asChild variant="secondary" iconStart="phone">
            <a href={tel}>{t("call")}</a>
          </Button>
        ) : null}
        <Button asChild variant="secondary" iconStart="line">
          <a href={line} target="_blank" rel="noopener noreferrer">
            {t("line")}
          </a>
        </Button>
        {closed ? null : (
          <>
            <Button variant="secondary" iconStart="edit" onClick={() => setLog(true)}>
              {t("log")}
            </Button>
            <Button asChild iconStart="send">
              <Link href={quoteHref}>{t("sendQuote")}</Link>
            </Button>
          </>
        )}
      </div>
      <MobileActionBar className={cn("grid gap-1 px-2 py-1.5 pe-[max(0.5rem,env(safe-area-inset-right))] ps-[max(0.5rem,env(safe-area-inset-left))] sm:hidden", closed ? "grid-cols-2" : "grid-cols-4")}>
        {phoneAction({ icon: "phone", label: t("call"), href: tel })}
        {phoneAction({ icon: "line", label: t("line"), href: line, external: true })}
        {closed ? null : phoneAction({ icon: "send", label: t("sendQuoteShort"), href: quoteHref })}
        {closed ? null : phoneAction({ icon: "edit", label: t("logShort"), onClick: () => setLog(true) })}
      </MobileActionBar>
      <LogActivity open={log} onOpenChange={setLog} lead={lead} />
    </>
  );
}

/**
 * "บันทึกการติดต่อ" (`store.agentLeads.addActivity`): how they talked, what was said, and optionally when to follow up
 * next. The first entry moves a new lead to ติดต่อแล้ว (the API does it).
 */
export function LogActivity({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead }) {
  const t = useTranslations("agentSales.log");
  const tCommon = useTranslations("common");
  const problemText = useProblemText();
  const router = useRouter();
  const [kind, setKind] = useState<EntryKind>("call");
  const [body, setBody] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!body.trim()) return setError(t("bodyRequired"));
    setBusy(true);
    setError(null);
    try {
      await browserApi().POST("/v1/store/agent/leads/{leadId}/activities", {
        params: { path: { leadId: lead.id } },
        body: { kind, body: body.trim(), ...(next ? { nextFollowUpAt: fromLocalInput(next) } : {}) },
      });
      toast.success(t("saved"));
      setBody("");
      setNext("");
      onOpenChange(false);
      router.refresh();
    } catch (failure) {
      setError(problemText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !busy && onOpenChange(value)}
      title={t("title", { name: lead.contactName })}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {tCommon("actions.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("kind")}>
          <RadioCards
            columns={3}
            value={kind}
            onValueChange={setKind}
            options={KINDS.map((item) => ({
              value: item.kind,
              label: (
                <span className="inline-flex items-center gap-2">
                  <Icon name={item.icon} size={16} aria-hidden="true" />
                  {t(`kinds.${item.kind}`)}
                </span>
              ),
            }))}
          />
        </Field>
        <Field label={t("body")} required error={error && !body.trim() ? error : undefined}>
          <Textarea rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("bodyExample")} />
        </Field>
        <Field label={t("next")} hint={t("nextHint")}>
          <Input type="datetime-local" value={next} onChange={(event) => setNext(event.target.value)} className="min-h-11 sm:min-h-0" />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2">
          {(["tomorrow", "threeDays", "week"] as const).map((choice) => (
            <Button key={choice} size="sm" variant="secondary" className="min-h-11 sm:min-h-8" onClick={() => setNext(toLocalInput(quickFollowUp(choice)))}>
              {t(`quick.${choice}`)}
            </Button>
          ))}
        </div>
        {error && body.trim() ? <Callout tone="danger" title={error} live /> : null}
      </div>
    </Dialog>
  );
}
