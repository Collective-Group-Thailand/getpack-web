import { NextResponse, type NextRequest } from "next/server";

import { AGENT_COOKIE, AGENT_COOKIE_MAX_AGE } from "@/features/customer/agent/cookie";

/**
 * The link packio-api hands an agent (`store.agent.me` → `link`, `${STOREFRONT_BASE_URL}/a/{code}`,
 * D-417): the visitor's browser keeps the code, and once they are signed in the storefront claims it
 * for the agent (`store.agent.claimLink`). The code is not a secret, so the cookie is readable by the
 * page; it never decides anything — the API does.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  const clean = code.trim().toUpperCase();
  const home = new URL(locale === "en" ? "/en" : "/", request.url);
  const response = NextResponse.redirect(home);
  if (/^[A-Z0-9]{6,12}$/.test(clean)) {
    response.cookies.set(AGENT_COOKIE, clean, {
      maxAge: AGENT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      httpOnly: false,
    });
  }
  return response;
}
