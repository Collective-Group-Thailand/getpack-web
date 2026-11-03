import { NextResponse, type NextRequest } from "next/server";

import { AGENT_COOKIE, AGENT_COOKIE_MAX_AGE } from "@/features/customer/agent/cookie";
import { getSharedQuote } from "@/features/customer/catalog/api.server";

/**
 * A quote an agent sent from getpack Agent (D-468 §2): `/q/{token}` is the link, and when it is a store quotation (not
 * a factory's quotation link, D-360) the page sends the browser here. The API answers with the code of the agent who
 * sent it (`SharedQuoteDto.agentCode`), and the browser keeps it exactly as `/a/{code}` does — the same cookie, the
 * same lifetime — so signing up claims the link and converts the lead (D-417). Then the quotation opens in the
 * configurator as any shared quote does (`?share=`).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const prefix = locale === "en" ? "/en" : "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.redirect(new URL(`${prefix}/`, request.url));
  const shared = await getSharedQuote(token);
  const slug = shared?.summary.product?.slug;
  if (!shared || !slug) return NextResponse.redirect(new URL(`${prefix}/q/${token}?gone=1`, request.url));
  const response = NextResponse.redirect(
    new URL(`${prefix}/configure/${encodeURIComponent(slug)}?share=${encodeURIComponent(token)}`, request.url),
  );
  const code = (shared as { agentCode?: string | null }).agentCode?.trim().toUpperCase();
  if (code && /^[A-Z0-9]{6,12}$/.test(code)) {
    response.cookies.set(AGENT_COOKIE, code, {
      maxAge: AGENT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      httpOnly: false,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
