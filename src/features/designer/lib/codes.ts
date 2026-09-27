import qrcode from "qrcode-generator";

/*
 * QR codes and EAN-13 barcodes as geometry the canvas and the print file draw: dark modules for
 * a QR code, bars for a barcode — each with its quiet zone as part of the symbol, so a symbol
 * placed on the box always carries the white margin a scanner needs.
 */

/** A QR code's quiet zone: 4 modules on every side (ISO/IEC 18004). */
export const QR_QUIET_MODULES = 4;
/** EAN-13 quiet zones: 11 modules left, 7 right (GS1). */
export const EAN_QUIET_LEFT = 11;
export const EAN_QUIET_RIGHT = 7;
/** The smallest EAN-13 GS1 allows at 80 % magnification: 29.83 mm wide including quiet zones. */
export const EAN_MIN_WIDTH_MM = 29.83;
/** A QR code's module under this size stops scanning reliably from print. ⚠ prepress to confirm. */
export const QR_MIN_MODULE_MM = 0.4;

export interface QrMatrix {
  /** Modules a side, quiet zone included. */
  size: number;
  dark: (row: number, col: number) => boolean;
}

/** UTF-8 as a byte string, so Thai text encodes as the bytes a phone expects. */
const utf8 = (s: string) => unescape(encodeURIComponent(s));

export function qrMatrix(value: string): QrMatrix | null {
  if (!value) return null;
  try {
    const qr = qrcode(0, "M");
    qr.addData(utf8(value), "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const q = QR_QUIET_MODULES;
    return {
      size: n + 2 * q,
      dark: (row, col) => row >= q && col >= q && row < n + q && col < n + q && qr.isDark(row - q, col - q),
    };
  } catch {
    return null;
  }
}

/** The dark modules as one SVG path in a `size × size` unit grid (a square per module). */
export function qrPath(m: QrMatrix): string {
  let d = "";
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return d;
}

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = L.map((code) =>
  [...code]
    .reverse()
    .map((b) => (b === "1" ? "0" : "1"))
    .join(""),
);
const R = L.map((code) => [...code].map((b) => (b === "1" ? "0" : "1")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** The EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/** Whether a 13-digit string is a valid EAN-13 (its check digit matches). */
export function isValidEan13(value: string): boolean {
  return /^\d{13}$/.test(value) && ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/**
 * The 95 modules of an EAN-13 (start, six left digits in L/G parity by the first digit, centre,
 * six right digits in R, end) with the quiet zones either side: `"1"` is a bar. 12 digits get
 * their check digit added.
 */
export function ean13Modules(value: string): string | null {
  const digits = /^\d{12}$/.test(value) ? value + ean13CheckDigit(value) : value;
  if (!isValidEan13(digits)) return null;
  const parity = PARITY[Number(digits[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? L : G)[Number(digits[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[Number(digits[i])];
  bits += "101";
  return "0".repeat(EAN_QUIET_LEFT) + bits + "0".repeat(EAN_QUIET_RIGHT);
}

/** The bars as one SVG path in a `modules × 1` unit box. */
export function barsPath(modules: string): string {
  let d = "";
  let i = 0;
  while (i < modules.length) {
    if (modules[i] !== "1") {
      i++;
      continue;
    }
    let j = i;
    while (j < modules.length && modules[j] === "1") j++;
    d += `M${i} 0h${j - i}v1h-${j - i}z`;
    i = j;
  }
  return d;
}
