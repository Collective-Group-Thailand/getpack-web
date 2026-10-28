"use client";

import { useEffect, useRef } from "react";

/**
 * After a submit that found errors, focus moves to the first invalid field (checkout redesign acceptance, WCAG 3.3.1):
 * the field's `aria-describedby` names its error, so the error is announced as the field is reached. Pass the errors
 * object the submit set — a new object per submit, so a second failed submit moves focus again.
 */
export function useFocusFirstInvalid<T extends HTMLElement = HTMLFormElement>(errors: object) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (Object.keys(errors).length === 0) return;
    const target = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  }, [errors]);
  return ref;
}
