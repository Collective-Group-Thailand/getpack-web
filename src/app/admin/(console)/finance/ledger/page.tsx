import { redirect } from "next/navigation";

/** The general ledger opens on its journals. */
export default function Page() {
  redirect("/finance/ledger/journals");
}
