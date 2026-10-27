import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import common from "@/i18n/messages/th/common/common.json";

import { Composer } from "./ThreadView";

function renderComposer(onSend: () => Promise<void>) {
  return render(
    <NextIntlClientProvider locale="th" messages={{ common }}>
      <Composer label="ตอบลูกค้า" sendLabel="ส่งคำตอบ" onSend={onSend} />
    </NextIntlClientProvider>,
  );
}

describe("the composer", () => {
  it("clears what it sent", async () => {
    const user = userEvent.setup();
    renderComposer(async () => undefined);
    const box = screen.getByRole("textbox", { name: "ตอบลูกค้า" });
    await user.type(box, "สวัสดีค่ะ");
    await user.click(screen.getByRole("button", { name: "ส่งคำตอบ" }));
    expect(box).toHaveValue("");
  });

  it("keeps text typed while the send was still in flight", async () => {
    const user = userEvent.setup();
    let finish = () => {};
    renderComposer(() => new Promise<void>((resolve) => (finish = resolve)));
    const box = screen.getByRole("textbox", { name: "ตอบลูกค้า" });
    await user.type(box, "บันทึกแรก");
    await user.click(screen.getByRole("button", { name: "ส่งคำตอบ" }));
    await user.clear(box);
    await user.type(box, "ข้อความถัดไป");
    finish();
    await screen.findByRole("button", { name: "ส่งคำตอบ" });
    await expect.poll(() => (box as HTMLTextAreaElement).value).toBe("ข้อความถัดไป");
    expect(screen.getByRole("button", { name: "ส่งคำตอบ" })).toBeEnabled();
  });
});
