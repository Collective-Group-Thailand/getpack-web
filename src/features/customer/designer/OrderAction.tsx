"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { findingsOf } from "@/features/customer/artwork/artwork";
import { pick } from "@/features/customer/catalog/localize";
import { useDesigner } from "@/features/designer/components/DesignerContext";
import { insideSize } from "@/features/designer/document";
import { useEditor } from "@/features/designer/store/editor";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";

export interface OrderLink {
  orderId: string;
  orderCode: string;
  itemId: string;
}

/**
 * The designer's primary action for a customer.
 *
 * - **Linked to an order line** ("design online" from the order): *send to print* — the design is
 *   saved and its current version submitted as the order's artwork (`store.designs.submitForOrder`);
 *   Prepress exports it for the proof (D-070), and the proof flow continues on the artwork page.
 *   The API makes the print file from the design, so the browser-built PDF (ADR-0009) is not sent.
 * - **Not linked**: *order this* — the product's configurator with this design's pattern, size
 *   and material filled in; after checkout, the order's artwork page takes the design.
 */
export function OrderAction({ link, productSlug }: { link: OrderLink | null; productSlug: string | null }) {
  const t = useTranslations("designer.order");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const designer = useDesigner();
  const spec = useEditor((s) => s.spec);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<null | "saving" | "submitting">(null);
  const [result, setResult] = useState<Schemas["ArtworkSubmissionDto"] | null>(null);

  if (!link) {
    if (!spec) return null;
    const size = insideSize(spec);
    const query = new URLSearchParams({
      ...(spec.patternId ? { pattern: spec.patternId } : {}),
      ...(spec.materialId ? { material: spec.materialId } : {}),
      ...(size.length ? { l: String(size.length), w: String(size.width), d: String(size.height) } : {}),
      design: designer.serverId() ?? "",
    });
    return (
      <Button asChild size="sm">
        <Link
          href={productSlug ? `/configure/${productSlug}?${query.toString()}` : "/products"}
          onClick={() => track("design_ordered", { route: "/design/[id]" })}
        >
          {t("orderThis")}
        </Link>
      </Button>
    );
  }

  const submit = async () => {
    setConfirmOpen(false);
    try {
      setBusy("saving");
      if (!(await designer.save("manual"))) throw new Error("save");
      const designId = designer.serverId();
      setBusy("submitting");
      const { data } = await browserApi().POST("/v1/store/orders/{orderId}/artwork-submissions/from-design", {
        params: { path: { orderId: link.orderId } },
        body: designId ? { designId } : {},
      });
      setResult(data!);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const findings = result ? findingsOf(result) : [];
  const blocked = findings.filter((f) => f.severity === "block");
  const warned = findings.filter((f) => f.severity === "warn");
  // Preflight runs after the design is exported; the artwork page shows its answer.
  const checking = result?.preflightStatus === "pending" || result?.preflightStatus === "running";

  return (
    <>
      <Button size="sm" loading={busy !== null} onClick={() => setConfirmOpen(true)} disabled={!spec}>
        {busy ? t(`busy.${busy}`) : t("sendToPrint")}
      </Button>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirm.title", { order: link.orderCode })}
        description={t("confirm.bodyFromDesign")}
        confirmLabel={t("sendToPrint")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => void submit()}
      />
      <Dialog
        open={result !== null}
        onOpenChange={(open) => !open && setResult(null)}
        title={blocked.length ? t("result.blockedTitle") : t("result.sentTitle", { order: link.orderCode })}
        description={
          checking
            ? t("result.pendingBody")
            : blocked.length
              ? t("result.blockedBody")
              : warned.length
                ? t("result.warnBody")
                : t("result.okBody")
        }
        closeLabel={tCommon("actions.close")}
        footer={
          <Button asChild>
            <Link href={`/account/orders/${link.orderId}/artwork`}>{t("result.toArtwork")}</Link>
          </Button>
        }
      >
        {[...blocked, ...warned].map((finding, index) => (
          <Callout
            key={index}
            tone={finding.severity === "block" ? "danger" : "warning"}
            title={pick(locale, finding.messageTh, finding.messageEn)}
            className="mb-2"
          />
        ))}
        {result ? <p className="text-muted text-xs">{t("result.version", { version: result.versionNo })}</p> : null}
      </Dialog>
    </>
  );
}
