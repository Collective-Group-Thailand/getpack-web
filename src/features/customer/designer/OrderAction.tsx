"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useDesigner } from "@/features/designer/components/DesignerContext";
import { insideSize } from "@/features/designer/document";
import { buildPrintPdf } from "@/features/designer/print";
import { useEditor } from "@/features/designer/store/editor";
import { uploadFile } from "@/features/shared/files/upload";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import type { ResponseOf } from "@/lib/api/requests/client";
import { browserRequests } from "@/lib/api/requests/browser";
import type { Requests } from "@/lib/api/requests/registry";
import { AlertDialog } from "@/ui/components/AlertDialog";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { toast } from "@/ui/components/Toast";

type Artwork = ResponseOf<Requests, "GET /v1/store/orders/{orderId}/artwork">;

export interface OrderLink {
  orderId: string;
  orderCode: string;
  itemId: string;
}

/**
 * The designer's primary action for a customer.
 *
 * - **Linked to an order line** ("design online" from the order): *send to print* — the print
 *   file is made in the browser (ADR-0009: vector die on spot layers, artwork at 300 dpi with the
 *   bleed from settings), uploaded, and submitted as the order's artwork with this design's id;
 *   preflight answers at once (D-070) and the proof flow continues on the artwork page.
 * - **Not linked**: *order this* — the product's configurator with this design's pattern, size
 *   and material filled in; after checkout, the order's artwork page takes the design.
 */
export function OrderAction({ link, productSlug }: { link: OrderLink | null; productSlug: string | null }) {
  const t = useTranslations("designer.order");
  const tCommon = useTranslations("common");
  const designer = useDesigner();
  const spec = useEditor((s) => s.spec);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<null | "saving" | "rendering" | "uploading" | "submitting">(null);
  const [result, setResult] = useState<Artwork["submissions"][number] | null>(null);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

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
        <Link href={productSlug ? `/configure/${productSlug}?${query.toString()}` : "/products"}>{t("orderThis")}</Link>
      </Button>
    );
  }

  const submit = async () => {
    setConfirmOpen(false);
    const stage = designer.stage();
    const dieline = designer.dieline;
    if (!stage || !dieline) return;
    try {
      setBusy("saving");
      if (!(await designer.save("manual"))) throw new Error("save");
      const designId = designer.serverId();
      setBusy("rendering");
      const name = useEditor.getState().name;
      const pdf = await buildPrintPdf(stage, dieline, { name, bleedMm: useEditor.getState().bleedMm });
      setBusy("uploading");
      const file = await uploadFile(
        "customer",
        new File([pdf], `${name || link.orderCode}-print.pdf`, { type: "application/pdf" }),
        "artwork",
      );
      setBusy("submitting");
      const artwork = await browserRequests().call("POST /v1/store/orders/{orderId}/artwork/submissions", {
        path: { orderId: link.orderId },
        body: { files: [{ fileId: file.id, role: "artwork" }], ...(designId ? { designDocumentId: designId } : {}) },
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = crypto.randomUUID();
      setResult(artwork.submissions[0] ?? null);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  const blocked = result?.findings.filter((f) => f.severity === "block") ?? [];
  const warned = result?.findings.filter((f) => f.severity === "warn") ?? [];

  return (
    <>
      <Button size="sm" loading={busy !== null} onClick={() => setConfirmOpen(true)} disabled={!spec}>
        {busy ? t(`busy.${busy}`) : t("sendToPrint")}
      </Button>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirm.title", { order: link.orderCode })}
        description={t("confirm.body")}
        confirmLabel={t("sendToPrint")}
        cancelLabel={tCommon("actions.cancel")}
        onConfirm={() => void submit()}
      />
      <Dialog
        open={result !== null}
        onOpenChange={(open) => !open && setResult(null)}
        title={blocked.length ? t("result.blockedTitle") : t("result.sentTitle", { order: link.orderCode })}
        description={
          blocked.length ? t("result.blockedBody") : warned.length ? t("result.warnBody") : t("result.okBody")
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
            title={finding.message}
            className="mb-2"
          />
        ))}
        {result ? <p className="text-muted text-xs">{t("result.version", { version: result.versionNo })}</p> : null}
      </Dialog>
    </>
  );
}
