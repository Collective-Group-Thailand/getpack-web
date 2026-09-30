import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ActorProvider } from "@/features/admin/console/actor";
import { adminServerApis } from "@/features/admin/console/api.server";
import { AdminDesigner } from "@/features/admin/prepress/AdminDesigner";
import { requireActor, signInUrl } from "@/features/shared/auth/guard";
import { isApiError } from "@/lib/api/problem";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("designer.meta"))("title") };
}

/**
 * A design in the designer, for the back office (F4 C.2, `admin.designs.get` with its ETag) — the
 * same components the storefront uses. Full screen, so it sits outside the console shell, behind
 * the same guard.
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
    const { contract } = await adminServerApis();
    const { data, response } = await contract.GET("/v1/admin/designs/{designId}", {
      params: { path: { designId: documentId } },
    });
    read = { data: data!, etag: response.headers.get("etag") };
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  // Back to where prepress came from, when that is one of its own pages.
  const from = typeof query.from === "string" && /^\/prepress(\/[\w-]+)?$/.test(query.from) ? query.from : "/prepress";
  return (
    <ActorProvider actor={actor}>
      <AdminDesigner document={read.data} etag={read.etag} exitHref={from} />
    </ActorProvider>
  );
}
