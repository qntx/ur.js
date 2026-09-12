/**
 * Uniform Resources (UR) for JavaScript/TypeScript.
 *
 * 1.0 transport freeze: opaque payload bytes plus a type token.
 * Bytewords, fountain codes, and UR encode/decode. No dCBOR parse
 * and no application type registry.
 *
 * Do not rely on deep imports of RNG/fountain helpers unless documented
 * as supported subpath exports.
 */

export { UrError, failPoison, type DecoderPoison, type UrErrorCode } from "./error.ts";
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
} from "./fountain/index.ts";

export {
  Decoder,
  Encoder,
  type Kind,
  type ParsedUr,
  UrType,
  decode,
  decodeMessage,
  decodeWithType,
  encode,
  normalizeUr,
  parse,
  parseNormalized,
  toQrString,
} from "./ur/index.ts";
