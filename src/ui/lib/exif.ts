/**
 * The moment a JPEG was taken, from its EXIF `DateTimeOriginal` (tag 0x9003), as the camera
 * wrote it — `"2026:09:27 14:05:33"`, local time with no zone. Only this one tag is read: the
 * shop floor's photos are evidence, and the time the shutter fired is what a milestone or a POD
 * should carry, not the time the upload finished on a slow connection.
 *
 * Returns `null` for anything that is not a JPEG with that tag (a PNG, a screenshot, a photo whose
 * EXIF a messaging app stripped). The caller falls back to the file's `lastModified`.
 */
export function exifDateTimeOriginal(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let at = 2;
  while (at + 4 <= view.byteLength) {
    const marker = view.getUint16(at);
    const length = view.getUint16(at + 2);
    if (marker === 0xffe1 && ascii(bytes, at + 4, 6) === "Exif\0\0") return readTiff(view, bytes, at + 10);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    at += 2 + length;
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let index = start; index < start + length && index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]!);
  return text;
}

function readTiff(view: DataView, bytes: Uint8Array, tiff: number): string | null {
  if (tiff + 8 > view.byteLength) return null;
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (offset: number) => view.getUint16(tiff + offset, little);
  const u32 = (offset: number) => view.getUint32(tiff + offset, little);
  const entry = (ifd: number, tag: number): number | null => {
    if (tiff + ifd + 2 > view.byteLength) return null;
    const count = u16(ifd);
    for (let index = 0; index < count; index += 1) {
      const at = ifd + 2 + index * 12;
      if (tiff + at + 12 > view.byteLength) return null;
      if (u16(at) === tag) return at;
    }
    return null;
  };
  const ifd0 = u32(4);
  const pointer = entry(ifd0, 0x8769);
  if (pointer === null) return null;
  const exifIfd = u32(pointer + 8);
  const original = entry(exifIfd, 0x9003);
  if (original === null) return null;
  const count = u32(original + 4);
  const offset = count > 4 ? u32(original + 8) : original + 8;
  const text = ascii(bytes, tiff + offset, Math.min(count, 19));
  return /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text : null;
}

/** `"2026:09:27 14:05:33"` taken in Thailand → `"2026-09-27T14:05:33+07:00"`. */
export function exifToIso(value: string, offset = "+07:00"): string {
  const [day, time] = value.split(" ");
  return `${day!.replace(/:/g, "-")}T${time}${offset}`;
}
