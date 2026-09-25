import "server-only";

import { getLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

import { bindFormat, type BoundFormat } from "./bind";

/** `useFormat` for Server Components. */
export async function getFormat(): Promise<BoundFormat> {
  return bindFormat((await getLocale()) as Locale);
}
