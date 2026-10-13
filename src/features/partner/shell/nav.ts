/** Whether `href` is the current section for `pathname` (the home item matches only itself). */
export const isCurrent = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The one item current for `pathname`: the longest matching href, so `/insight/costs` does not also light `/insight`. */
export const currentHref = (hrefs: readonly string[], pathname: string): string | undefined =>
  hrefs.filter((href) => isCurrent(href, pathname)).sort((a, b) => b.length - a.length)[0];
