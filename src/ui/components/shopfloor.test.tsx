import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { exifDateTimeOriginal, exifToIso } from "../lib/exif";
import { expectNoA11yViolations } from "../test/axe";
import { BigActionButton } from "./BigActionButton";
import { CameraCapture, type CapturedPhoto } from "./CameraCapture";
import { LabelSheet } from "./LabelSheet";
import { QRCode } from "./QRCode";
import { ScanButton } from "./ScanButton";
import { SignaturePad } from "./SignaturePad";
import { StageStepper } from "./StageStepper";

const STATES = { done: "เสร็จแล้ว", current: "ขั้นปัจจุบัน", upcoming: "ถัดไป", skipped: "ข้าม" };

describe("BigActionButton", () => {
  it("is one large named button with its consequence, and busy while loading", async () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <BigActionButton title="รับงาน" hint="เหลือเวลา 3 ชม." icon="check" onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: /รับงาน/ });
    expect(button).toHaveTextContent("เหลือเวลา 3 ชม.");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    await expectNoA11yViolations(container);
    rerender(<BigActionButton title="รับงาน" loading onClick={onClick} />);
    expect(screen.getByRole("button", { name: /รับงาน/ })).toBeDisabled();
  });
});

describe("StageStepper", () => {
  it("marks the current stage for a screen reader and shows only its action", async () => {
    const { container } = render(
      <StageStepper
        label="ขั้นตอนการผลิต"
        stateLabels={STATES}
        stages={[
          { key: "a", title: "รับงาน", state: "done" },
          { key: "b", title: "พิมพ์", state: "current", children: <button type="button">จบขั้นตอน</button> },
          { key: "c", title: "แพ็ก", state: "upcoming", children: <button type="button">ไม่ควรเห็น</button> },
        ]}
      />,
    );
    const current = screen.getByRole("listitem", { current: "step" });
    expect(current).toHaveTextContent("พิมพ์");
    expect(current).toHaveTextContent("ขั้นปัจจุบัน");
    expect(screen.getByRole("button", { name: "จบขั้นตอน" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ไม่ควรเห็น" })).toBeNull();
    await expectNoA11yViolations(container);
  });
});

describe("QRCode", () => {
  it("draws the code as one named SVG path with a quiet zone", () => {
    render(<QRCode value="https://packio.invalid/track/S-2569-00801-01" label="QR ติดตามกล่องที่ 1" />);
    const svg = screen.getByRole("img", { name: "QR ติดตามกล่องที่ 1" });
    const [, , side] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    // Version 3 at level M for this URL: 29 modules + 4 of quiet zone on each side.
    expect(side).toBeGreaterThanOrEqual(29 + 8);
    expect(svg.querySelector("path")!.getAttribute("d")).toMatch(/^M4,4h1v1h-1z/);
  });
});

describe("LabelSheet", () => {
  it("puts each label on its own 100 × 150 mm page", () => {
    render(<LabelSheet label="ฉลากกล่อง" labels={[<p key="1">กล่อง 1</p>, <p key="2">กล่อง 2</p>]} />);
    const sheet = screen.getByRole("region", { name: "ฉลากกล่อง" });
    expect(sheet.querySelectorAll(".label-page")).toHaveLength(2);
    expect(sheet.querySelector("style")!.textContent).toContain("size: 100mm 150mm");
  });
});

describe("ScanButton", () => {
  it("takes a typed code when there is no camera", async () => {
    const onCode = vi.fn();
    render(
      <ScanButton
        onCode={onCode}
        labels={{
          open: "สแกน",
          title: "สแกนรหัส",
          aim: "เล็งกล้อง",
          noCamera: "อุปกรณ์นี้สแกนไม่ได้ พิมพ์รหัสแทน",
          manual: "รหัสงาน",
          manualHint: "เช่น J-2569-00300",
          submit: "เปิดงาน",
          close: "ปิด",
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "สแกน" }));
    expect(await screen.findByText("อุปกรณ์นี้สแกนไม่ได้ พิมพ์รหัสแทน")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/รหัสงาน/), " J-2569-00300 ");
    await userEvent.click(screen.getByRole("button", { name: "เปิดงาน" }));
    expect(onCode).toHaveBeenCalledWith("J-2569-00300");
  });
});

describe("SignaturePad", () => {
  it("offers a typed name instead of drawing (WCAG 2.5.7)", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SignaturePad
        onChange={onChange}
        labels={{
          label: "ลายเซ็นผู้รับ",
          hint: "ให้ผู้รับเซ็นในกรอบ",
          clear: "ล้าง",
          draw: "เซ็น",
          type: "พิมพ์ชื่อ",
          typedName: "ชื่อผู้รับ",
          mode: "วิธีลงชื่อ",
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "ลายเซ็นผู้รับ" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /พิมพ์ชื่อ/ }));
    expect(screen.getByLabelText(/ชื่อผู้รับ/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("CameraCapture", () => {
  const labels = {
    take: "ถ่ายรูป",
    more: "ถ่ายเพิ่ม",
    photo: (n: number) => `รูปที่ ${n}`,
    remove: (n: number) => `ลบรูปที่ ${n}`,
    count: (n: number) => `${n} รูป`,
    processing: "กำลังเตรียมรูป",
  };

  it("adds shots with their capture time and removes one", async () => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    let photos: CapturedPhoto[] = [];
    const onChange = vi.fn((next: CapturedPhoto[]) => {
      photos = next;
    });
    const { rerender } = render(<CameraCapture photos={photos} onChange={onChange} labels={labels} />);
    const file = new File(["not really a jpeg"], "shot.jpg", { type: "image/jpeg", lastModified: Date.UTC(2026, 8, 27, 7, 5) });
    fireEvent.change(screen.getByLabelText("ถ่ายรูป"), { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(photos[0]!.capturedAt).toBe("2026-09-27T14:05:00+07:00");
    rerender(<CameraCapture photos={photos} onChange={onChange} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "ลบรูปที่ 1" }));
    expect(photos).toEqual([]);
  });
});

describe("exifDateTimeOriginal", () => {
  /** A minimal JPEG: SOI, an APP1 Exif segment with IFD0 → ExifIFD → DateTimeOriginal. */
  function jpeg(value: string, little: boolean): Uint8Array {
    const tiff = new DataView(new ArrayBuffer(64));
    const u16 = (at: number, v: number) => tiff.setUint16(at, v, little);
    const u32 = (at: number, v: number) => tiff.setUint32(at, v, little);
    tiff.setUint16(0, little ? 0x4949 : 0x4d4d);
    u16(2, 42);
    u32(4, 8); // IFD0 at 8
    u16(8, 1); // one entry
    u16(10, 0x8769); // ExifIFD pointer
    u16(12, 4);
    u32(14, 1);
    u32(18, 26); // ExifIFD at 26
    u16(26, 1);
    u16(28, 0x9003); // DateTimeOriginal
    u16(30, 2);
    u32(32, 20);
    u32(36, 44); // value at 44
    const bytes = new Uint8Array(tiff.buffer);
    for (let index = 0; index < value.length; index += 1) bytes[44 + index] = value.charCodeAt(index);
    const header = [0xff, 0xd8, 0xff, 0xe1, 0, 72, ...[..."Exif"].map((c) => c.charCodeAt(0)), 0, 0];
    return new Uint8Array([...header, ...bytes]);
  }

  it.each([true, false])("reads the shutter time in either byte order (little-endian: %s)", (little) => {
    const value = exifDateTimeOriginal(jpeg("2026:09:27 14:05:33", little));
    expect(value).toBe("2026:09:27 14:05:33");
    expect(exifToIso(value!)).toBe("2026-09-27T14:05:33+07:00");
  });

  it("answers null for anything that is not a JPEG with the tag", () => {
    expect(exifDateTimeOriginal(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(exifDateTimeOriginal(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
  });
});
