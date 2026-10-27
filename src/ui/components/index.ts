/**
 * The component surface every zone imports (`@/ui`). Extending the design system means
 * editing a file in here — never restyling a primitive in a feature folder
 * (design-system.md §1.8).
 */

export { AlertDialog, type AlertDialogProps } from "./AlertDialog";
export { AppShell, type AppShellProps } from "./AppShell";
export { Avatar, type AvatarProps } from "./Avatar";
export { Breadcrumbs, type BreadcrumbsProps, type Crumb } from "./Breadcrumbs";
export {
  CommandPalette,
  useCommandPaletteShortcut,
  useModKey,
  type CommandItem,
  type CommandPaletteProps,
} from "./CommandPalette";
export {
  ShortcutsOverlay,
  useShortcutsOverlayShortcut,
  type Shortcut,
  type ShortcutsOverlayProps,
} from "./ShortcutsOverlay";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Callout, type CalloutProps } from "./Callout";
export { CouponDivider, CouponFrame, CouponSavingRow, type CouponFrameProps } from "./CouponFrame";
export { Card, CardDescription, CardFooter, CardHeader, CardTitle, type CardProps } from "./Card";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { ColumnToggle, type ColumnToggleProps } from "./ColumnToggle";
export { Combobox, type ComboboxOption, type ComboboxProps } from "./Combobox";
export { ColorField, type ColorFieldProps } from "./ColorField";
export {
  DataTable,
  type DataTableColumn,
  type DataTableLabels,
  type DataTableProps,
  type DataTableSort,
  type RowTone,
} from "./DataTable";
export { DescriptionList, type DescriptionItem, type DescriptionListProps } from "./DescriptionList";
export {
  DimensionInput,
  fromMm,
  toMm,
  type DimensionAxis,
  type DimensionInputProps,
  type LengthUnit,
} from "./DimensionInput";
export { Highlight, IconTile, KraftPanel } from "./Decor";
export { Dialog, DialogClose, type DialogProps } from "./Dialog";
export { DisclosureList, type DisclosureItem, type DisclosureListProps } from "./DisclosureList";
export { DropdownMenu, type DropdownMenuProps, type MenuItem } from "./DropdownMenu";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { Field, FormSection, useFieldGroupProps, useFieldProps, type FieldProps } from "./Field";
export { FileDropzone, type FileDropzoneLabels, type FileDropzoneProps } from "./FileDropzone";
export { FormField, type FormFieldProps } from "./FormField";
export { ImageGallery, type GalleryImage, type ImageGalleryProps } from "./ImageGallery";
export { OTPInput, type OTPInputProps } from "./OTPInput";
export { normaliseThaiMobile, PhoneInput, TH_DIALLING_CODE, type PhoneInputProps } from "./PhoneInput";
export { IconButton, type IconButtonProps } from "./IconButton";
export {
  controlVariants,
  Input,
  NumberInput,
  Textarea,
  type InputProps,
  type NumberInputProps,
  type TextareaProps,
} from "./Input";
export { JsonView, type JsonViewProps } from "./JsonView";
export { isApplePlatform, Kbd, KEYCAP, type KbdProps } from "./Kbd";
export { MaterialSwatch, type MaterialSwatchProps } from "./MaterialSwatch";
export { Meter, type MeterProps } from "./Meter";
export { PageHeader, Toolbar, type PageHeaderProps } from "./PageHeader";
export { LinkPagination, pageWindow, type LinkPaginationProps } from "./LinkPagination";
export { Pagination, type PaginationLabels, type PaginationProps } from "./Pagination";
export { ProductCard, type ProductCardImage, type ProductCardProps } from "./ProductCard";
export { Popover, type PopoverProps } from "./Popover";
export {
  PriceBreakTable,
  PriceSummary,
  type PriceBreakRow,
  type PriceBreakTableProps,
  type PriceRow,
  type PriceSummaryProps,
} from "./PriceSummary";
export { QuoteDock, QuoteDockSpacer, type QuoteDockProps } from "./QuoteDock";
export { RadioCards, type RadioCardOption, type RadioCardsProps } from "./RadioCards";
export { RichTextView, safeHref, type RichTextNode, type RichTextViewProps } from "./RichTextView";
export { SearchInput, type SearchInputProps } from "./SearchInput";
export { SectionHeading, sectionLinkClass, type SectionHeadingProps } from "./SectionHeading";
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./SegmentedControl";
export { NativeSelect, type NativeSelectProps } from "./NativeSelect";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { SectionDivider, type SectionDividerProps } from "./SectionDivider";
export { Separator, type SeparatorProps } from "./Separator";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { SlaTimer, type SlaState, type SlaTimerProps } from "./SlaTimer";
export { Sheet, type SheetProps } from "./Sheet";
export { Slider, type SliderProps } from "./Slider";
export { Spinner, type SpinnerProps } from "./Spinner";
export { StepCard, type StepCardProps } from "./StepCard";
export {
  StepChips,
  scrollToStep,
  useActiveStep,
  type StepChip,
  type StepChipState,
  type StepChipsProps,
} from "./StepChips";
export { Stepper, type StepperLabels, type StepperProps, type StepperStep, type StepStatus } from "./Stepper";
export { Stat, type StatProps } from "./Stat";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { Switch, type SwitchProps } from "./Switch";
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export { TimeText, type TimeTextProps } from "./TimeText";
export { ProgressTracker, type ProgressStage, type ProgressState, type ProgressTrackerProps } from "./ProgressTracker";
export { ProgressRing } from "./ProgressRing";
export { Timeline, type TimelineItem, type TimelineProps } from "./Timeline";
export { toast, Toaster } from "./Toast";
export { Tooltip, TooltipProvider, type TooltipProps } from "./Tooltip";
export { VisuallyHidden, type VisuallyHiddenProps } from "./VisuallyHidden";
// The shop-floor set (design-system.md §3 "Partner/shop-floor"), built for F5 5.2.
export { BigActionButton, type BigActionButtonProps } from "./BigActionButton";
export { CameraCapture, type CameraCaptureLabels, type CameraCaptureProps, type CapturedPhoto } from "./CameraCapture";
export { LABEL_SIZES, LabelSheet, type LabelSheetProps, type LabelSize } from "./LabelSheet";
export { QRCode, type QRCodeProps } from "./QRCode";
export { ScanButton, type ScanButtonLabels, type ScanButtonProps } from "./ScanButton";
export { SignaturePad, type SignaturePadLabels, type SignaturePadProps } from "./SignaturePad";
export { StageStepper, type Stage, type StageState, type StageStepperProps } from "./StageStepper";
