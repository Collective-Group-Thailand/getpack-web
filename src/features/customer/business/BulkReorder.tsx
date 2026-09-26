"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import type { ResponseOf } from "@/lib/api/requests/client";
import type { Requests } from "@/lib/api/requests/registry";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Textarea } from "@/ui/components/Input";

import { parseReorderCsv } from "./csv";

type Preview = ResponseOf<Requests, "POST /v1/store/me/company/bulk-reorders/actions/preview">;

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Bulk reorder from a CSV (D-153): order number and quantity per line, from a file or pasted.
 * The API checks each row — re-priced, or refused with why — and only the good rows go to the
 * cart, where checkout takes over.
 */
export function BulkReorder() {
  const t = useTranslations("business.reorder");
  const format = useFormat();
  const router = useRouter();
  const [text, setText] = useState("");
  const [unreadable, setUnreadable] = useState<{ line: number; value: string }[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "add" | null>(null);
  const key = useRef(newKey());

  async function check(source: string) {
    const parsed = parseReorderCsv(source);
    setUnreadable(parsed.errors);
    setPreview(null);
    setError(null);
    if (parsed.rows.length === 0) {
      setError(t("noRows"));
      return;
    }
    setBusy("check");
    try {
      setPreview(
        await browserRequests().call("POST /v1/store/me/company/bulk-reorders/actions/preview", {
          body: { rows: parsed.rows.slice(0, 200) },
        }),
      );
    } catch (failure) {
      setError(isApiError(failure) ? failure.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!preview) return;
    setBusy("add");
    try {
      await browserRequests().call("POST /v1/store/me/company/bulk-reorders", {
        body: { previewToken: preview.previewToken },
        idempotencyKey: key.current,
      });
      router.push("/cart");
    } catch (failure) {
      key.current = newKey();
      setError(isApiError(failure) ? failure.detail : t("failed"));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <FileDropzone
          accept=".csv,text/csv,text/plain"
          maxBytes={1_000_000}
          onFiles={async (files) => {
            const file = files[0];
            if (!file) return;
            const content = await file.text();
            setText(content);
            await check(content);
          }}
          labels={{
            prompt: t("drop"),
            browse: t("browse"),
            hint: t("hint"),
            tooLarge: (name) => t("tooLarge", { name }),
            wrongType: (name) => t("wrongType", { name }),
          }}
        />
        <div className="flex flex-col gap-2">
          <Field label={t("paste")} hint={t("pasteHint")}>
            <Textarea
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="font-mono text-sm"
            />
          </Field>
          <Button
            variant="secondary"
            className="self-start"
            loading={busy === "check"}
            disabled={!text.trim()}
            onClick={() => void check(text)}
          >
            {t("check")}
          </Button>
        </div>
      </div>

      {error ? (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      ) : null}
      {unreadable.length > 0 ? (
        <Callout tone="warning" title={t("unreadable", { count: unreadable.length })}>
          <ul className="list-disc ps-5 font-mono text-sm">
            {unreadable.map((row) => (
              <li key={row.line}>{t("lineValue", { line: row.line, value: row.value })}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {preview ? (
        <section aria-labelledby="reorder-result" className="flex flex-col gap-3">
          <h2 id="reorder-result" className="text-lg font-semibold">
            {t("result", { ok: preview.okCount, error: preview.errorCount })}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead className="text-muted text-start text-xs">
                <tr>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("columns.line")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("columns.order")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("columns.product")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("columns.quantity")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("columns.amount")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line} className="border-border border-t">
                    <td className="py-2 tabular-nums">{row.line}</td>
                    <td className="py-2 font-mono">{row.orderCode}</td>
                    <td className="py-2">{row.product ?? "—"}</td>
                    <td className="py-2 text-end tabular-nums">
                      {row.quantity === null ? "—" : format.number(row.quantity)}
                    </td>
                    <td className="py-2 text-end tabular-nums">{format.thb(row.grossAmount)}</td>
                    <td className="py-2">
                      {row.status === "ok" ? (
                        <Badge tone="success">{t("ok")}</Badge>
                      ) : (
                        <span className="text-danger">{row.message}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-semibold">{t("total", { amount: format.thb(preview.grossAmount) })}</p>
          <Button
            className="self-start"
            loading={busy === "add"}
            disabled={preview.okCount === 0}
            onClick={() => void add()}
          >
            {t("add", { count: preview.okCount })}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
