import { type Query } from "@/features/customer/designer/seed";
import { redirect } from "@/i18n/navigation";

/**
 * `/design/[id]` is getpack 3D Studio now (U4.2: one route for the whole journey). Old links —
 * bookmarks, emails, a LINE message — land in the studio with everything they carried and the
 * step that fits: ③ for a saved design or a known box, ① otherwise.
 */
export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") next.set(key, value);
  if (!next.has("step")) next.set("step", id !== "new" || next.has("style") ? "design" : "start");
  redirect({ href: `/studio/${encodeURIComponent(id)}?${next.toString()}`, locale });
}
