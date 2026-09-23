"use client";

import { useId, useState } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "../lib/cn";
import { Button } from "./Button";
import { controlVariants } from "./Input";

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is about to happen, in the user's words. */
  title: React.ReactNode;
  /**
   * The consequence, restating the target — order code and amount for anything financial
   * (00-master-plan.md §8). This is the sentence that stops the wrong click.
   */
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** `destructive` for anything that deletes, cancels, refunds or pays. */
  tone?: "primary" | "destructive";
  loading?: boolean;
  /**
   * Turns this into a **typed confirmation**: the user retypes this exact string — an order
   * code, a factory name — before the action unlocks. Required by 00-master-plan.md §8 for
   * irreversible actions: approve slip, manual start production, cancel, refund, credit
   * note, payout approval, bank-account change, period close, checkout pay.
   */
  confirmationPhrase?: string;
  /** Label for the typed-confirmation input, from `src/i18n` (it names the phrase to type). */
  confirmationLabel?: string;
  children?: React.ReactNode;
}

/**
 * A confirmation the user cannot dismiss by accident: no scrim close, no Escape-to-confirm,
 * focus starts on Cancel, and the destructive action is never the default focus.
 */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "primary",
  loading = false,
  confirmationPhrase,
  confirmationLabel,
  children,
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <AlertDialogPrimitive.Content
          className={cn(
            "z-modal fixed top-1/2 left-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "border-border bg-surface-raised rounded-2xl border p-5 shadow-xl",
          )}
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted mt-2 text-sm">
            {description}
          </AlertDialogPrimitive.Description>

          {children}

          {/*
            Radix unmounts Content when the dialog closes, so the typed confirmation lives in
            a child: its state resets on every open without an effect, and a reopened dialog
            can never arrive already unlocked.
          */}
          <Confirmation
            confirmationPhrase={confirmationPhrase}
            confirmationLabel={confirmationLabel}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            onConfirm={onConfirm}
            tone={tone}
            loading={loading}
          />
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

function Confirmation({
  confirmationPhrase,
  confirmationLabel,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone,
  loading,
}: Pick<
  AlertDialogProps,
  "confirmationPhrase" | "confirmationLabel" | "confirmLabel" | "cancelLabel" | "onConfirm" | "tone" | "loading"
>) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const locked = Boolean(confirmationPhrase) && typed.trim() !== confirmationPhrase;

  return (
    <>
      {confirmationPhrase ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {confirmationLabel}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={cn(controlVariants({ inputSize: "md" }), "font-mono")}
          />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <AlertDialogPrimitive.Cancel asChild>
          <Button variant="secondary" disabled={loading}>
            {cancelLabel}
          </Button>
        </AlertDialogPrimitive.Cancel>
        {/*
          Not wrapped in AlertDialogPrimitive.Action: that closes the dialog on click, which
          would dismiss it even while the typed confirmation is still locked.
        */}
        <Button
          variant={tone === "destructive" ? "destructive" : "primary"}
          onClick={onConfirm}
          disabled={locked}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
