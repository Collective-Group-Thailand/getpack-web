"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { problemMessage } from "@/features/shared/actions";
import { uploadFile } from "@/features/shared/files/upload";
import { newIdempotencyKey } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import type { CapturedPhoto } from "@/ui/components/CameraCapture";
import { toast } from "@/ui/components/Toast";

import { useRefresh } from "./client";

/** Now in Bangkok, the offset the API renders (api-conventions §3). */
export const bangkokNow = () => `${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19)}+07:00`;

/**
 * One report from this device (B4.2, schema-design `client_ref`): the id the API dedupes the
 * report by, when it was made here, and the `Idempotency-Key` for the request. Minted **once per
 * intent** and kept across a retry, so a report that timed out and is sent again is the same
 * report, never a second one.
 */
export function newReport() {
  const clientRef = newIdempotencyKey();
  return { idempotencyKey: clientRef, stamp: { clientRef, clientReportedAt: bangkokNow() } };
}

/** Uploads the photos one after another (a phone on 4G), returning their file ids in order. */
export async function uploadPhotos(photos: CapturedPhoto[], factoryId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const photo of photos) ids.push((await uploadFile("partner", photo.file, "evidence", { factoryId })).id);
  return ids;
}

export type FieldErrors = Record<string, string>;

/**
 * Runs a shop-floor write the way B4.2 asks: on success the screen re-renders with the server's
 * state; on a `409` — another device reported first, or the job moved on — it says so and shows
 * the server's state too ("server wins"); a `422` comes back as field errors to show beside the
 * inputs, the input kept.
 */
export function useFloorAction() {
  const t = useTranslations("partnerJobs.floor");
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function run(act: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setErrors({});
    try {
      await act();
      toast.success(success);
      refresh();
      return true;
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        toast.error(error.detail || t("conflict"));
        refresh();
      } else if (isApiError(error) && error.status === 422 && error.errors.length) {
        setErrors(Object.fromEntries(error.errors.map((item) => [item.path, item.message])));
        toast.error(error.detail || t("invalid"));
      } else {
        toast.error(problemMessage(error, t("failed")));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, errors };
}
