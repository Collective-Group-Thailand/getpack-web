"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { nextActionMeta } from "@/domain/status";
import { useRefresh } from "@/features/partner/client";
import { useFactory } from "@/features/partner/context/FactoryProvider";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";

import { erpDelete, erpPost, openPdf } from "./api";

type NextAction = Schemas["NextActionDto"];

/** What one offered action does on this screen. */
export type SalesAction =
  | { key: string; kind: "link"; href: string; primary?: boolean }
  | { key: string; kind: "pdf"; path: string; params: Record<string, string> }
  | {
      key: string;
      kind: "post" | "delete";
      path: string;
      params: Record<string, string>;
      /** The body; the typed reason is passed in when `reason` asks for one. */
      body?: (reason: string) => unknown;
      title: string;
      description: React.ReactNode;
      confirmLabel?: string;
      /** Irreversible: retype this (the document number). */
      phrase?: string | null;
      reason?: { label: string; placeholder?: string; required?: boolean };
      ifMatch?: boolean;
      done: string | ((result: unknown) => string);
      next?: (result: unknown) => string | undefined;
      primary?: boolean;
    }
  | { key: string; kind: "dialog"; open: () => void; primary?: boolean };

/**
 * The buttons of an E4 document: only what its `nextActions` offer (ADR-0005), labelled from the shared action
 * vocabulary, each consequential one confirmed with the document restated and one `Idempotency-Key`; an action
 * the API offers but blocks shows its reason instead.
 */
export function SalesActions({
  offered,
  actions,
  etag,
  layout = "row",
}: {
  offered: NextAction[];
  actions: SalesAction[];
  etag?: string | null;
  /**
   * `panel`: a document page's sticky action panel — one full-width stack, the first primary action filled and the
   * rest outlined, anything destructive last (ERP group redesign). `row` (default): buttons side by side.
   */
  layout?: "row" | "panel";
}) {
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("partnerSales.common");
  const { factoryId } = useFactory();
  const router = useRouter();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const byKey = new Map(offered.map((a) => [a.key, a]));
  const shown = actions.filter((a) => byKey.has(a.key));
  const blocked = shown.filter((a) => byKey.get(a.key)?.disabledReason);
  const offeredLive = shown.filter((a) => !byKey.get(a.key)?.disabledReason);
  const isDanger = (a: SalesAction) => nextActionMeta(a.key).tone === "danger";
  const isPrimary = (a: SalesAction) => "primary" in a && Boolean(a.primary);
  const firstPrimary = offeredLive.find((a) => !isDanger(a) && isPrimary(a))?.key;
  const live =
    layout === "panel"
      ? [
          ...offeredLive.filter((a) => a.key === firstPrimary),
          ...offeredLive.filter((a) => a.key !== firstPrimary && !isDanger(a)),
          ...offeredLive.filter(isDanger),
        ]
      : offeredLive;
  if (!shown.length) return null;
  const label = (key: string) => tStatus(nextActionMeta(key).labelKey as never);
  const current = live.find((a) => a.key === open);

  return (
    <div className="flex flex-col gap-2">
      <div
        {...(layout === "panel" ? { "data-fill": "row" } : {})}
        className={layout === "panel" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}
      >
        {live.map((action) => {
          const meta = nextActionMeta(action.key);
          const destructive = meta.tone === "danger";
          const primary = isPrimary(action) && (layout === "row" || action.key === firstPrimary);
          const variant = destructive ? "destructive" : primary ? "primary" : "secondary";
          if (action.kind === "link")
            return (
              <Button key={action.key} asChild size="lg" variant={variant} iconStart={meta.icon}>
                <Link href={action.href}>{label(action.key)}</Link>
              </Button>
            );
          if (action.kind === "pdf")
            return (
              <Button
                key={action.key}
                size="lg"
                variant="secondary"
                iconStart={meta.icon}
                loading={pdfBusy}
                onClick={async () => {
                  setPdfBusy(true);
                  try {
                    await openPdf(factoryId, action.path, action.params);
                  } catch (error) {
                    toast.error(problemMessage(error, tCommon("failed")));
                  } finally {
                    setPdfBusy(false);
                  }
                }}
              >
                {label(action.key)}
              </Button>
            );
          return (
            <Button
              key={action.key}
              size="lg"
              variant={variant}
              iconStart={meta.icon}
              onClick={() => (action.kind === "dialog" ? action.open() : setOpen(action.key))}
            >
              {label(action.key)}
            </Button>
          );
        })}
      </div>
      {blocked.map((action) => (
        <p key={action.key} className="text-muted text-sm">
          {tCommon("blocked", { action: label(action.key), reason: byKey.get(action.key)?.disabledReason ?? "" })}
        </p>
      ))}
      {current && (current.kind === "post" || current.kind === "delete") ? (
        <ConfirmAction
          open
          onOpenChange={(next) => !next && setOpen(null)}
          tone={nextActionMeta(current.key).tone === "danger" ? "destructive" : "primary"}
          title={current.title}
          description={current.description}
          confirmLabel={current.confirmLabel ?? label(current.key)}
          {...(current.phrase ? { confirmationPhrase: current.phrase } : {})}
          {...(current.reason
            ? {
                reason: {
                  label: current.reason.label,
                  required: current.reason.required ?? true,
                  ...((current.reason.required ?? true) ? { minLength: 3 } : {}),
                  ...(current.reason.placeholder ? { placeholder: current.reason.placeholder } : {}),
                },
              }
            : {})}
          onConfirm={async ({ idempotencyKey, reason }) => {
            try {
              const result =
                current.kind === "delete"
                  ? await erpDelete(factoryId, current.path, current.params)
                  : await erpPost(factoryId, current.path, current.params, current.body?.(reason.trim()), {
                      idempotencyKey,
                      ...(current.ifMatch ? { etag: etag ?? null } : {}),
                    });
              toast.success(typeof current.done === "function" ? current.done(result) : current.done);
              setOpen(null);
              const target = current.next?.(result);
              if (target) router.push(target);
              else refresh();
            } catch (error) {
              toast.error(problemMessage(error, tCommon("failed")));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
