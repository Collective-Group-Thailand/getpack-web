"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { IconButton } from "@/ui/components/IconButton";

const SearchDialog = dynamic(() => import("./SearchDialog"), { ssr: false });

/**
 * The header's search control: a link to `/search` (works before, and without, JavaScript)
 * that opens the instant search instead once the page is interactive. The dialog's code is
 * fetched on the first open, not with the page.
 */
export function HeaderSearch({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <IconButton asChild name="search" variant="ghost" size="sm" label={label}>
        <Link
          href="/search"
          onClick={(event) => {
            // A modified click is someone opening the page in a new tab; let it.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setLoaded(true);
            setOpen(true);
          }}
        />
      </IconButton>
      {loaded ? <SearchDialog open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
