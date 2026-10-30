import { redirect } from "next/navigation";

/** The production orders are listed on the planning board; this address (a trimmed order link) opens it. */
export default function ProductionOrdersPage(): never {
  redirect("/planning");
}
