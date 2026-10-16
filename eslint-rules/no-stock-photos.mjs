/**
 * `getpack/no-stock-photos` — every photo on the storefront is getpack's own, served by the CMS
 * (Phase 4 §4.6; CLAUDE.md: never copy third-party assets). A stock-library address in the code
 * means a placeholder that can ship: this flags any string or template literal naming one.
 */

const STOCK = /(^|[/.@])(images\.)?(unsplash\.com|pexels\.com)\b|source\.unsplash|images\.pexels/i;

const noStockPhotos = {
  meta: {
    type: "problem",
    docs: { description: "Disallow stock-photo hosts (unsplash, pexels); photos come from the CMS." },
    messages: {
      stock:
        "Stock photos are not allowed ({{host}}). Photos come from the CMS (home sections, catalogue images) — Phase 4 §4.6.",
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      const match = typeof text === "string" ? STOCK.exec(text) : null;
      if (match) context.report({ node, messageId: "stock", data: { host: match[3] } });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked ?? node.value.raw),
      JSXText: (node) => check(node, node.value),
    };
  },
};

export default noStockPhotos;
