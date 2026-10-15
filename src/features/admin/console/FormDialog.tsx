"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isApiError, type ProblemFieldError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
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
  size,
}: {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
  children: React.ReactNode;
  destructive?: boolean;
  /** `lg` / `xl` for a form that is a table (rate lines). */
  size?: "md" | "lg" | "xl";
}) {
  const t = useTranslations("console.form");
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  // The API's field errors stay in the dialog beside the fields, not only in a passing toast.
  const [fieldErrors, setFieldErrors] = useState<readonly ProblemFieldError[]>([]);
  return (
    <Dialog
      open
      size={size}
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
          setFieldErrors([]);
          try {
            await onSubmit();
            onClose();
          } catch (error) {
            // A check the form made itself throws a FormError with the message to show.
            toast.error(error instanceof FormError ? error.message : problemMessage(error, t("failed")));
            if (isApiError(error)) setFieldErrors(error.errors);
          } finally {
            setBusy(false);
          }
        }}
      >
        {fieldErrors.length ? (
          <Callout tone="danger" title={t("fieldErrors")}>
            <ul className="list-disc ps-4 text-sm">
              {fieldErrors.slice(0, 10).map((error, index) => (
                <li key={`${error.path}-${index}`}>
                  <span className="font-mono text-xs">{error.path}</span> {error.message}
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
        {children}
      </form>
    </Dialog>
  );
}
