/**
 * The two web-platform globals the engine uses, typed here rather than pulling in the DOM lib:
 * both exist in every browser and in Node ≥ 11, and the engine must not depend on anything else.
 */
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
