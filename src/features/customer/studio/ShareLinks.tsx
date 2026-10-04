"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { queryKeys } from "@/lib/api/query-keys";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

type Scope = Schemas["ShareScope"];

/**
 * Sharing a studio design (U4.7, D-285): links with a scope — view (anyone with the link), comment
 * (a signed-in user), edit (a signed-in member of the design's company) — as many as needed, each
 * expiring (`configurations.share_link_days`) and revocable. A link's address is shown once, when it
 * is made: packio-api keeps only its hash.
 */
export function ShareLinks({
  designId,
  open,
  onClose,
  canEdit,
}: {
  designId: string;
  open: boolean;
  onClose: () => void;
  /** Edit links only for a company member (packio-api enforces it too). */
  canEdit: boolean;
}) {
  const t = useTranslations("studio.share");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const locale = useLocale();
  const client = useQueryClient();
  const [scope, setScope] = useState<Scope>("view");
  const [created, setCreated] = useState<{ url: string; scope: Scope } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = [...queryKeys.zone("customer"), "studio-share-links", designId];
  const links = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await browserApi().GET("/v1/store/studio/{designId}/share-links", { params: { path: { designId } } })).data!,
    enabled: open,
  });

  const create = async () => {
    setBusy(true);
    try {
      const { data } = await browserApi().POST("/v1/store/studio/{designId}/share-links", {
        params: { path: { designId } },
        body: { scope },
      });
      const prefix = locale === "en" ? "/en" : "";
      setCreated({ url: `${window.location.origin}${prefix}/design/shared/${data!.token}`, scope: data!.scope });
      await client.invalidateQueries({ queryKey: key });
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (linkId: string) => {
    try {
      await browserApi().POST("/v1/store/studio/{designId}/share-links/{linkId}/actions/revoke", {
        params: { path: { designId, linkId } },
      });
      toast.success(t("revoked"));
      await client.invalidateQueries({ queryKey: key });
    } catch {
      toast.error(t("revokeFailed"));
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const scopes: Scope[] = canEdit ? ["view", "comment", "edit"] : ["view", "comment"];
  const live = (links.data ?? []).filter((link) => !link.revokedAt);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("title")}
      description={t("body")}
      closeLabel={tCommon("actions.close")}
      size="md"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <SegmentedControl
            label={t("scope")}
            value={scope}
            onValueChange={setScope}
            options={scopes.map((value) => ({ value, label: t(`scopes.${value}`) }))}
          />
          <p className="text-muted text-sm">{t(`hints.${scope}`)}</p>
          <Button iconStart="link" loading={busy} onClick={() => void create()}>
            {t("create")}
          </Button>
        </div>

        {created ? (
          <Callout tone="success" title={t("created", { scope: t(`scopes.${created.scope}`) })}>
            <Field label={t("link")} hint={t("once")}>
              <Input readOnly value={created.url} onFocus={(event) => event.target.select()} />
            </Field>
            <Button size="sm" className="mt-2" iconStart="copy" onClick={() => void copy(created.url)}>
              {t("copy")}
            </Button>
          </Callout>
        ) : null}

        <section aria-labelledby="share-links" className="space-y-2">
          <h3 id="share-links" className="text-sm font-semibold">
            {t("links")}
          </h3>
          {links.isPending ? <Skeleton className="h-10 w-full" /> : null}
          {links.isSuccess && live.length === 0 ? <p className="text-muted text-sm">{t("none")}</p> : null}
          <ul className="space-y-2">
            {live.map((link) => (
              <li key={link.id} className="border-border flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm">
                  <Badge tone="neutral">{t(`scopes.${link.scope}`)}</Badge>{" "}
                  <span className="text-muted">{t("expires", { date: format.dateTime(link.expiresAt) })}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  iconStart="ban"
                  aria-label={t("revokeOne", {
                    scope: t(`scopes.${link.scope}`),
                    date: format.dateTime(link.createdAt),
                  })}
                  onClick={() => void revoke(link.id)}
                >
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
