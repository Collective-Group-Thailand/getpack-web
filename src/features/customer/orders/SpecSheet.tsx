"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { SegmentedControl } from "@/ui/components/SegmentedControl";

/**
 * The order's packaging spec sheet (U2.F2, D-287): a PDF in Thai or English made by packio-api from
 * the order's frozen data once its artwork is approved. "Preview" opens it in the browser's own PDF
 * viewer (a signed file cannot be embedded under this app's CSP); "Download" saves it.
 */
export function SpecSheet({ orderId }: { orderId: string }) {
  const t = useTranslations("myOrders.detail.specSheet");
  const locale = useLocale() as "th" | "en";
  const [lang, setLang] = useState<"th" | "en">(locale);
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const open = async (how: "preview" | "download") => {
    // A tab opened before the request keeps the browser from blocking it as a pop-up.
    const tab = how === "preview" ? window.open("", "_blank") : null;
    setBusy(how);
    setProblem(null);
    try {
      const { data } = await browserApi().GET("/v1/store/orders/{orderId}/spec-sheet", {
        params: { path: { orderId }, query: { lang } },
      });
      if (tab) tab.location.href = data!.url;
      else {
        const a = document.createElement("a");
        a.href = data!.url;
        a.download = data!.fileName;
        a.rel = "noopener";
        a.click();
      }
    } catch (error) {
      tab?.close();
      setProblem(isApiError(error) ? error.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="spec-sheet" className="flex flex-col gap-3">
      <h2 id="spec-sheet" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted text-sm">{t("body")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label={t("language")}
          size="sm"
          value={lang}
          onValueChange={setLang}
          options={[
            { value: "th", label: t("th") },
            { value: "en", label: t("en") },
          ]}
        />
        <Button
          size="sm"
          variant="secondary"
          iconStart="eye"
          loading={busy === "preview"}
          onClick={() => void open("preview")}
        >
          {t("preview")}
        </Button>
        <Button size="sm" iconStart="download" loading={busy === "download"} onClick={() => void open("download")}>
          {t("download")}
        </Button>
      </div>
      {problem ? <Callout tone="danger" title={problem} /> : null}
    </section>
  );
}
