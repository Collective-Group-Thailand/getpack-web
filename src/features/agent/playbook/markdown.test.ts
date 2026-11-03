import { describe, expect, it } from "vitest";

import { inlineOf, parseBlocks } from "./markdown";

describe("playbook card bodies", () => {
  it("reads paragraphs, bold, lists and a table", () => {
    const blocks = parseBlocks(
      "ราคาบนเว็บ **เท่ากัน** ทุกคน\n\n| ลูกค้าให้ | เหตุผล |\n|---|---|\n| เพิ่มจำนวน | ราคาต่อชิ้นลดลง |\n\n1. ถามสินค้า\n2. ถามจำนวน\n\n- ข้อหนึ่ง\n- ข้อสอง",
    );
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "table", "list", "list"]);
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      inline: [
        { text: "ราคาบนเว็บ ", bold: false },
        { text: "เท่ากัน", bold: true },
        { text: " ทุกคน", bold: false },
      ],
    });
    const table = blocks[1] as Extract<(typeof blocks)[number], { kind: "table" }>;
    expect(table.header.map((cell) => cell[0]?.text)).toEqual(["ลูกค้าให้", "เหตุผล"]);
    expect(table.rows).toHaveLength(1);
    expect((blocks[2] as { ordered: boolean }).ordered).toBe(true);
    expect((blocks[3] as { ordered: boolean }).ordered).toBe(false);
  });

  it("never turns markup into anything but text", () => {
    expect(inlineOf("<script>alert(1)</script>")).toEqual([{ text: "<script>alert(1)</script>", bold: false }]);
  });
});
