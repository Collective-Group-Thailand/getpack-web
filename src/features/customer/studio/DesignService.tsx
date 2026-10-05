"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { EditorChromeContext } from "@/features/designer/components/Editor";
import { useEditor } from "@/features/designer/store/editor";
import { useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { stableIdempotencyKey } from "@/lib/api/idempotency";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";

import { briefOf } from "./brief";

/**
 * "ให้ทีมออกแบบให้" (U4.8, studio-spec §5, D-286): the design service from inside the studio. The
 * brief starts from what is on the box (`briefOf`) and the customer adds to it; the version is saved
 * and quoted for the chosen quantity, `store.studio.requestDesignService` puts it in the cart with
 * the design service (priced by that quotation with the graphic design fee), and the brief goes on
 * the cart line (`designNote`). At checkout the request works on this same document: the assigned
 * designer edits it, the customer comments on it and approves the proof there.
 */
export function DesignService({
  ctx,
  quantity,
  offered,
}: {
  ctx: EditorChromeContext;
  quantity: number | null;
  /** The product offers hired design (`configurator.design.options`). */
  offered: boolean;
}) {
  const t = useTranslations("studio.designService");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const router = useRouter();
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const open = () => {
    const { spec, content } = useEditor.getState();
    if (!spec) return;
    setProblem(null);
    setBrief(
      `${briefOf(spec, content, locale, {
        box: t("brief.box"),
        size: t("brief.size"),
        material: t("brief.material"),
        print: t("brief.print"),
        printMethod: {
          digital: t("brief.methods.digital"),
          offset: t("brief.methods.offset"),
          flexo: t("brief.methods.flexo"),
          none: t("brief.methods.none"),
        },
        colours: t("brief.colours"),
        texts: t("brief.texts"),
        images: t("brief.images"),
        none: t("brief.none"),
        mm: t("brief.mm"),
      })}\n${t("brief.wishes")}: `,
    );
  };

  const send = async () => {
    if (!brief || !quantity) return;
    setBusy(true);
    setProblem(null);
    try {
      // The version handed over asks for graphic design: its quotation carries the design fee.
      const editor = useEditor.getState();
      if (editor.spec && !editor.spec.studio?.designService)
        editor.setSpec({ ...editor.spec, studio: { ...editor.spec.studio, designService: true } });
      if (!(await ctx.persistence.save("manual"))) throw new Error(t("saveFailed"));
      const id = ctx.persistence.serverId()!;
      const versionNo = ctx.persistence.versionNo()!;
      const { data: quote } = await browserApi().POST("/v1/store/studio/{designId}/quote/actions/save", {
        params: {
          path: { designId: id },
          header: { "Idempotency-Key": await stableIdempotencyKey(`${id}:${versionNo}:quote:${quantity}`) },
        },
        body: { quantities: [quantity], versionNo },
      });
      const option = quote!.options.find((o) => o.quantity === quantity) ?? quote!.options[0]!;
      const { data: line } = await browserApi().POST("/v1/store/studio/{designId}/design-service", {
        params: { path: { designId: id } },
        body: { quoteId: quote!.id, quoteOptionId: option.id, versionNo },
      });
      // The brief rides on the cart line; the cart is edited under its ETag.
      const { response } = await browserApi().GET("/v1/store/cart");
      await browserApi().PATCH("/v1/store/cart/items/{itemId}", {
        params: { path: { itemId: line!.cartItemId }, header: { "If-Match": response.headers.get("etag") ?? "" } },
        body: { designNote: brief.trim().slice(0, 4000) },
      });
      router.push("/cart");
    } catch (error) {
      setProblem(isApiError(error) ? error.detail : error instanceof Error ? error.message : t("failed"));
      setBusy(false);
    }
  };

  if (!offered) return null;

  return (
    <section aria-labelledby="studio-design-service" className="border-border space-y-2 rounded-md border p-3">
      <h3 id="studio-design-service" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <p className="text-muted text-sm">{t("body")}</p>
      <Button size="sm" variant="secondary" iconStart="users" disabled={!quantity} onClick={open}>
        {t("open")}
      </Button>
      <Dialog
        open={brief !== null}
        onOpenChange={(next) => !next && !busy && setBrief(null)}
        title={t("dialogTitle")}
        description={t("dialogBody")}
        closeLabel={tCommon("actions.close")}
        footer={
          <Button loading={busy} disabled={!brief?.trim()} onClick={() => void send()}>
            {t("send")}
          </Button>
        }
      >
        <Field label={t("briefLabel")} hint={t("briefHint")}>
          <Textarea value={brief ?? ""} onChange={(event) => setBrief(event.target.value)} rows={10} maxLength={4000} />
        </Field>
        {problem ? <Callout tone="danger" title={problem} className="mt-3" /> : null}
      </Dialog>
    </section>
  );
}
