import type { Locale } from "../routing";

/**
 * Messages are split per namespace (00-master-plan.md §3) and merged here.
 *
 * The imports are explicit rather than a glob so the bundler can see every file, and so a
 * missing namespace is a type error rather than a key that silently renders as `home.title`.
 * As zones arrive in F1 this gains `admin.json` and `partner.json`, loaded per zone.
 */
const NAMESPACES = ["common", "home", "designs", "designer"] as const;

export type Namespace = (typeof NAMESPACES)[number];

const LOADERS: Record<Locale, Record<Namespace, () => Promise<{ default: Record<string, unknown> }>>> = {
  th: {
    common: () => import("./th/common.json"),
    home: () => import("./th/home.json"),
    designs: () => import("./th/designs.json"),
    designer: () => import("./th/designer.json"),
  },
  en: {
    common: () => import("./en/common.json"),
    home: () => import("./en/home.json"),
    designs: () => import("./en/designs.json"),
    designer: () => import("./en/designer.json"),
  },
};

/** Namespaced messages for next-intl: `useTranslations("designer.setup")` and so on. */
export async function loadMessages(locale: Locale): Promise<Record<Namespace, Record<string, unknown>>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => [namespace, (await LOADERS[locale][namespace]()).default] as const),
  );
  return Object.fromEntries(entries) as Record<Namespace, Record<string, unknown>>;
}
