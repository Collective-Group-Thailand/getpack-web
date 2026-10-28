import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useFocusFirstInvalid } from "./focus-first-invalid";

function Form() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ref = useFocusFirstInvalid(errors);
  return (
    <form
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({ phone: "required", name: "required" });
      }}
    >
      <input aria-label="name" aria-invalid={errors.name ? true : undefined} />
      <input aria-label="phone" aria-invalid={errors.phone ? true : undefined} />
      <button type="submit">save</button>
    </form>
  );
}

describe("useFocusFirstInvalid", () => {
  it("moves focus to the first invalid field after a failed submit, not on mount", () => {
    render(<Form />);
    expect(document.activeElement).toBe(document.body);
    screen.getByRole("button", { name: "save" }).click();
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "name" }));
        resolve();
      }, 0),
    );
  });
});
