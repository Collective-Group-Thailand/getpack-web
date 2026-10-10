"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRefresh } from "@/features/partner/client";
import { problemMessage } from "@/features/shared/actions";
import { isApiError } from "@/lib/api/problem";
import { toast } from "@/ui/components/Toast";

/**
 * One mutation of an ERP screen (E2): busy while it runs, a toast with what happened, the page re-read
 * afterwards; a 412 says the record changed under the user and reloads it. Returns the result, or
 * `undefined` when it failed (the toast has said why).
 */
export function useErpCall() {
  const tCommon = useTranslations("partnerErp.common");
  const [refresh] = useRefresh();
  const [busy, setBusy] = useState(false);
  async function call<T>(work: () => Promise<T>, done?: string, options: { refresh?: boolean } = {}) {
    setBusy(true);
    try {
      const result = await work();
      if (done) toast.success(done);
      if (options.refresh !== false) refresh();
      return result;
    } catch (error) {
      const stale = isApiError(error) && error.status === 412;
      toast.error(stale ? tCommon("stale") : problemMessage(error, tCommon("failed")));
      if (stale) refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { call, busy };
}
