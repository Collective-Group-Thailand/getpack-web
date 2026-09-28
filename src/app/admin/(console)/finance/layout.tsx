import { FinanceNav } from "@/features/admin/finance/nav";

/**
 * The finance workspace (F6): its desks beside the work on a wide screen, as one scrolling row on
 * a phone. The console layout above already holds the session guard and the actor.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row">
      <FinanceNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
