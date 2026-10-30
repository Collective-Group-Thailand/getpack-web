/**
 * The style library's frame: the page, and the `@modal` slot where the comparison opens over the grid when the
 * library links to it (`@modal/(.)compare`, owner redesign 2026-10-30). A shared compare link renders the page.
 */
export default function StylesLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
