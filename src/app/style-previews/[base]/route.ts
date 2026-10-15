import { variantPreviewSvg } from "@/features/customer/styles/preview.server";

/** A blank, so a variant the engine cannot draw shows its card's plate rather than a broken image. */
const BLANK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"/>';
const BASE = /^PK-[A-Z]+-\d{2}$/;

/**
 * `/style-previews/<base>?<axis>=<value>…` (D-410): a variant's flat dieline as an SVG image for the
 * library's cards, until packio-api renders its thumbnail. Public, cached a week: the drawing changes
 * only with the engine. Outside `[locale]`, like the BFF (the proxy lets it through).
 */
export async function GET(request: Request, { params }: { params: Promise<{ base: string }> }) {
  const { base } = await params;
  const options: Record<string, string | string[]> = {};
  for (const [axis, value] of new URL(request.url).searchParams)
    if (/^[a-z_]{1,30}$/.test(axis) && /^[a-z0-9_+]{1,60}$/.test(value))
      options[axis] = value.includes("+") ? value.split("+") : value;
  const svg = BASE.test(base) ? variantPreviewSvg(base, options) : null;
  return new Response(svg ?? BLANK, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": svg ? "public, max-age=604800, stale-while-revalidate=86400" : "public, max-age=300",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
