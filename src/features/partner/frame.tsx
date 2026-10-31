/**
 * The partner frame now lives in shared code (the admin console uses the same pieces); these names stay so the
 * partner pages keep their imports.
 */
export { ActionPanel, DetailLayout as PartnerDetail } from "@/ui/components/DetailLayout";
export {
  DeskPage as PartnerPage,
  DeskSection as PartnerSection,
  StatsRow as PartnerStats,
  type SummaryItem,
} from "@/ui/components/DeskPage";
export { PageError } from "@/features/shared/errors/PageError";
