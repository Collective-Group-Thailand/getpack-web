"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { problemMessage } from "@/features/shared/actions";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";

/**
 * The customer's answer to a factory's quotation (D-360): accept it — their name, position and PO number, and
 * agreeing to the price and terms — or decline it with a reason. No account is needed; the link is the key.
 */
export function QuoteAnswer({ token, quoteNo }: { token: string; quoteNo: string }) {
  const t = useTranslations("storefront.quoteLink");
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [poNo, setPoNo] = useState("");
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function send() {
    if (mode === "accept" && (name.trim().length < 2 || !agree)) return setError(t("acceptMissing"));
    if (mode === "decline" && reason.trim().length < 3) return setError(t("reasonMissing"));
    setError(undefined);
    setBusy(true);
    try {
      if (mode === "accept")
        await browserApi().POST("/v1/store/quote-links/{token}/actions/accept", {
          params: { path: { token } },
          body: {
            name: name.trim(),
            position: position.trim() || null,
            customerPoNo: poNo.trim() || null,
            agree: true,
          },
        });
      else
        await browserApi().POST("/v1/store/quote-links/{token}/actions/decline", {
          params: { path: { token } },
          body: { reason: reason.trim() },
        });
      toast.success(mode === "accept" ? t("acceptedToast", { no: quoteNo }) : t("declinedToast"));
      router.refresh();
    } catch (e) {
      toast.error(problemMessage(e, t("failed")));
    } finally {
      setBusy(false);
    }
  }

  if (!mode)
    return (
      <div className="flex flex-wrap gap-3">
        <Button size="lg" iconStart="check" onClick={() => setMode("accept")}>
          {t("accept")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setMode("decline")}>
          {t("decline")}
        </Button>
      </div>
    );

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
      {mode === "accept" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("name")}>
              <Input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("position")}>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </Field>
            <Field label={t("poNo")}>
              <Input value={poNo} onChange={(e) => setPoNo(e.target.value)} />
            </Field>
          </div>
          <Checkbox
            checked={agree}
            onCheckedChange={(on) => setAgree(on === true)}
            label={t("agree", { no: quoteNo })}
          />
        </>
      ) : (
        <Field label={t("reason")}>
          <Textarea
            rows={3}
            value={reason}
            placeholder={t("reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      )}
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" loading={busy} iconStart={mode === "accept" ? "check" : "send"} onClick={() => void send()}>
          {mode === "accept" ? t("acceptConfirm") : t("declineConfirm")}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => setMode(null)}>
          {t("back")}
        </Button>
      </div>
    </div>
  );
}
