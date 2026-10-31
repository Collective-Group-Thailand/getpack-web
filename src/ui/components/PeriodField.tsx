"use client";

import { useState } from "react";

import { DateField } from "./DateField";
import { Input } from "./Input";

/**
 * A month or date field of a GET period form: at rest it reads in the page's calendar (`display`, formatted by the
 * caller — "ตุลาคม 2569"), not the browser's ("October 2026"). Once changed, the label the server formatted no longer
 * matches the value, so the field shows the browser's own until the form is sent and the page comes back with it.
 */
export function PeriodField({
  type,
  name,
  defaultValue,
  display,
  className,
}: {
  type: "date" | "month";
  name: string;
  defaultValue: string;
  display: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const changed = value !== defaultValue;
  return changed ? (
    <Input type={type} name={name} value={value} onChange={(e) => setValue(e.target.value)} className={className} />
  ) : (
    <DateField
      type={type}
      name={name}
      value={value}
      display={display}
      onChange={(e) => setValue(e.target.value)}
      className={className}
    />
  );
}
