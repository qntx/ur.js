/**
 * Uniform Resources (UR) for JavaScript/TypeScript.
 *
 * Bytes-first transport: Bytewords, fountain codes, and UR encode/decode.
 * Wire-compatible with bcur, ur-rs, and Blockchain Commons references.
 */

export { UrError, type UrErrorCode } from "./error.ts";
export { checksum as crc32 } from "./crc32.ts";

export * as bytewords from "./bytewords/index.ts";
export {
  canonicalizeByteword,
  decode as decodeBytewords,
  encode as encodeBytewords,
  encodeRaw,
  type Style,
} from "./bytewords/index.ts";

export {
  DEFAULT_LIMITS,
  type DecoderLimits,
  FountainDecoder,
  FountainEncoder,
  Part,
  chooseFragments,
  fragmentLength,
  partition,
} from "./fountain/index.ts";

export {
  Decoder,
  Encoder,
  type Kind,
  type ParsedUr,
  UrType,
  decode,
  decodeWithType,
  encode,
  normalizeUr,
  parse,
  parseNormalized,
  toQrString,
} from "./ur/index.ts";

export { Xoshiro256, makeMessage } from "./rng/index.ts";
