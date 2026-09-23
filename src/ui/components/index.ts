/**
 * The component surface every zone imports (`@/ui`). Extending the design system means
 * editing a file in here — never restyling a primitive in a feature folder
 * (design-system.md §1.8).
 */

export { AlertDialog, type AlertDialogProps } from "./AlertDialog";
export { AppShell, type AppShellProps } from "./AppShell";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Callout, type CalloutProps } from "./Callout";
export { Card, CardDescription, CardFooter, CardHeader, CardTitle, type CardProps } from "./Card";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { ColorField, type ColorFieldProps } from "./ColorField";
export { Dialog, DialogClose, type DialogProps } from "./Dialog";
export { DropdownMenu, type DropdownMenuProps, type MenuItem } from "./DropdownMenu";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { Field, FormSection, useFieldGroupProps, useFieldProps, type FieldProps } from "./Field";
export { FormField, type FormFieldProps } from "./FormField";
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
export { Kbd, type KbdProps } from "./Kbd";
export { Popover, type PopoverProps } from "./Popover";
export { RadioCards, type RadioCardOption, type RadioCardsProps } from "./RadioCards";
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./SegmentedControl";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { Separator, type SeparatorProps } from "./Separator";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { Sheet, type SheetProps } from "./Sheet";
export { Slider, type SliderProps } from "./Slider";
export { Spinner, type SpinnerProps } from "./Spinner";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { Switch, type SwitchProps } from "./Switch";
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export { toast, Toaster } from "./Toast";
export { Tooltip, TooltipProvider, type TooltipProps } from "./Tooltip";
export { VisuallyHidden, type VisuallyHiddenProps } from "./VisuallyHidden";
