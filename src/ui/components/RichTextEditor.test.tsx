import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RichTextEditor } from "./RichTextEditor";

const labels = {
  toolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  heading2: "Heading",
  heading3: "Subheading",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  quote: "Quote",
  undo: "Undo",
  redo: "Redo",
};

describe("RichTextEditor", () => {
  it("shows its whole toolbar as soon as it mounts, before anything is typed", async () => {
    render(<RichTextEditor value={null} onChange={vi.fn()} label="Body" labels={labels} />);
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    await waitFor(() => expect(toolbar.querySelectorAll("button")).toHaveLength(9));
    // Toggles say whether they are on; undo and redo have nothing to undo yet.
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("names the editing area as a multi-line text box and renders the stored document", async () => {
    render(
      <RichTextEditor
        value={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "สวัสดี" }] }] }}
        onChange={vi.fn()}
        label="Thai body"
        labels={labels}
      />,
    );
    const box = await screen.findByRole("textbox", { name: "Thai body" });
    expect(box).toHaveAttribute("aria-multiline", "true");
    expect(box).toHaveTextContent("สวัสดี");
  });
});
