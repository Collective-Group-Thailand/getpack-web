import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AdminDesigner } from "@/features/admin/prepress/AdminDesigner";
import { requireActor, signInUrl } from "@/features/shared/auth/guard";
import { isApiError } from "@/lib/api/problem";
import { serverRequests } from "@/lib/api/requests/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("designer.meta"))("title") };
}

/**
 * A design in the designer, for prepress (F4 C.2): a customer's document read-only, a staff
 * member's own copy editable — the same components the storefront uses. Full screen, so it sits
 * outside the console shell, behind the same guard.
 */
export default async function AdminDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor("admin");
  if (!actor) redirect(await signInUrl());
  const [{ documentId }, query] = await Promise.all([params, searchParams]);
  let read;
  try {
    read = await (
      await serverRequests("admin")
    ).read("GET /v1/admin/design-documents/{documentId}", { path: { documentId } });
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  // Back to where prepress came from, when that is one of its own pages.
  const from = typeof query.from === "string" && /^\/prepress(\/[\w-]+)?$/.test(query.from) ? query.from : "/prepress";
  return <AdminDesigner document={read.data} etag={read.etag} exitHref={from} />;
}
