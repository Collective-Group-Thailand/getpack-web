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

/** EAN-8 / UPC-A quiet zones (GS1): 7 modules each side for EAN-8, 9 for UPC-A. */
export const EAN8_QUIET = 7;
export const UPCA_QUIET = 9;
/** Code 128 quiet zone: 10 modules each side (ISO/IEC 15417). */
export const CODE128_QUIET = 10;

/** The GS1 check digit (mod 10, weights 3 and 1 from the right) for any length. */
export function gs1CheckDigit(body: string): number {
  const sum = [...body]
    .reverse()
    .reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

const withCheck = (value: string, length: number) =>
  new RegExp(`^\\d{${length - 1}}$`).test(value) ? value + gs1CheckDigit(value) : value;
const validGs1 = (digits: string, length: number) =>
  new RegExp(`^\\d{${length}}$`).test(digits) && gs1CheckDigit(digits.slice(0, -1)) === Number(digits.at(-1));

/** EAN-8: start, four left digits in L, centre, four right in R, end, quiet zones. 7 digits get their check digit. */
export function ean8Modules(value: string): string | null {
  const digits = withCheck(value, 8);
  if (!validGs1(digits, 8)) return null;
  let bits = "101";
  for (let i = 0; i < 4; i++) bits += L[Number(digits[i])];
  bits += "01010";
  for (let i = 4; i < 8; i++) bits += R[Number(digits[i])];
  bits += "101";
  return "0".repeat(EAN8_QUIET) + bits + "0".repeat(EAN8_QUIET);
}

/** UPC-A: the EAN-13 of "0" + its 12 digits, with UPC-A's own quiet zones. 11 digits get their check digit. */
export function upcaModules(value: string): string | null {
  const digits = withCheck(value, 12);
  if (!validGs1(digits, 12)) return null;
  const ean = ean13Modules(`0${digits}`);
  return ean ? "0".repeat(UPCA_QUIET) + ean.slice(EAN_QUIET_LEFT, ean.length - EAN_QUIET_RIGHT) + "0".repeat(UPCA_QUIET) : null;
}

/** Code 128 bar/space widths for values 0–106 (ISO/IEC 15417, table 1). */
const C128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

/**
 * Code 128 in code set B (printable ASCII 32–126): start B, the characters, the mod-103 check
 * character, stop, quiet zones. `null` for a character outside set B.
 */
export function code128Modules(value: string): string | null {
  if (!value || [...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126)) return null;
  const codes = [104, ...[...value].map((ch) => ch.charCodeAt(0) - 32)];
  const check = codes.reduce((sum, code, i) => sum + code * Math.max(1, i), 0) % 103;
  let bits = "";
  for (const code of [...codes, check, 106]) {
    [...C128[code]!].forEach((width, i) => (bits += (i % 2 === 0 ? "1" : "0").repeat(Number(width))));
  }
  return "0".repeat(CODE128_QUIET) + bits + "0".repeat(CODE128_QUIET);
}

export type BarSymbology = "ean13" | "ean8" | "upca" | "code128";

/** The modules of any linear symbology the studio draws, quiet zones included. */
export function barModules(kind: BarSymbology, value: string): string | null {
  switch (kind) {
    case "ean13":
      return ean13Modules(value);
    case "ean8":
      return ean8Modules(value);
    case "upca":
      return upcaModules(value);
    case "code128":
      return code128Modules(value);
  }
}
