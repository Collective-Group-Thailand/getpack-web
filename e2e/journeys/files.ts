/**
 * Files the walks hand to file pickers. All generated here, none taken from anywhere: a 1 × 1
 * PNG and JPEG (enough for an upload to succeed) and a small two-colour "logo" square.
 */

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG_1X1 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
/** 16 × 16, teal square with a white centre — drawn for these tests. */
const LOGO_16 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR4nGPgz0shCTEMcg3/cYBRDfTVMAiTBjEIACOZaBBg8NOUAAAAAElFTkSuQmCC";

export const png = (name: string) => ({ name, mimeType: "image/png", buffer: Buffer.from(PNG_1X1, "base64") });
export const jpeg = (name: string) => ({ name, mimeType: "image/jpeg", buffer: Buffer.from(JPEG_1X1, "base64") });
export const logo = () => ({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(LOGO_16, "base64") });
