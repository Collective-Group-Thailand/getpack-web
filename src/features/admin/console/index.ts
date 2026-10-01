/**
 * The back-office building blocks (F2 §2), shared by every admin screen.
 *
 * Server-only pieces (`api.server.ts`, `prefetch.server.ts`) are imported by path.
 */

export { ActorProvider, useActor, useCan } from "./actor";
export { adminBrowserApis, type AdminApis } from "./api";
export { AssignDialog, type AssignDialogProps } from "./AssignDialog";
export { ConfirmAction, type ConfirmActionProps } from "./ConfirmAction";
export { ConsolePage } from "./ConsolePage";
export { CrudList, defineResource, type CrudListProps, type ResourceConfig } from "./crud";
export { download, pollUntil, StillPendingError } from "./download";
export { FormFields, type FieldDef } from "./fields";
export { FormDialog, FormError, Section } from "./FormDialog";
export { FilterControl, ListSearch, useDebouncedValue, type FilterDef } from "./filters";
export { actionVerb, NextActionBar, type NextActionBarProps } from "./NextActionBar";
export { parseListState, serialiseListState, toApiQuery, type ListDefaults, type ListState } from "./list-state";
export { problemMessage, QueryError } from "./QueryError";
export { QueueTabs, useQueues, type QueueTab } from "./queues";
export { asPage, defineList, shortRef, type InitialPage, type ListResource } from "./resource";
export { ResourceList, type ResourceListProps } from "./ResourceList";
export { SavedViews } from "./SavedViews";
export { SectionNav } from "./SectionNav";
export { useListState } from "./useListState";
export { useProductTypes } from "./useProductTypes";
export { useSlaFormat } from "./useSlaFormat";
export { useStaffDirectory } from "./useStaffDirectory";
export { useRoleLabel } from "./roles";
export { StatusChip } from "./StatusChip";
