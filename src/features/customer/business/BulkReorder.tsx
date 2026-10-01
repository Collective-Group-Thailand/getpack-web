"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useFormat } from "@/features/shared/format/useFormat";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Textarea } from "@/ui/components/Input";

import { parseReorderCsv } from "./csv";

type Preview = Schemas["BulkReorderPreviewDto"];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/**
 * Bulk reorder from a CSV (D-153, `store.claims.previewBulkReorder` / `bulkReorder`): order number
 * and quantity per line, from a file or pasted. The API checks each row — re-priced, or refused
 * with its reason code — and only the good rows go to the cart, where checkout takes over; a row
 * the cart then refuses is listed.
 */
export function BulkReorder({ companyId }: { companyId: string }) {
  const t = useTranslations("business.reorder");
  const tProblems = useTranslations("problems");
  // A refusal is an API error code: its words where this app has them, else a general line.
  const reasonOf = (code: string | null) => {
    if (!code) return "";
    const own = `reasons.${code.replace(".", "_")}`;
    return t.has(own) ? t(own) : tProblems.has(code) ? tProblems(code) : t("refused");
  };
  const [failedRows, setFailedRows] = useState<Schemas["BulkReorderFailedDto"][]>([]);
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
      const { data } = await browserApi().POST("/v1/store/companies/{companyId}/bulk-reorders/actions/preview", {
        params: { path: { companyId } },
        body: {
          rows: parsed.rows.slice(0, 200).map((row) => ({
            line: row.line,
            orderCode: row.orderCode,
            ...(row.quantity ? { quantity: row.quantity } : {}),
          })),
        },
      });
      setPreview(data!);
    } catch (failure) {
      setError(isApiError(failure) ? failure.detail : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!preview?.previewToken) return;
    setBusy("add");
    try {
      const { data } = await browserApi().POST("/v1/store/companies/{companyId}/bulk-reorders", {
        params: { path: { companyId }, header: { "Idempotency-Key": key.current } },
        body: { previewToken: preview.previewToken },
      });
      if (data!.failed.length > 0) {
        // The cart refused some rows; the others are in it.
        setFailedRows(data!.failed);
        setBusy(null);
        return;
      }
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
            {t("result", { ok: preview.okCount, error: preview.refusedCount })}
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
                    <td className="py-2 text-end tabular-nums">
                      {row.quantity === null ? "—" : format.number(row.quantity)}
                    </td>
                    <td className="py-2 text-end tabular-nums">{format.thb(row.grossAmount)}</td>
                    <td className="py-2">
                      {row.status === "ok" ? (
                        <>
                          <Badge tone="success">{t("ok")}</Badge>
                          {row.proofSkipped ? (
                            <span className="text-muted ms-2 text-xs">{t("proofSkipped")}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-danger">{reasonOf(row.reason)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-semibold">{t("total", { amount: format.thb(preview.grossAmount) })}</p>
          {preview.previewExpiresAt ? (
            <p className="text-muted text-xs">{t("holds", { date: format.dateTime(preview.previewExpiresAt) })}</p>
          ) : null}
          <Button
            className="self-start"
            loading={busy === "add"}
            disabled={preview.okCount === 0 || !preview.previewToken}
            onClick={() => void add()}
          >
            {t("add", { count: preview.okCount })}
          </Button>
          {failedRows.length > 0 ? (
            <Callout tone="warning" title={t("cartRefused", { count: failedRows.length })}>
              <ul className="list-disc ps-5 text-sm">
                {failedRows.map((row) => (
                  <li key={row.line}>
                    {t("lineValue", { line: row.line, value: `${row.orderCode} — ${reasonOf(row.code)}` })}
                  </li>
                ))}
              </ul>
              <Button asChild size="sm" className="mt-2">
                <Link href="/cart">{t("toCart")}</Link>
              </Button>
            </Callout>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
