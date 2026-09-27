import { resolveStyleId } from "@packio/dieline";

import Editor, { type EditorSeed } from "@/features/designer/components/Editor";

export const metadata = { title: "ออกแบบกล่อง" };

/**
 * `?style=&l=&w=&h=` on a new design: the configurator's "design it now" (F3 3.2) opens the
 * setup with that box already filled in. Anything malformed is ignored — the setup still opens.
 */
function seedOf(query: Record<string, string | string[] | undefined>): EditorSeed | undefined {
  const style = typeof query.style === "string" ? resolveStyleId(query.style) : null;
  const mm = (value: unknown) => (typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : null);
  const [length, width, height] = [mm(query.l), mm(query.w), mm(query.h)];
  return style && length && width && height ? { style, dims: { length, width, height } } : undefined;
}

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <Editor id={id} seed={id === "new" ? seedOf(query) : undefined} />;
}
