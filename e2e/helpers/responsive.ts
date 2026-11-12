import type { Page } from "@playwright/test";

/**
 * The P7 responsive audit (e2e/agent-portal-p7-responsive.spec.ts) at the page's current width, in one pass through
 * the DOM: page sideways scroll; visible elements past the viewport's sides outside a sideways-scrolling container;
 * bottom fixed bars without safe-area padding or covering the last content; clipped h1 / h2. Returns one line per
 * finding (empty: clean).
 */
export async function auditWidth(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const findings: string[] = [];
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth)
      findings.push(`page scrolls sideways by ${doc.scrollWidth - doc.clientWidth}px`);

    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` "${text}"` : ""}`;
    };
    const hiddenByTree = (el: Element) =>
      Boolean(el.closest("[inert], [aria-hidden='true'], [hidden], [data-sonner-toaster]"));
    const isVisible = (el: Element, style: CSSStyleDeclaration, rect: DOMRect) => {
      if (rect.width < 2 || rect.height < 2) return false;
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
      // Visually hidden (sr-only): a 1px box with a clip.
      if (style.position === "absolute" && rect.width <= 1 && rect.height <= 1) return false;
      if (style.clip && style.clip !== "auto") return false;
      return !hiddenByTree(el);
    };
    /**
     * Whether what is visible of the element stays on screen: an ancestor that scrolls sideways holds it on purpose
     * (unless it is a page-level wrapper holding the main landmark or the title); one that clips it (a truncated line,
     * a card with overflow hidden) cuts its visible part to its own box, which then has to be on screen; a fixed layer
     * parked off-canvas (a closed drawer) is not shown.
     */
    const contained = (el: Element, rect: DOMRect) => {
      let left = rect.left;
      let right = rect.right;
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        if (style.position === "fixed" && (box.right <= 0 || box.left >= vw)) return true;
        if (style.overflowX === "visible") continue;
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && !node.querySelector("main, h1")) {
          if (box.left >= -1 && box.right <= vw + 1) return true;
        }
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
        if (right <= left) return true;
      }
      return left >= -1 && right <= vw + 1;
    };

    // 2 · elements past the viewport's sides
    const offenders: string[] = [];
    const reported = new Set<Element>();
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right <= vw + 1 && rect.left >= -1) continue;
      const style = getComputedStyle(el);
      if (!isVisible(el, style, rect)) continue;
      if (style.position === "fixed" && (rect.right <= 0 || rect.left >= vw)) continue;
      if (contained(el, rect)) continue;
      // Report the outermost offender only: its children follow it off-screen.
      reported.add(el);
      let inner = false;
      for (let node = el.parentElement; node; node = node.parentElement) if (reported.has(node)) inner = true;
      if (inner) continue;
      offenders.push(describe(el));
    }
    for (const one of offenders.slice(0, 5)) findings.push(`overflows the viewport: ${one}`);

    // 4 · clipped headings
    for (const h of Array.from(document.querySelectorAll("h1, h2"))) {
      const el = h as HTMLElement;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!isVisible(el, style, rect)) continue;
      if (el.scrollWidth > el.clientWidth + 1)
        findings.push(`heading clipped (${el.scrollWidth} > ${el.clientWidth}): ${describe(el)}`);
    }

    // 3 · fixed bars along the bottom: safe-area padding and the last content above them
    const safeRules: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && rule.cssText.includes("safe-area-inset-bottom")) safeRules.push(rule);
        if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* a cross-origin sheet: not ours */
      }
    }
    const padsSafeArea = (el: Element) =>
      [el, ...Array.from(el.querySelectorAll("*"))].some((node) =>
        safeRules.some((rule) => {
          try {
            return node.matches(rule.selectorText);
          } catch {
            return false;
          }
        }),
      );
    const bars = Array.from(document.body.querySelectorAll("*")).filter((el) => {
      const style = getComputedStyle(el);
      if (style.position !== "fixed") return false;
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, style, rect)) return false;
      if (el.closest("[role='dialog'], [role='alertdialog'], [data-sonner-toaster]")) return false;
      return rect.bottom >= vh - 2 && rect.width >= vw * 0.6 && rect.height < vh * 0.4;
    });
    if (bars.length) {
      for (const bar of bars)
        if (!padsSafeArea(bar)) findings.push(`bottom bar without safe-area padding: ${describe(bar)}`);
      const barTop = Math.min(...bars.map((bar) => bar.getBoundingClientRect().top));
      window.scrollTo(0, doc.scrollHeight);
      const layered = (el: Element) => {
        for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
          const position = getComputedStyle(node).position;
          if (position === "fixed" || position === "sticky") return true;
        }
        return false;
      };
      let lastBottom = 0;
      let last: Element | null = null;
      for (const el of Array.from(
        document.body.querySelectorAll("a, button, input, select, textarea, p, li, h1, h2, h3, td, th, dd, label"),
      )) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (!isVisible(el, style, rect) || layered(el)) continue;
        if (rect.bottom > lastBottom) {
          lastBottom = rect.bottom;
          last = el;
        }
      }
      if (last && lastBottom > barTop + 1)
        findings.push(
          `last content hidden behind the bottom bar by ${Math.round(lastBottom - barTop)}px: ${describe(last)}`,
        );
      window.scrollTo(0, 0);
    }
    if (sessionStorage.getItem("p7-debug")) console.info(`p7-audit bars=${bars.length} safeRules=${safeRules.length}`);
    return findings;
  });
}
