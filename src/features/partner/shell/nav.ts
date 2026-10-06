/** Whether `href` is the current section for `pathname` (the home item matches only itself). */
export const isCurrent = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
