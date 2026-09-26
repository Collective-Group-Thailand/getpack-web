"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { Card, CardHeader, CardTitle } from "@/ui/components/Card";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";

import { problemMessage } from "./QueryError";

/** Thrown by a form's own check (a missing file): its message is shown as is. */
export class FormError extends Error {}

export function Section({
  title,
  actions,
  children,
  description,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-2">{title}</CardTitle>
        {actions}
      </CardHeader>
      {description ? <p className="text-muted -mt-2 mb-3 text-sm">{description}</p> : null}
      {children}
    </Card>
  );
}

/**
 * A dialog around a small form: submit runs the request and closes on success; on failure the
 * dialog stays open with its fields, and the API's message is shown.
 */
export function FormDialog({
  title,
  description,
  submitLabel,
  onSubmit,
  onClose,
  children,
  destructive,
}: {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  const t = useTranslations("console.form");
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={title}
      description={description}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" form="console-form" variant={destructive ? "destructive" : "primary"} loading={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id="console-form"
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await onSubmit();
            onClose();
          } catch (error) {
            // A check the form made itself throws a FormError with the message to show.
            toast.error(error instanceof FormError ? error.message : problemMessage(error, t("failed")));
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </form>
    </Dialog>
  );
}
