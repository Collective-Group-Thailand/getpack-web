"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { ConfirmAction, problemMessage } from "@/features/shared/actions";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import type { IconName } from "@/ui/icons";

type NextAction = Schemas["NextActionDto"];

/** One action a document offers: a link, or a confirmed call to the API. */
export interface ActionSpec {
  /** The `nextActions` key it answers to; shown only when the API offers it. */
  key: string;
  label: string;
  icon: IconName;
  variant?: "primary" | "secondary" | "destructive";
  href?: string;
  confirm?: {
    title: string;
    body: React.ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    phrase?: string;
    /** `required` asks for a reason (`ReasonDto`), `optional` for a note. */
    reason?: { label: string; required: boolean; placeholder?: string };
  };
  run?: (input: { idempotencyKey: string; reason: string }) => Promise<unknown>;
  /** The toast after it succeeded; a function reads the result (a request approved on submit). */
  done?: string | ((result: unknown) => string);
  /** Where to go after it succeeded; the page is re-read otherwise. */
  next?: (result: unknown) => string | undefined;
  /** Shown whether or not the API lists it (print, a read-only link). */
  always?: boolean;
}

/**
 * The buttons of an ERP document (E2): only the actions its `nextActions` offer (ADR-0005), each confirmed in
 * a dialog that restates what happens and carries one `Idempotency-Key`; irreversible ones ask for the
 * document number to be typed.
 */
export function ActionBar({
  actions,
  offered,
  failed,
}: {
  actions: ActionSpec[];
  offered: NextAction[];
  failed: string;
}) {
  const router = useRouter();
  const [refresh] = useRefresh();
  const [open, setOpen] = useState<string | null>(null);
  const keys = new Set(offered.filter((a) => !a.disabledReason).map((a) => a.key));
  const shown = actions.filter((a) => a.always || keys.has(a.key));
  if (!shown.length) return null;
  const current = shown.find((a) => a.key === open);

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((action) =>
        action.href ? (
          <Button key={action.key} asChild size="lg" variant={action.variant ?? "secondary"} iconStart={action.icon}>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            key={action.key}
            size="lg"
            variant={action.variant ?? "secondary"}
            iconStart={action.icon}
            onClick={() => setOpen(action.key)}
          >
            {action.label}
          </Button>
        ),
      )}
      {current?.confirm && current.run ? (
        <ConfirmAction
          open
          onOpenChange={(next) => !next && setOpen(null)}
          tone={current.confirm.destructive ? "destructive" : "primary"}
          title={current.confirm.title}
          description={current.confirm.body}
          confirmLabel={current.confirm.confirmLabel}
          {...(current.confirm.phrase ? { confirmationPhrase: current.confirm.phrase } : {})}
          {...(current.confirm.reason
            ? {
                reason: {
                  label: current.confirm.reason.label,
                  required: current.confirm.reason.required,
                  ...(current.confirm.reason.required ? { minLength: 3 } : {}),
                  ...(current.confirm.reason.placeholder ? { placeholder: current.confirm.reason.placeholder } : {}),
                },
              }
            : {})}
          onConfirm={async (input) => {
            try {
              const result = await current.run!(input);
              if (current.done) toast.success(typeof current.done === "function" ? current.done(result) : current.done);
              setOpen(null);
              const target = current.next?.(result);
              if (target) router.push(target);
              refresh();
            } catch (error) {
              toast.error(problemMessage(error, failed));
              throw error;
            }
          }}
        />
      ) : null}
    </div>
  );
}
