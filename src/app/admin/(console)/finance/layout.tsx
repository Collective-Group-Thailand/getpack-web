import { FinanceNav } from "@/features/admin/finance/nav";

/**
 * The finance workspace (F6). Its desks are nested under "การเงิน" in the main sidebar (`FinanceNav` hands them to the
 * shell), so the work keeps the full width of the page. The console layout above holds the session guard and actor.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FinanceNav />
      {children}
    </>
  );
}
