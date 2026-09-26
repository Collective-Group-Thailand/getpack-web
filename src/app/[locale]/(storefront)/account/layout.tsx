import { cookies } from "next/headers";

import { AccountNav } from "@/features/customer/account/AccountNav";
import { readAccessToken } from "@/lib/auth/session";

/**
 * The account's frame (F3 3.4): its sections beside every account page once signed in. Each page
 * still guards itself — `/account/designs` is also a guest's (designs are kept in the browser) —
 * so the layout only decides whether to show the sections, from the session cookie's presence.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(readAccessToken(await cookies()));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {signedIn ? (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <AccountNav />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
