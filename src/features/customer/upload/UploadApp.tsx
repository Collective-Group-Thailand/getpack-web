"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { SignInSheet } from "@/features/customer/auth/SignInSheet";
import { uploadFile } from "@/features/shared/files/upload";
import { usePathname, useRouter } from "@/i18n/navigation";
import { trackUpload } from "@/lib/analytics";
import { isApiError } from "@/lib/api/browser";
import { toast } from "@/ui/components/Toast";

import {
  addFile,
  checkKey,
  createCheck,
  removeVariant,
  updateSpec,
  useConfigurator,
  useFileCheck,
  useFileCheckRules,
} from "./api";
import { DropZone, type UploadProgress } from "./DropZone";
import { mimeOf, refusalOf, sizeMb, takeHandedFiles } from "./files";
import { ReorderBox } from "./ReorderBox";
import { SummaryCard } from "./SummaryCard";
import { templateStyleOf } from "./template";
import { TemplateBox } from "./TemplateBox";
import type { UploadProduct } from "./types";
import { Workspace } from "./Workspace";

/**
 * `/studio/upload`'s interactive part (upload redesign Phase 1 → 2): start (drop zone, template downloader, reorder)
 * until a file is uploaded, then the check workspace beside the spec & price card. The check's id is in the address
 * (`?check=`), so a reload or a shared tab comes back to it. Uploading needs an account (the files are the customer's
 * own, D-444): a guest signs in over the page and the chosen files go on uploading — the files never leave the page
 * meanwhile. Files dropped on `/studio` arrive here as files (C7 → C9 hand-off).
 */
export function UploadApp({
  products,
  signedIn: signedInAtLoad,
  handedFileName,
}: {
  products: UploadProduct[];
  signedIn: boolean;
  handedFileName: string | null;
}) {
  const t = useTranslations("studio.upload");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(signedInAtLoad);
  const [signIn, setSignIn] = useState<{ files: File[]; source: "drop" | "picker" } | null>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [localFiles, setLocalFiles] = useState<ReadonlyMap<string, File>>(new Map());
  const [active, setActive] = useState(1);
  const checkId = search.get("check");
  const rules = useFileCheckRules();
  const check = useFileCheck(signedIn ? checkId : null);
  const configurator = useConfigurator(check.data?.spec.productSlug ?? null);
  const reported = useRef(new Set<string>());

  const maxBytes = rules.data?.maxBytes ?? null;

  const upload = useCallback(
    async (files: File[], source: "drop" | "picker", variantNo?: number) => {
      const accepted: File[] = [];
      for (const file of files) {
        const refusal = refusalOf(file, maxBytes);
        if (refusal) {
          toast.error(t(`refused.${refusal}`, { name: file.name }));
          trackUpload("upload_fail", { reason: refusal === "type" ? "type" : "size" });
        } else accepted.push(file);
      }
      if (!accepted.length) return;
      if (!signedIn) {
        setSignIn({ files: accepted, source });
        return;
      }
      trackUpload("upload_start", { source, files: accepted.length });
      const keyed = accepted.map((file, index) => ({ file, key: `${Date.now()}-${index}` }));
      setUploads((prev) => [
        ...prev,
        ...keyed.map(({ file, key }) => ({ key, name: file.name, sent: 0, total: file.size })),
      ]);
      const ids: string[] = [];
      const kept = new Map<string, File>();
      for (const { file, key } of keyed) {
        try {
          const named = file.type ? file : new File([file], file.name, { type: mimeOf(file) });
          const stored = await uploadFile("customer", named, "artwork", {
            waitForScan: false,
            onProgress: (sent, total) =>
              setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, sent, total } : u))),
          });
          ids.push(stored.id);
          kept.set(stored.id, file);
          trackUpload("upload_done", { size_mb: sizeMb(file.size) });
        } catch {
          setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, failed: t("drop.failed") } : u)));
          trackUpload("upload_fail", { reason: "network" });
        }
      }
      if (!ids.length) return;
      setLocalFiles((prev) => new Map([...prev, ...kept]));
      try {
        let next;
        if (checkId && check.data) {
          next = check.data;
          if (variantNo !== undefined) next = await addFile(checkId, { fileId: ids[0]!, variantNo });
          else for (const fileId of ids) next = await addFile(checkId, { fileId });
          queryClient.setQueryData(checkKey(checkId), next);
          setActive(variantNo ?? next.variants.at(-1)!.variantNo);
        } else {
          next = await createCheck({ fileIds: ids });
          queryClient.setQueryData(checkKey(next.id), next);
          setActive(1);
          router.replace(`${pathname}?check=${next.id}`, { scroll: false });
        }
        setUploads([]);
      } catch (error) {
        toast.error(isApiError(error) ? error.detail : t("drop.failed"));
        trackUpload("upload_fail", { reason: "check" });
      }
    },
    [maxBytes, signedIn, t, checkId, check.data, queryClient, router, pathname],
  );

  // Files dropped on /studio's "มีไฟล์แบบแล้ว" arrive as files.
  const handed = useRef(false);
  useEffect(() => {
    if (handed.current || rules.isPending) return;
    handed.current = true;
    const files = takeHandedFiles();
    if (files.length) setTimeout(() => void upload(files, "drop"), 0);
  }, [rules.isPending, upload]);

  // A version that finished its check, once.
  useEffect(() => {
    for (const v of check.data?.variants ?? []) {
      const report = v.current.report;
      if (v.current.status !== "done" || !report || reported.current.has(v.current.id)) continue;
      reported.current.add(v.current.id);
      trackUpload("preflight_done", { errors: report.counts.mustFix, warnings: report.counts.review, auto: 0 });
      const match = v.current.detection?.match;
      const spec = check.data!.spec;
      if (match && spec.productSlug && spec.productSlug !== match.productSlug)
        trackUpload("detect_mismatch", { type: "product" });
      else if (match && spec.sizeCode && spec.sizeCode !== match.sizeCode)
        trackUpload("detect_mismatch", { type: "size" });
    }
  }, [check.data]);

  const onSpec = async (patch: Parameters<typeof updateSpec>[1]) => {
    if (!checkId) return;
    try {
      queryClient.setQueryData(checkKey(checkId), await updateSpec(checkId, patch));
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("drop.failed"));
    }
  };

  const onRemove = async (variantNo: number) => {
    if (!checkId) return;
    try {
      const next = await removeVariant(checkId, variantNo);
      if (!next.variants.length) {
        router.replace(pathname, { scroll: false });
        queryClient.removeQueries({ queryKey: checkKey(checkId) });
        return;
      }
      queryClient.setQueryData(checkKey(checkId), next);
      setActive(next.variants[0]!.variantNo);
    } catch (error) {
      toast.error(isApiError(error) ? error.detail : t("drop.failed"));
    }
  };

  const sheet = (
    <SignInSheet
      open={signIn !== null}
      onOpenChange={(open) => {
        if (!open) setSignIn(null);
      }}
      onSignedIn={() => {
        const pending = signIn;
        setSignIn(null);
        setSignedIn(true);
        router.refresh();
        if (pending) setTimeout(() => void upload(pending.files, pending.source), 0);
      }}
    />
  );

  if (checkId && signedIn && check.data) {
    const cfg = configurator.data ?? null;
    return (
      <div className="mt-6 grid items-start gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_22.5rem]">
        <Workspace
          check={check.data}
          configurator={cfg}
          boxStyle={cfg ? templateStyleOf(cfg) : null}
          localFiles={localFiles}
          active={active}
          onActive={setActive}
          onAddFiles={(files, variantNo) => void upload(files, "picker", variantNo)}
          onRemove={(variantNo) => void onRemove(variantNo)}
          onSpec={(patch) => void onSpec(patch)}
        />
        <SummaryCard check={check.data} products={products} configurator={cfg} />
        {uploads.length ? (
          <p className="text-muted m-0 text-sm min-[1100px]:col-span-2" aria-live="polite">
            {t("drop.uploadingMore", { count: uploads.length })}
          </p>
        ) : null}
        {sheet}
      </div>
    );
  }

  return (
    <>
      {handedFileName && !uploads.length ? (
        <p className="border-primary bg-primary-subtle rounded-card mt-5 border px-4 py-3 text-sm" role="status">
          {t("fileChosen", { name: handedFileName })}
        </p>
      ) : null}
      <div className="mt-6 grid gap-5 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DropZone maxBytes={maxBytes} uploads={uploads} onFiles={(files, source) => void upload(files, source)} />
        <TemplateBox products={products} bleedMm={rules.data?.bleedMm ?? null} />
      </div>
      <ReorderBox signedIn={signedIn} />
      {sheet}
    </>
  );
}
