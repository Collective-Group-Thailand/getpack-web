import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation. Use these instead of the
// Next primitives inside the customer zone so `/en` is preserved across navigations.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
