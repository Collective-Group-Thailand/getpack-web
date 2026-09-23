import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand";

/** Minimal footer until F1 brings the real one (links, legal, contact, payment marks). */
export function SiteFooter() {
  return (
    <footer className="border-border text-muted border-t py-6 text-center text-sm">
      © {new Date().getFullYear()} {BRAND_NAME} · {BRAND_COMPANY}
    </footer>
  );
}
