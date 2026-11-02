/** LINE's share URL for a message (https://developers.line.biz — "Share with LINE"): opens LINE on a phone. */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}
