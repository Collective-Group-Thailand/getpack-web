"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ConfirmAction } from "@/features/shared/actions/ConfirmAction";
import { problemMessage } from "@/features/shared/actions/QueryError";
import { uploadFile } from "@/features/shared/files/upload";
import { useFormat } from "@/features/shared/format";
import { SearchableSelect } from "@/features/shared/forms/SearchableSelect";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FilePickButton } from "@/ui/components/FilePickButton";
import { Input } from "@/ui/components/Input";
import { Skeleton } from "@/ui/components/Skeleton";
import { toast } from "@/ui/components/Toast";

type Branding = Schemas["DocumentBrandingDto"];
type MarkKind = "logo" | "seal";
type DocKind = Schemas["SigningRuleDto"]["docKind"];

/** Where the editor works: getpack's own documents (admin) or one factory's (partner). */
export type BrandingOwner = { zone: "admin" } | { zone: "partner"; factoryId: string };

/**
 * The calls of `admin.documentBranding.*` and `partner.documentBranding.*` (D-428, D-429): the two surfaces are
 * the same resource, so one editor serves both and only the paths differ.
 */
function brandingApi(owner: BrandingOwner) {
  const api = browserApi();
  if (owner.zone === "admin")
    return {
      get: async () => (await api.GET("/v1/admin/document-branding", {})).data!,
      setMark: async (kind: MarkKind, fileId: string | null) =>
        (await api.PUT("/v1/admin/document-branding/marks/{kind}", { params: { path: { kind } }, body: { fileId } }))
          .data!,
      addSignatory: async (userId: string, position: string) =>
        (await api.POST("/v1/admin/document-branding/signatories", { body: { userId, position } })).data!,
      removeSignatory: async (signatoryId: string) =>
        (
          await api.DELETE("/v1/admin/document-branding/signatories/{signatoryId}", {
            params: { path: { signatoryId } },
          })
        ).data!,
      setRule: async (docKind: DocKind, signatoryId: string | null, stampSeal: boolean) =>
        (
          await api.PUT("/v1/admin/document-branding/rules/{docKind}", {
            params: { path: { docKind } },
            body: { signatoryId, stampSeal },
          })
        ).data!,
      candidates: async (q: string) =>
        (await api.GET("/v1/admin/document-branding/signatory-candidates", { params: { query: { q } } })).data ?? [],
      preview: async (docKind: DocKind) =>
        (await api.POST("/v1/admin/document-branding/preview", { body: { docKind } })).data!,
    };
  const factoryId = owner.factoryId;
  const path = { factoryId };
  return {
    get: async () => (await api.GET("/v1/partner/factories/{factoryId}/document-branding", { params: { path } })).data!,
    setMark: async (kind: MarkKind, fileId: string | null) =>
      (
        await api.PUT("/v1/partner/factories/{factoryId}/document-branding/marks/{kind}", {
          params: { path: { ...path, kind } },
          body: { fileId },
        })
      ).data!,
    addSignatory: async (userId: string, position: string) =>
      (
        await api.POST("/v1/partner/factories/{factoryId}/document-branding/signatories", {
          params: { path },
          body: { userId, position },
        })
      ).data!,
    removeSignatory: async (signatoryId: string) =>
      (
        await api.DELETE("/v1/partner/factories/{factoryId}/document-branding/signatories/{signatoryId}", {
          params: { path: { ...path, signatoryId } },
        })
      ).data!,
    setRule: async (docKind: DocKind, signatoryId: string | null, stampSeal: boolean) =>
      (
        await api.PUT("/v1/partner/factories/{factoryId}/document-branding/rules/{docKind}", {
          params: { path: { ...path, docKind } },
          body: { signatoryId, stampSeal },
        })
      ).data!,
    candidates: async (q: string) =>
      (
        await api.GET("/v1/partner/factories/{factoryId}/document-branding/signatory-candidates", {
          params: { path, query: { q } },
        })
      ).data ?? [],
    preview: async (docKind: DocKind) =>
      (
        await api.POST("/v1/partner/factories/{factoryId}/document-branding/preview", {
          params: { path },
          body: { docKind },
        })
      ).data!,
  };
}

/**
 * Logo, company seal, signatories and who signs what (D-428, D-429). Every change is kept as history by the
 * API, so issued documents keep what was in force at their issue; the signature itself is uploaded only by
 * the signatory (`MySignatures`).
 */
export function DocumentBrandingEditor({ owner, canEdit }: { owner: BrandingOwner; canEdit: boolean }) {
  const t = useTranslations("docBranding");
  const [data, setData] = useState<Branding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownerKey = owner.zone === "admin" ? "admin" : owner.factoryId;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the owner is identified by its key
  const api = useCallback(() => brandingApi(owner), [ownerKey]);

  useEffect(() => {
    let alive = true;
    api()
      .get()
      .then((next) => alive && setData(next))
      .catch((caught: unknown) => alive && setError(problemMessage(caught, t("loadFailed"))));
    return () => {
      alive = false;
    };
  }, [api, t]);

  async function run(work: () => Promise<Branding>, done?: string) {
    try {
      setData(await work());
      if (done) toast.success(done);
      return true;
    } catch (caught) {
      toast.error(problemMessage(caught, t("failed")));
      return false;
    }
  }

  if (error) return <Callout tone="danger" title={error} />;
  if (!data)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? null : <Callout tone="neutral" title={t("readOnly")} />}
      <Marks data={data} owner={owner} canEdit={canEdit} run={run} api={api} />
      <Signatories data={data} canEdit={canEdit} run={run} api={api} />
      <Rules data={data} canEdit={canEdit} run={run} api={api} />
      <Preview data={data} api={api} />
      <History data={data} />
    </div>
  );
}

type Run = (work: () => Promise<Branding>, done?: string) => Promise<boolean>;
type Api = () => ReturnType<typeof brandingApi>;

function SectionCard({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {body ? <p className="text-muted text-sm">{body}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function Marks({
  data,
  owner,
  canEdit,
  run,
  api,
}: {
  data: Branding;
  owner: BrandingOwner;
  canEdit: boolean;
  run: Run;
  api: Api;
}) {
  const t = useTranslations("docBranding.marks");
  const format = useFormat();
  const [busy, setBusy] = useState<MarkKind | null>(null);

  async function upload(kind: MarkKind, file: File) {
    setBusy(kind);
    try {
      const uploaded = await uploadFile(
        owner.zone,
        file,
        "brand_mark",
        owner.zone === "partner" ? { factoryId: owner.factoryId } : undefined,
      );
      await run(() => api().setMark(kind, uploaded.id), t("uploaded", { kind: t(kind) }));
    } catch (caught) {
      toast.error(problemMessage(caught, t("upload")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard title={t("title")} body={t("body")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["logo", "seal"] as const).map((kind) => {
          const mark = data[kind];
          return (
            <div key={kind} className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">{t(kind)}</p>
                <p className="text-muted text-xs">{t(`${kind}Hint`)}</p>
              </div>
              <div className="bg-surface-subtle grid h-28 place-items-center rounded-md">
                {mark?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL
                  <img src={mark.url} alt={t(kind)} className="max-h-24 max-w-[80%] object-contain" />
                ) : (
                  <span className="text-muted text-sm">{t("none")}</span>
                )}
              </div>
              {mark ? (
                <p className="text-muted text-xs">{t("setAt", { at: format.dateTime(mark.setAt), by: mark.setBy })}</p>
              ) : null}
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <FilePickButton
                    label={mark ? t("replace") : t("upload")}
                    accept="image/png,image/jpeg,image/webp"
                    icon="image"
                    loading={busy === kind}
                    onFiles={([file]) => (file ? void upload(kind, file) : undefined)}
                  />
                  {mark ? (
                    <Button
                      variant="ghost"
                      iconStart="trash"
                      onClick={() => void run(() => api().setMark(kind, null), t("removed", { kind: t(kind) }))}
                    >
                      {t("remove")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function Signatories({ data, canEdit, run, api }: { data: Branding; canEdit: boolean; run: Run; api: Api }) {
  const t = useTranslations("docBranding.signatories");
  const tRoot = useTranslations("docBranding");
  const [userId, setUserId] = useState("");
  const [position, setPosition] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Schemas["SignatoryCandidateDto"][]>([]);
  const [removing, setRemoving] = useState<Schemas["SignatoryDto"] | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    const timer = setTimeout(() => {
      api()
        .candidates(query)
        .then((rows) => alive && setOptions(rows))
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api, canEdit, query]);

  const taken = new Set(data.signatories.map((s) => s.userId));
  const picked = options.find((o) => o.id === userId);

  return (
    <SectionCard title={t("title")} body={t("body")}>
      {data.signatories.length === 0 ? <p className="text-muted text-sm">{t("empty")}</p> : null}
      <ul className="flex flex-col gap-2">
        {data.signatories.map((s) => (
          <li key={s.id} className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="bg-surface-subtle grid h-14 w-32 shrink-0 place-items-center rounded-md">
              {s.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL
                <img
                  src={s.signatureUrl}
                  alt={t("signatureOf", { name: s.displayName })}
                  className="max-h-12 max-w-28 object-contain"
                />
              ) : (
                <span className="text-muted text-xs">—</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.displayName}</p>
              <p className="text-muted text-sm">
                {s.position || "—"} · {s.email ?? s.userName}
              </p>
            </div>
            <Badge tone={s.hasSignature ? "success" : "warning"}>
              {s.hasSignature ? t("hasSignature") : t("noSignature")}
            </Badge>
            {canEdit ? (
              <Button variant="ghost" iconStart="trash" onClick={() => setRemoving(s)}>
                {t("remove")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!userId || !position.trim()) return;
            void run(() => api().addSignatory(userId, position.trim()), t("added", { name: picked?.name ?? "" })).then(
              (ok) => {
                if (ok) {
                  setUserId("");
                  setPosition("");
                }
              },
            );
          }}
        >
          <div className="flex flex-col gap-2">
            <Field label={t("person")}>
              <Input
                type="search"
                value={query}
                placeholder={t("pickPerson")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
            <SearchableSelect
              aria-label={t("person")}
              value={userId || undefined}
              onValueChange={setUserId}
              placeholder={t("person")}
              options={options
                .filter((o) => !taken.has(o.id))
                .map((o) => ({ value: o.id, label: o.email ? `${o.name} · ${o.email}` : o.name }))}
            />
          </div>
          <Field label={t("position")}>
            <Input
              value={position}
              placeholder={t("positionPlaceholder")}
              maxLength={120}
              onChange={(event) => setPosition(event.target.value)}
            />
          </Field>
          <Button type="submit" iconStart="plus" disabled={!userId || !position.trim()}>
            {t("add")}
          </Button>
        </form>
      ) : null}
      {removing ? (
        <ConfirmAction
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={t("removeTitle", { name: removing.displayName })}
          description={t("removeBody", { name: removing.displayName })}
          confirmLabel={t("remove")}
          tone="destructive"
          onConfirm={async () => {
            const ok = await run(() => api().removeSignatory(removing.id), t("removed"));
            if (!ok) throw new Error(tRoot("failed"));
            setRemoving(null);
          }}
        />
      ) : null}
    </SectionCard>
  );
}

function Rules({ data, canEdit, run, api }: { data: Branding; canEdit: boolean; run: Run; api: Api }) {
  const t = useTranslations("docBranding.rules");
  const tRoot = useTranslations("docBranding");
  const none = "__none__";
  const signatoryOptions = [
    { value: none, label: t("noSignatory") },
    ...data.signatories.map((s) => ({ value: s.id, label: `${s.displayName} — ${s.position}` })),
  ];
  return (
    <SectionCard title={t("title")} body={t("body")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-muted text-start">
              <th className="py-2 text-start font-medium">{t("docKind")}</th>
              <th className="py-2 text-start font-medium">{t("signatory")}</th>
              <th className="py-2 text-start font-medium">{t("seal")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map((rule) => (
              <tr key={rule.docKind} className="border-border border-t">
                <td className="py-2 pe-3">{t(`kinds.${rule.docKind}`)}</td>
                <td className="py-2 pe-3">
                  <SearchableSelect
                    aria-label={`${t("signatory")} — ${t(`kinds.${rule.docKind}`)}`}
                    value={rule.signatoryId ?? none}
                    disabled={!canEdit}
                    options={signatoryOptions}
                    onValueChange={(value) =>
                      void run(
                        () => api().setRule(rule.docKind, value === none ? null : value, rule.stampSeal),
                        tRoot("saved"),
                      )
                    }
                  />
                </td>
                <td className="py-2">
                  <Checkbox
                    label={t("seal")}
                    size="sm"
                    checked={rule.stampSeal}
                    disabled={!canEdit || (!data.seal && !rule.stampSeal)}
                    description={!data.seal && rule.stampSeal ? t("noSealYet") : undefined}
                    onCheckedChange={(checked) =>
                      void run(() => api().setRule(rule.docKind, rule.signatoryId, checked === true), tRoot("saved"))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function Preview({ data, api }: { data: Branding; api: Api }) {
  const t = useTranslations("docBranding.preview");
  const tRules = useTranslations("docBranding.rules");
  const [kind, setKind] = useState<DocKind>(data.rules[0]?.docKind ?? "tax_invoice");
  const [busy, setBusy] = useState(false);
  return (
    <SectionCard title={t("title")} body={t("body")}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tRules("docKind")} className="min-w-64">
          <SearchableSelect
            value={kind}
            onValueChange={(value) => setKind(value as DocKind)}
            options={data.rules.map((rule) => ({ value: rule.docKind, label: tRules(`kinds.${rule.docKind}`) }))}
          />
        </Field>
        <Button
          variant="secondary"
          iconStart="eye"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const link = await api().preview(kind);
              window.open(link.url, "_blank", "noopener");
            } catch (caught) {
              toast.error(problemMessage(caught, t("failed")));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("open")}
        </Button>
      </div>
    </SectionCard>
  );
}

function History({ data }: { data: Branding }) {
  const t = useTranslations("docBranding.history");
  const tKinds = useTranslations("docBranding.rules.kinds");
  const format = useFormat();
  const detail = (h: Schemas["BrandingHistoryDto"]) => {
    if (h.change === "rule") return tKinds(h.detail as DocKind);
    if (h.detail === "set") return t("set");
    if (h.detail === "removed") return t("removed");
    if (h.detail === "withdrawn") return t("withdrawn");
    return h.detail;
  };
  return (
    <SectionCard title={t("title")}>
      {data.history.length === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {data.history.map((h, index) => (
            <li key={`${h.at}-${index}`} className="flex flex-wrap gap-x-2">
              <span className="text-muted tabular-nums">{format.dateTime(h.at)}</span>
              <span className="font-medium">{t(`changes.${h.change}` as "changes.logo")}</span>
              <span>{detail(h)}</span>
              {h.by ? <span className="text-muted">· {h.by}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
