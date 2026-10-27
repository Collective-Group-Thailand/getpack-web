/**
 * Products redesign Phase 2 item 4: which catalogue products have no box style mapped yet — a CSV
 * (`product_slug,style_code`) with the style column empty, for the business team to fill. Read-only:
 * public GETs of the store API only (products, each product's detail), nothing is written.
 *
 *   pnpm tsx scripts/product-style-gaps.ts --api https://uat-api.getpack.co > product-style-gaps.csv
 *
 * A product counts as mapped when its detail lists a published style (`styles`, getpack-api C1-API-4);
 * against an API without that field, a pattern's `styleCode` is used instead.
 */

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const api = (arg("api") ?? process.env.API_INTERNAL_URL ?? "").replace(/\/$/, "");
if (!api) {
  console.error("usage: pnpm tsx scripts/product-style-gaps.ts --api <store API base URL>");
  process.exit(2);
}

type Card = { slug: string };
type Detail = { slug: string; styles?: { code: string }[]; patterns?: { styleCode: string | null }[] };

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${api}${path}`, { headers: { accept: "application/json", "accept-language": "th" } });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return (await response.json()) as T;
}

async function main() {
  const slugs: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, meta } = await get<{ data: Card[]; meta: { total: number; perPage: number } }>(
      `/v1/store/catalog/products?perPage=100&page=${page}`,
    );
    slugs.push(...data.map((card) => card.slug));
    if (page * meta.perPage >= meta.total) break;
  }
  const rows = ["product_slug,style_code"];
  for (const slug of slugs) {
    const detail = await get<Detail>(`/v1/store/catalog/products/${encodeURIComponent(slug)}`);
    const mapped = detail.styles?.length
      ? true
      : (detail.patterns ?? []).some((pattern) => typeof pattern.styleCode === "string" && pattern.styleCode !== "");
    if (!mapped) rows.push(`${slug},`);
  }
  process.stdout.write(`${rows.join("\n")}\n`);
  console.error(`${slugs.length} products read, ${rows.length - 1} without a style`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
