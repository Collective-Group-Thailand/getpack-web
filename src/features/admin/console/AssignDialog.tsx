"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/Button";
import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { toast } from "@/ui/components/Toast";

import { useActor } from "./actor";
import { problemMessage } from "./QueryError";
import { useRoleLabel } from "./roles";
import { useStaffDirectory } from "./useStaffDirectory";

export interface AssignDialogProps {
  title: string;
  /** Restates what is being assigned — its code. */
  description: string;
  current: { id: string; displayName: string } | null;
  /** Only people holding this permission are offered (`GET /v1/admin/staff-directory?permission=`). */
  permission: string;
  /** Explains who is offered, e.g. "only people who can handle RFQs". */
  personHint: string;
  /** Whether the item can be put back with nobody on it (default true); some APIs cannot unassign. */
  clearable?: boolean;
  /** Calls the API; the dialog closes when it resolves and stays open when it throws. */
  onAssign: (assigneeId: string | null) => Promise<void>;
  onClose: () => void;
}

/**
 * Who owns a queue item: take it yourself, pick a colleague who holds the permission, or put
 * it back. The API still decides whether the person may take it; this only avoids offering
 * someone certain to be refused.
 */
export function AssignDialog({
  title,
  description,
  current,
  permission,
  personHint,
  clearable = true,
  onAssign,
  onClose,
}: AssignDialogProps) {
  const t = useTranslations("console.assign");
  const tCommon = useTranslations("common");
  const actor = useActor();
  const roleLabel = useRoleLabel();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ComboboxOption | null>(null);

  const people = useStaffDirectory({ q: query, permission });

  const assign = useMutation({
    mutationFn: onAssign,
    onSuccess: (_, assigneeId) => {
      toast.success(assigneeId ? t("done") : t("cleared"));
      onClose();
    },
    onError: (error) => toast.error(problemMessage(error, t("failed"))),
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={title}
      description={description}
      closeLabel={tCommon("actions.close")}
      footer={
        <>
          {current && clearable ? (
            <Button
              variant="ghost"
              loading={assign.isPending && assign.variables === null}
              onClick={() => assign.mutate(null)}
            >
              {t("clear")}
            </Button>
          ) : null}
          {current?.id !== actor.id ? (
            <Button variant="secondary" onClick={() => assign.mutate(actor.id)}>
              {t("me")}
            </Button>
          ) : null}
          <Button
            disabled={!picked}
            loading={assign.isPending && assign.variables === picked?.value}
            onClick={() => picked && assign.mutate(picked.value)}
          >
            {t("confirm")}
          </Button>
        </>
      }
    >
      {current ? <p className="text-muted mb-3 text-sm">{t("current", { name: current.displayName })}</p> : null}
      <Field label={t("person")} hint={personHint}>
        <Combobox
          value={picked}
          onValueChange={setPicked}
          query={query}
          onQueryChange={setQuery}
          loading={people.isFetching}
          options={(people.data ?? []).map((person) => ({
            value: person.id,
            label: person.displayName,
            description: person.roles.map(roleLabel).join(", "),
          }))}
          placeholder={t("placeholder")}
          labels={{ loading: tCommon("state.loading"), empty: t("nobody"), clear: t("clearPick") }}
        />
      </Field>
    </Dialog>
  );
}
