"use client";

import { useTranslations } from "next-intl";

import { nextActionMeta, primaryAction, type NextAction } from "@/domain/status";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { Tooltip } from "@/ui/components/Tooltip";

/** `order.approve_slip` → `approve_slip`. */
export const actionVerb = (key: string) => key.slice(key.lastIndexOf(".") + 1);

export interface NextActionBarProps {
  /** Exactly what the API offered (`nextActions`), in the API's order. */
  actions: readonly NextAction[];
  /** The verbs this screen can perform; any other offered action shows disabled, never vanishes. */
  supported: ReadonlySet<string>;
  /** A screen's own label for a verb, when it has one; otherwise the shared `status.action.*` label. */
  labelOf?: (verb: string) => string | undefined;
  onAction: (verb: string) => void;
}

/**
 * An entity's actions as the API offered them (ADR-0005): the first unblocked one leads
 * (design-system.md §4 "the single next best action") unless it is destructive and another is
 * open, the rest sit behind "more", and a blocked one says why (its `disabledReason`, in this
 * app's words when the problem code has them). An action key this version cannot perform is shown disabled rather than
 * hidden, so a new backend capability is visible, not lost.
 */
export function NextActionBar({ actions, supported, labelOf, onAction }: NextActionBarProps) {
  const t = useTranslations("status");
  const tConsole = useTranslations("console.actions");
  const tProblems = useTranslations("problems");
  // `disabledReason` is a message key from the API (a problem code): this app's words for it when
  // it has them, else the key as given.
  const reasonOf = (action: NextAction) =>
    action.disabledReason
      ? tProblems.has(action.disabledReason)
        ? tProblems(action.disabledReason)
        : action.disabledReason
      : null;
  // The lead is one this screen can perform (an offered verb it has no flow for stays in "more"),
  // in the API's order — but a destructive action (cancel, void) never leads while a constructive
  // one is open: it sits behind "more", one deliberate step away.
  const performable = actions.filter((action) => supported.has(actionVerb(action.key)));
  // A destructive action never leads, even alone (UX audit, order detail: cancel lives in "⋯").
  const constructive = performable.filter((action) => nextActionMeta(action.key).tone !== "danger");
  const lead = constructive.find((action) => !action.disabledReason) ?? primaryAction(constructive) ?? undefined;
  const rest = actions.filter((action) => action !== lead);

  const label = (action: NextAction) => labelOf?.(actionVerb(action.key)) ?? t(nextActionMeta(action.key).labelKey);
  const run = (action: NextAction) => {
    const verb = actionVerb(action.key);
    if (supported.has(verb)) onAction(verb);
  };

  if (actions.length === 0) return null;

  return (
    <>
      {rest.length > 0 ? (
        <DropdownMenu
          label={tConsole("more")}
          align="end"
          items={rest.map((action) => ({
            id: action.key,
            label: label(action),
            description:
              reasonOf(action) ?? (supported.has(actionVerb(action.key)) ? undefined : tConsole("unsupported")),
            icon: nextActionMeta(action.key).icon,
            tone: nextActionMeta(action.key).tone === "danger" ? "destructive" : "default",
            disabled: Boolean(action.disabledReason) || !supported.has(actionVerb(action.key)),
            onSelect: () => run(action),
          }))}
          // "⋯" (UX audit): the other actions, cancel among them, one deliberate step away.
          trigger={<IconButton name="more" variant="secondary" label={tConsole("more")} />}
        />
      ) : null}
      {lead ? (
        lead.disabledReason ? (
          <Tooltip content={reasonOf(lead)}>
            <span tabIndex={0}>
              <Button disabled iconStart={nextActionMeta(lead.key).icon}>
                {label(lead)}
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button
            iconStart={nextActionMeta(lead.key).icon}
            variant={nextActionMeta(lead.key).tone === "danger" ? "destructive" : "primary"}
            onClick={() => run(lead)}
          >
            {label(lead)}
          </Button>
        )
      ) : null}
    </>
  );
}
