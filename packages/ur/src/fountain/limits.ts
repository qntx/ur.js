/** Hard limits for adversarial multi-part streams. */
export interface DecoderLimits {
  maxMessageLength: number;
  maxFragmentCount: number;
  maxFragmentDataLength: number;
  maxBufferParts: number;
  maxReceivedParts: number;
  maxUriLen: number;
}

/** Production Default; same integers as bcur 1.0. Hosts that need another budget pass `new Decoder({ limits })`. */
export const DEFAULT_LIMITS: DecoderLimits = {
  maxMessageLength: 1_048_576,
  maxFragmentCount: 2_000,
  maxFragmentDataLength: 8_192,
  maxBufferParts: 4_000,
  maxReceivedParts: 8_000,
  maxUriLen: 8_192,
};

export function mergeLimits(partial?: Partial<DecoderLimits>): DecoderLimits {
  return { ...DEFAULT_LIMITS, ...partial };
}
